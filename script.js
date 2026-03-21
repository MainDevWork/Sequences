const entries = [];
let sortDirection = 'asc';

function generatePassword(len = 20) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    const array = new Uint8Array(len);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
}
function addEntry(site, password) {
    const existing = entries.findIndex(e => e.site.toLowerCase() === site.toLowerCase());
    if (existing >= 0) {
        entries[existing].password = password;
        showMsg(`Updated password for: ${site}`);
    } else {
        entries.push({ site: site.trim(), password });
        showMsg(`Added: ${site}`);
    }
    if (entries.length > 1) {
        sortEntries();
    } else {
        render();
    }
}
function addWithPassword() {
    const input = document.getElementById('siteInput');
    const site = input.value.trim();
    if (!site) {
        alert("Please enter a service name!");
        return;
    }

    if (!confirm("Are you sure you want to generate and add a new service?")) return;

    if (!verifyUserIdentity("Generate & Add")) {
        return;
    }

    const pass = generatePassword();

    // Determine next index (highest existing index + 1, or entries.length + 1)
    let nextIndex = 1;
    if (entries.length > 0) {
        const indices = entries.map(e => Number(e.id || 0));
        nextIndex = Math.max(...indices) + 1;
        if (nextIndex <= entries.length) nextIndex = entries.length + 1;
    }

    const dataToSend = {
        Service: site,
        Password: pass,
        Index: nextIndex,
        value: -1
    };

    console.log(`Syncing "${site}" to server via POST (value: -1)...`);
    fetch('https://n8n.srv1268978.hstgr.cloud/webhook/3edea957-6b00-4595-97ef-825f79ae4d43', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
    })
        .then(response => {
            if (response.ok) {
                showMsg(`Successfully synced "${site}" to server!`);
                input.value = '';
                input.focus();

                // Add locally
                entries.push({
                    site: site.trim(),
                    password: pass,
                    id: nextIndex
                });
                sortEntries(); // This calls render()

                // Keep button enabled
                const btn = document.getElementById('generateBtn');
                if (btn) btn.disabled = false;
            } else {
                throw new Error(`Sync failed with status: ${response.status}`);
            }
        })
        .catch(error => {
            console.error("Error in Generate & Add process:", error);
            showMsg(error.message || "Sync error.");
        });
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

    // Filter filteredEntries based on search query
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
        const { entry, index } = item; // index is the original index in 'entries' array
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
// Now protected with the same 3-question verification
function verifyUserIdentity(actionName) {
    const dream = prompt("What is your biggest dream?");
    if (dream === null) {
        showMsg(`${actionName} canceled.`);
        return false;
    }
    const belief = prompt("What is your belief system?");
    if (belief === null) {
        showMsg(`${actionName} canceled.`);
        return false;
    }
    const dog = prompt("What is the name of your favourite dog?");
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

// Now protected with the same 3-question verification
function confirmNewPass(i) {
    const service = entries[i].site;
    const firstConfirm = confirm(`Generate a new password for "${service}"?`);
    if (!firstConfirm) {
        showMsg("Action canceled.");
        return;
    }

    if (verifyUserIdentity("Action")) {
        const newPassword = generatePassword();
        console.log(`Syncing new password for "${service}" to server via POST (value: 2)...`);

        const dataToSend = {
            Service: service,
            Password: newPassword,
            value: 2
        };

        fetch('https://n8n.srv1268978.hstgr.cloud/webhook/3edea957-6b00-4595-97ef-825f79ae4d43', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        })
            .then(response => {
                if (response.ok) {
                    entries[i].password = newPassword;
                    render();
                    showMsg(`New password generated and synced for "${service}".`);
                } else {
                    throw new Error(`Update sync failed with status: ${response.status}`);
                }
            })
            .catch(error => {
                console.error("Error in New Password sync:", error);
                showMsg(error.message || "Update sync error.");
            });
    }
}

function editSite(i) {
    if (!confirm("Are you sure you want to edit this service name?")) return;

    if (!verifyUserIdentity("Edit Name")) {
        return;
    }

    const newName = prompt("Edit service name:", entries[i].site);
    if (newName && newName.trim()) {
        const trimmedName = newName.trim();
        const currentPassword = entries[i].password;

        console.log(`Syncing name change for "${trimmedName}" to server via POST (value: 2)...`);

        const dataToSend = {
            Service: trimmedName,
            Password: currentPassword,
            value: 2
        };

        fetch('https://n8n.srv1268978.hstgr.cloud/webhook/3edea957-6b00-4595-97ef-825f79ae4d43', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        })
            .then(response => {
                if (response.ok) {
                    entries[i].site = trimmedName;
                    sortEntries();
                    showMsg("Name updated and synced.");
                } else {
                    throw new Error(`Name update sync failed with status: ${response.status}`);
                }
            })
            .catch(error => {
                console.error("Error in Edit Name sync:", error);
                showMsg(error.message || "Name update sync error.");
            });
    }
}

