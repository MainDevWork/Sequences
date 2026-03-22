const entries = [];
let sortDirection = 'asc';
let csvFileHandle = null;

function generatePassword(len = 20) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    const array = new Uint8Array(len);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        const unquote = s => (s || '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim();
        const id = unquote(parts[0]);
        const service = unquote(parts[1]);
        const password = unquote(parts[2]);
        const createdAt = unquote(parts[3]);
        const updatedAt = unquote(parts[4]);
        if (service && password) {
            results.push({
                site: service,
                password: password,
                id: id ? Number(id) : undefined,
                createdAt: createdAt || new Date().toISOString(),
                updatedAt: updatedAt || new Date().toISOString()
            });
        }
    }
    return results;
}

function entriesToCSV() {
    const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
    let csv = '"ID","Service","Password","Created At","Updated At"\n';
    entries.forEach(item => {
        csv += [
            esc(item.id || ''),
            esc(item.site || ''),
            esc(item.password || ''),
            esc(item.createdAt || ''),
            esc(item.updatedAt || '')
        ].join(',') + '\n';
    });
    return csv;
}

async function saveToCSV() {
    const csv = entriesToCSV();
    if (csvFileHandle) {
        try {
            const writable = await csvFileHandle.createWritable();
            await writable.write(csv);
            await writable.close();
            console.log("CSV file saved successfully.");
            return true;
        } catch (err) {
            console.error("Error saving CSV via handle:", err);
        }
    }
    // Fallback: trigger a download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passwords-export.csv';
    a.click();
    URL.revokeObjectURL(url);
    showMsg("CSV downloaded. Replace your existing file with it.");
    return true;
}

async function loadFromCSV() {
    let text = null;

    // Try fetching from the same folder first
    try {
        const response = await fetch('passwords-export.csv', {
            cache: 'no-store'
        });
        if (response.ok) {
            text = await response.text();
        }
    } catch (e) {
        console.log("Fetch not available, falling back to file picker.");
    }

    // Fallback: file picker (works on HTTPS / Railway)
    if (!text) {
        if ('showOpenFilePicker' in window) {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'CSV File',
                    accept: { 'text/csv': ['.csv'] },
                }],
                multiple: false
            });
            csvFileHandle = handle;
            const file = await handle.getFile();
            text = await file.text();
        } else {
            // Last resort: hidden file input
            text = await new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = async () => {
                    if (input.files.length > 0) {
                        resolve(await input.files[0].text());
                    } else {
                        reject(new Error('No file selected'));
                    }
                };
                input.oncancel = () => reject(new DOMException('User cancelled', 'AbortError'));
                input.click();
            });
        }
    }

    const parsed = parseCSV(text);
    entries.length = 0;
    parsed.forEach(item => entries.push(item));

    sortEntries();
    showMsg(`Successfully loaded ${entries.length} passwords from CSV!`);
}