// Delete remains the same (already protected)
function confirmDelete(i) {
    const service = entries[i].site;
    const password = entries[i].password; // Capture password for sync
    const firstConfirm = confirm(`Are you sure you want to permanently delete the password for "${service}"?`);
    if (!firstConfirm) {
        showMsg("Deletion canceled.");
        return;
    }

    if (verifyUserIdentity("Deletion")) {
        console.log(`Syncing delete for "${service}" to server via POST (value: -2)...`);

        const dataToSend = {
            Service: service,
            Password: password,
            value: -2
        };

        fetch('https://n8n.srv1268978.hstgr.cloud/webhook/3edea957-6b00-4595-97ef-825f79ae4d43', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        })
            .then(response => {
                if (response.ok) {
                    // Only remove locally if server sync is successful
                    entries.splice(i, 1);
                    render(); // render will re-apply filtered view
                    showMsg(`"${service}" deleted successfully.`);
                } else {
                    throw new Error(`Delete sync failed with status: ${response.status}`);
                }
            })
            .catch(error => {
                console.error("Error in Delete sync:", error);
                showMsg(error.message || "Delete sync error.");
            });
    }
}

// Export and Import logic exists, but UI buttons were removed.
// The functions are maintained as per "persist functionality" request, but unused by UI.
async function exportToCSV(useQuick = false) {
    if (!confirm("Are you sure you want to export passwords to CSV?")) return;

    if (entries.length === 0) {
        alert("No passwords to export!");
        return;
    }
    let csv = "Service,Password\n";
    entries.forEach(e => {
        csv += `"${e.site.replace(/"/g, '""')}","${e.password}"\n`;
    });
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
        const lines = text.split(/\r?\n/);
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
            const site = (parts[0] || '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim();
            const pass = (parts.slice(1).join(',') || '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim();
            if (site && pass) {
                entries.push({ site: site.trim(), password: pass });
                count++;
            }
        }
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

function fetchAndRenderEntries() {
    console.log("Fetching entries from server via POST (value: 1)...");
    // Return the promise so other functions can chain off it
    return fetch('https://n8n.srv1268978.hstgr.cloud/webhook/3edea957-6b00-4595-97ef-825f79ae4d43', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        },
        body: JSON.stringify({ value: 1 })
    })
        .then(response => {
            console.log(`Fetch response status: ${response.status}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Data received from server:", data);
            if (Array.isArray(data)) {
                entries.length = 0;
                data.forEach(item => {
                    const service = item.Service || item.site || 'Unknown';
                    const password = item.Password || item.password || '••••••••';

                    let idValue = item.Index !== undefined ? Number(item.Index) :
                        (item.id !== undefined ? Number(item.id) : undefined);

                    entries.push({
                        site: String(service).trim(),
                        password: String(password),
                        id: idValue
                    });
                });

                sortEntries();
                showMsg(`Successfully loaded ${entries.length} passwords!`);
            } else {
                console.warn("Received non-array data from server:", data);
                showMsg("Server returned unexpected data format.");
            }
        }); // No .catch here, let the caller handle it for unified messaging
}

function enableAddButton() {
    console.log("Load button clicked.");
    if (verifyUserIdentity("Load")) {
        console.log("Identity verified. Fetching entries first...");

        fetchAndRenderEntries()
            .then(() => {
                // ONLY enable button after successful fetch
                const btn = document.getElementById('generateBtn');
                if (btn) {
                    btn.disabled = false;
                    showMsg("Add button enabled!");
                }
                console.log("Entries fetched and rendered. Button enabled.");
            })
            .catch(error => {
                console.error("Error during initial load:", error);
                showMsg(`Load failed: ${error.message}`);
                // Ensure button remains disabled on error
                const btn = document.getElementById('generateBtn');
                if (btn) btn.disabled = true;
            });
    }
}
// Disable the Generate & Add button on initial load
const genBtn = document.getElementById('generateBtn');
if (genBtn) {
    genBtn.disabled = true;
}

render();