function addEntry(site, password) {
    const existing = entries.findIndex(e => e.site.toLowerCase() === site.toLowerCase());
    if (existing >= 0) {
        entries[existing].password = password;
        entries[existing].updatedAt = new Date().toISOString();
        showMsg(`Updated password for: ${site}`);
    } else {
        entries.push({
            site: site.trim(),
            password,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        showMsg(`Added: ${site}`);
    }
    if (entries.length > 1) {
        sortEntries();
    } else {
        render();
    }
}

async function addWithPassword() {
    const input = document.getElementById('siteInput');
    const site = input.value.trim();
    if (!site) {
        alert("Please enter a service name!");
        return;
    }

    if (!confirm("Are you sure you want to generate and add a new service?")) return;

    if (!await verifyUserIdentity("Generate & Add")) {
        return;
    }

    const pass = generatePassword();

    let nextIndex = 1;
    if (entries.length > 0) {
        const indices = entries.map(e => Number(e.id || 0));
        nextIndex = Math.max(...indices) + 1;
        if (nextIndex <= entries.length) nextIndex = entries.length + 1;
    }

    const now = new Date().toISOString();
    entries.push({
        site: site.trim(),
        password: pass,
        id: nextIndex,
        createdAt: now,
        updatedAt: now
    });
    sortEntries();

    const saved = await saveToCSV();
    if (saved) {
        showMsg(`Added "${site}" and saved to CSV!`);
        input.value = '';
        input.focus();
        const btn = document.getElementById('generateBtn');
        if (btn) btn.disabled = false;
    } else {
        showMsg(`Added "${site}" locally but CSV save failed.`);
    }
}

function toggleSort() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    sortEntries();
    updateSortIcon();
}

function sortEntries() {
    entries.sort((a, b) => {
        const siteA = a.site.toLowerCase();
        const siteB = b.site.toLowerCase();
        if (siteA < siteB) return sortDirection === 'asc' ? -1 : 1;
        if (siteA > siteB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    render();
}

function updateSortIcon() {
    const th = document.querySelector('th.sortable');
    if (th) {
        th.classList.remove('asc', 'desc');
        th.classList.add(sortDirection);
    }
}

function render() {
    const tbody = document.getElementById('tbody');
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    tbody.innerHTML = '';

    const filteredEntries = entries.map((entry, index) => ({ entry, index }))
        .filter(item => item.entry.site.toLowerCase().includes(query));

    if (filteredEntries.length === 0) {
        const message = entries.length === 0
            ? "No passwords saved yet.<br>Add your first one above!"
            : "No matches found.";
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">${message}</td></tr>`;
        return;
    }

    filteredEntries.forEach((item, i) => {
        const { entry, index } = item;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td><strong>${escape(entry.site)}</strong></td>
            <td><code>${entry.password}</code></td>
            <td class="actions">
                <button class="secondary" onclick="copyPass(${index})">Copy</button>
                <button class="secondary" onclick="confirmNewPass(${index})">New Password</button>
                <button class="secondary" onclick="editSite(${index})">Edit Name</button>
                <button class="danger" onclick="confirmDelete(${index})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function copyPass(i) {
    navigator.clipboard.writeText(entries[i].password);
    showMsg("Password copied!");
}

function showVerifyPrompt(label) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('verifyOverlay');
        const input = document.getElementById('verifyInput');
        const labelEl = document.getElementById('verifyLabel');
        const submitBtn = document.getElementById('verifySubmitBtn');
        const cancelBtn = document.getElementById('verifyCancelBtn');

        labelEl.textContent = label;
        input.value = '';
        overlay.classList.remove('hidden');
        input.focus();

        function cleanup() {
            overlay.classList.add('hidden');
            submitBtn.removeEventListener('click', onSubmit);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keypress', onKeypress);
        }

        function onSubmit() {
            const val = input.value;
            cleanup();
            resolve(val);
        }

        function onCancel() {
            cleanup();
            resolve(null);
        }

        function onKeypress(e) {
            if (e.key === 'Enter') onSubmit();
        }

        submitBtn.addEventListener('click', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keypress', onKeypress);
    });
}

async function verifyUserIdentity(actionName) {
    const dream = await showVerifyPrompt("What is your biggest dream?");
    if (dream === null) {
        showMsg(`${actionName} canceled.`);
        return false;
    }
    const belief = await showVerifyPrompt("What is your belief system?");
    if (belief === null) {
        showMsg(`${actionName} canceled.`);
        return false;
    }
    const dog = await showVerifyPrompt("What is the name of your favourite dog?");
    if (dog === null) {
        showMsg(`${actionName} canceled.`);
        return false;
    }
    const correctDream = dream.trim().toLowerCase() === "world domination";
    const correctBelief = belief.trim().toLowerCase() === "deism";
    const correctDog = dog.trim() === "Teddy Junior";

    if (correctDream && correctBelief && correctDog) {
        console.log(`Verification passed for ${actionName}`);
        return true;
    } else {
        console.warn(`Verification failed for ${actionName}. Inputs: Dream="${dream}", Belief="${belief}", Dog="${dog}"`);
        showMsg(`${actionName} denied — verification failed.`);
        return false;
    }
}

async function confirmNewPass(i) {
    const service = entries[i].site;
    const firstConfirm = confirm(`Generate a new password for "${service}"?`);
    if (!firstConfirm) {
        showMsg("Action canceled.");
        return;
    }

    if (await verifyUserIdentity("Action")) {
        const newPassword = generatePassword();
        entries[i].password = newPassword;
        entries[i].updatedAt = new Date().toISOString();
        render();

        const saved = await saveToCSV();
        if (saved) {
            showMsg(`New password generated and saved for "${service}".`);
        } else {
            showMsg(`New password generated for "${service}" but CSV save failed.`);
        }
    }
}

async function editSite(i) {
    if (!confirm("Are you sure you want to edit this service name?")) return;

    if (!await verifyUserIdentity("Edit Name")) {
        return;
    }

    const newName = prompt("Edit service name:", entries[i].site);
    if (newName && newName.trim()) {
        const trimmedName = newName.trim();
        entries[i].site = trimmedName;
        entries[i].updatedAt = new Date().toISOString();
        sortEntries();

        const saved = await saveToCSV();
        if (saved) {
            showMsg("Name updated and saved to CSV.");
        } else {
            showMsg("Name updated locally but CSV save failed.");
        }
    }
}

async function confirmDelete(i) {
    const service = entries[i].site;
    const firstConfirm = confirm(`Are you sure you want to permanently delete the password for "${service}"?`);
    if (!firstConfirm) {
        showMsg("Deletion canceled.");
        return;
    }

    if (await verifyUserIdentity("Deletion")) {
        entries.splice(i, 1);
        render();

        const saved = await saveToCSV();
        if (saved) {
            showMsg(`"${service}" deleted and CSV updated.`);
        } else {
            showMsg(`"${service}" deleted locally but CSV save failed.`);
        }
    }
}

async function exportToCSV(useQuick = false) {
    if (!confirm("Are you sure you want to export passwords to CSV?")) return;

    if (entries.length === 0) {
        alert("No passwords to export!");
        return;
    }
    const csv = entriesToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    if (!useQuick && 'showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: `passwords-${new Date().toISOString().slice(0, 10)}.csv`,
                types: [{
                    description: 'CSV File',
                    accept: { 'text/csv': ['.csv'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            showMsg("Saved successfully!");
            return;
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passwords-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg("Downloaded via fallback");
}

function importFromCSV() {
    if (!confirm("Are you sure you want to import passwords from a CSV file?")) return;

    const file = document.getElementById('importFile').files[0];
    if (!file) return alert("Please select a CSV file.");
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const parsed = parseCSV(text);
        let count = 0;
        parsed.forEach(item => {
            entries.push(item);
            count++;
        });
        if (count > 0) {
            sortEntries();
        }
        showMsg(`Imported ${count} password${count === 1 ? '' : 's'}!`);
        document.getElementById('importFile').value = '';
    };
    reader.readAsText(file);
}

function showMsg(text) {
    const el = document.getElementById('status');
    el.textContent = text;
    setTimeout(() => el.textContent = '', 4000);
}

function escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.getElementById('siteInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') addWithPassword();
});

async function enableAddButton() {
    console.log("Load button clicked.");
    if (await verifyUserIdentity("Load")) {
        console.log("Identity verified. Loading CSV...");

        try {
            await loadFromCSV();
            const btn = document.getElementById('generateBtn');
            if (btn) {
                btn.disabled = false;
                showMsg("Add button enabled!");
            }
            console.log("CSV loaded and rendered. Button enabled.");
        } catch (error) {
            console.error("Error during initial load:", error);
            if (error.name !== 'AbortError') {
                showMsg(`Load failed: ${error.message}`);
            }
            const btn = document.getElementById('generateBtn');
            if (btn) btn.disabled = true;
        }
    }
}

// Disable the Generate & Add button on initial load
const genBtn = document.getElementById('generateBtn');
if (genBtn) {
    genBtn.disabled = true;
}

render();
