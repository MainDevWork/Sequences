# Sequences - Password Manager

## Project Overview

A browser-based password manager that runs as a static site (no server, no build tools, no frameworks). It stores and manages passwords in a local CSV file using the browser's File System Access API. The app is a single-page interface with a dark GitHub-inspired theme.

**Repository name:** Sequences
**Tech stack:** Vanilla HTML + CSS + JavaScript (no dependencies, no npm, no bundler)
**Files:** `index.html`, `script.js`, `style.css`, `passwords-export.csv`

---

## File Structure

```
Sequences/
  index.html              # Single-page UI
  script.js               # All application logic
  style.css               # Dark theme styling
  passwords-export.csv    # The persistent data file (CSV)
```

---

## Data Storage

All password data lives in a single CSV file (`passwords-export.csv`). There is NO server, NO API, NO database. The browser reads and writes directly to this file using the File System Access API (`showOpenFilePicker`, `createWritable`).

### CSV Format

The CSV uses double-quote-escaped fields. Header row:

```
"ID","Service","Password","Created At","Updated At"
```

Each row:

```
"1","ServiceName (optional email/username)","thePassword123!@#","2026-01-20T20:13:31.458Z","2026-01-20T20:13:31.458Z"
```

- **ID**: Auto-incrementing integer. When adding a new entry, calculate: `max(all existing IDs) + 1`. IDs may have gaps (e.g., 34 then 37) due to deletions. That is expected.
- **Service**: The service/website name. Often includes associated email or username in parentheses, e.g., `"GitHub (HeyNdibbs) (githash.1aaf52@burnermail.io)"`.
- **Password**: Generated 20-character password using the character set: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?`. Passwords contain special characters including commas, quotes, brackets, semicolons, etc. The CSV parser MUST handle these correctly via proper quoting.
- **Created At**: ISO 8601 timestamp set when the entry is first created. Never changes after creation.
- **Updated At**: ISO 8601 timestamp. Updated whenever the password or service name is modified.

### CSV Parsing Rules

Passwords contain every kind of special character. The CSV parser must:

1. Split on commas only when they are NOT inside double quotes. Regex: `/,(?=(?:[^"]*"[^"]*")*[^"]*$)/`
2. Strip surrounding double quotes from each field.
3. Un-escape doubled double-quotes (`""` becomes `"`).
4. When writing CSV, every field is wrapped in double quotes and internal double quotes are doubled.

---

## Application Flow

### Startup Behavior

1. The page loads with the "Generate & Add" button **disabled** (grayed out).
2. The table shows the empty state message: "No sequences saved yet. Add your first one above!"
3. The user MUST click "Load" first to unlock the app.

### Load Flow (the "Load" button)

1. User clicks the blue "Load" button.
2. The `verifyUserIdentity()` function runs (see Security section below).
3. If verification passes, `showOpenFilePicker` opens a native file dialog filtered to `.csv` files.
4. The user selects their `passwords-export.csv` file.
5. The file handle is stored in a global variable `csvFileHandle` for subsequent writes.
6. The CSV is parsed, the in-memory `entries` array is populated, sorted alphabetically, and rendered.
7. The "Generate & Add" button is enabled.

### Generate & Add Flow

1. User types a service name into the text input and clicks "Generate & Add" (or presses Enter).
2. If input is empty, `alert("Please enter a service name!")`.
3. `confirm()` dialog asks: "Are you sure you want to generate and add a new service?"
4. `verifyUserIdentity()` runs.
5. A 20-character random password is generated using `crypto.getRandomValues()`.
6. Next ID is calculated as `max(all existing IDs) + 1`.
7. The entry is pushed to the `entries` array with `createdAt` and `updatedAt` set to `new Date().toISOString()`.
8. Entries are re-sorted alphabetically.
9. The entire `entries` array is serialized back to CSV and written to the file via the stored file handle.
10. Input is cleared and re-focused.

### New Password Flow

1. User clicks "New Password" on a row.
2. `confirm()` dialog asks: "Generate a new password for [service]?"
3. `verifyUserIdentity()` runs.
4. A new 20-character password is generated.
5. The entry's password and `updatedAt` are updated in memory.
6. Table re-renders.
7. CSV file is saved.

### Edit Name Flow

1. User clicks "Edit Name" on a row.
2. `confirm()` dialog asks: "Are you sure you want to edit this service name?"
3. `verifyUserIdentity()` runs.
4. `prompt()` pre-filled with current name lets user edit.
5. The entry's name and `updatedAt` are updated in memory.
6. Entries re-sorted (name changed, sort order may change).
7. CSV file is saved.

### Delete Flow

1. User clicks the red "Delete" button on a row.
2. `confirm()` dialog asks: "Are you sure you want to permanently delete the password for [service]?"
3. `verifyUserIdentity()` runs.
4. Entry is removed from the `entries` array via `splice`.
5. Table re-renders.
6. CSV file is saved.

### Copy Flow

1. User clicks "Copy" on a row.
2. `navigator.clipboard.writeText()` copies the password.
3. Status message: "Password copied!" (auto-clears after 4 seconds).
4. No verification required for copy.

### Search

- A text input with placeholder "Search services..." filters the displayed table in real-time.
- Filters by case-insensitive substring match on the service name.
- Calls `render()` on every keystroke via `oninput="render()"`.
- When no matches: shows "No matches found."
- The search only affects display, not the underlying `entries` array.

### Sort

- Clicking the "Service" column header toggles between ascending (A-Z) and descending (Z-A) sort.
- Default sort direction is ascending.
- A CSS arrow indicator shows the current sort direction (up/down arrow via `::after` pseudo-element).
- Sort is case-insensitive.

---

## Security: Identity Verification

Every destructive or sensitive action (Load, Generate & Add, New Password, Edit Name, Delete) requires passing a 3-question identity verification via sequential `prompt()` dialogs:

1. **"What is your biggest dream?"** - Correct answer: `world domination` (case-insensitive, trimmed)
2. **"What is your belief system?"** - Correct answer: `deism` (case-insensitive, trimmed)
3. **"What is the name of your favourite dog?"** - Correct answer: `Teddy Junior` (case-SENSITIVE, trimmed - capital T, capital J)

If ANY prompt is cancelled (user clicks Cancel, returning `null`), the action is aborted with message "[ActionName] canceled."

If all 3 are answered but any is wrong, the action is denied with message "[ActionName] denied - verification failed." and a `console.warn` logs which answers were given.

If all 3 are correct, the action proceeds.

The **Copy** button is the only action that does NOT require verification.

---

## Password Generation

```javascript
function generatePassword(len = 20) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    const array = new Uint8Array(len);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
}
```

- Default length: 20 characters.
- Uses `crypto.getRandomValues` for cryptographic randomness.
- Character set (88 chars): uppercase, lowercase, digits, and symbols: `!@#$%^&*()_+-=[]{}|;:,.<>?`
- The modulo operation (`byte % chars.length`) maps each random byte to a character. This means characters at lower indices have a very slightly higher probability (256 is not evenly divisible by 88), but this is the intended behavior.

---

## In-Memory Data Model

The global `entries` array holds all loaded entries. Each entry object:

```javascript
{
    site: "GitHub (HeyNdibbs) (githash.1aaf52@burnermail.io)",  // string
    password: "]%P7_S)@4eYNAPK)0aIB",                           // string
    id: 6,                                                        // number
    createdAt: "2026-01-20T20:13:31.458Z",                       // ISO string
    updatedAt: "2026-02-01T17:46:17.640Z"                        // ISO string
}
```

The property names in JavaScript are `site` and `password` (lowercase). The CSV column headers are `Service` and `Password` (capitalized). The parsing and serialization functions handle this mapping.

---

## Export & Import (Hidden UI)

These functions exist in the code but have NO corresponding buttons in the HTML. They are retained as utility functions:

- **`exportToCSV(useQuick)`**: Serializes entries to CSV. If `showSaveFilePicker` is available and `useQuick` is false, it opens a save dialog. Otherwise falls back to creating a download link. Uses the same `entriesToCSV()` serializer. Requires a `confirm()` before proceeding.
- **`importFromCSV()`**: Reads from a file input element with id `importFile` (which does not exist in the current HTML). Parses CSV and appends entries. Requires a `confirm()` before proceeding.

---

## Status Messages

All user feedback is displayed in a `<span id="status">` element next to the Load button. Messages auto-clear after 4 seconds via `setTimeout`. The status text is green (#39d353).

```javascript
function showMsg(text) {
    const el = document.getElementById('status');
    el.textContent = text;
    setTimeout(() => el.textContent = '', 4000);
}
```

---

## HTML Escaping

Service names displayed in the table are escaped to prevent XSS:

```javascript
function escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

---

## UI Structure (index.html)

The HTML is minimal. No external CDN, no fonts loaded, no icons. Structure:

```
<div class="container">
  <!-- Row 1: Text input + "Generate & Add" button -->
  <div class="input-group">
    <input id="siteInput" placeholder="Enter website or service (e.g., GitHub, Netflix)" autofocus>
    <button class="primary" id="generateBtn" onclick="addWithPassword()">Generate & Add</button>
  </div>

  <!-- Row 2: Search input -->
  <div class="input-group">
    <input id="searchInput" placeholder="Search services..." oninput="render()">
  </div>

  <!-- Row 3: Load button + status message -->
  <div class="input-group">
    <button class="accent" onclick="enableAddButton()">Load</button>
    <span id="status"></span>
  </div>

  <!-- Table -->
  <table id="table">
    <thead>
      <tr>
        <th>#</th>
        <th class="sortable" onclick="toggleSort()">Service</th>
        <th>Sequences</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="tbody">
      <!-- Populated by render() -->
    </tbody>
  </table>
</div>
<script src="script.js"></script>
```

Each table row rendered by JavaScript:

```
| # (1-based display index) | Service name (bold) | Password (in <code> tag) | Copy | New Password | Edit Name | Delete |
```

- The `#` column shows the display position (1, 2, 3...), NOT the database ID.
- The `onclick` handlers for each row button pass the original array index (not the display index) so operations target the correct entry even when search is active.

---

## CSS Theme

Dark theme inspired by GitHub's dark mode. Key design tokens:

```css
--bg: #0d1117          /* Page background - very dark blue-black */
--card: #161b22        /* Table/card background */
--border: #30363d      /* Border color */
--text: #c9d1d9        /* Primary text - light gray */
--text-muted: #8b949e  /* Secondary text */
--accent: #58a6ff      /* Blue accent - links, column headers */
--green: #238636       /* Primary button (Generate & Add) */
--green-hover: #2ea043
--red: #da3633         /* Danger button (Delete) */
--red-hover: #f85149
--gray: #30363d        /* Secondary buttons (Copy, New Password, Edit Name) */
--gray-hover: #484f58
```

Button classes:
- `.primary` - Green. Used for "Generate & Add".
- `.accent` - Blue (#1f6feb). Used for "Load".
- `.secondary` - Gray. Used for "Copy", "New Password", "Edit Name".
- `.danger` - Red. Used for "Delete".
- All buttons when `:disabled` get gray background, gray text, `cursor: not-allowed`, `opacity: 0.6`.

Table styling:
- `border-collapse: collapse` with `border-radius: 12px` and `overflow: hidden` for rounded corners.
- `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3)` for depth.
- Header row: `background: #21262d`, text color is accent blue.
- Row hover: `background: rgba(31, 111, 235, 0.1)` - subtle blue highlight.
- Password displayed in `<code>` tag with monospace font stack: `'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace` on dark background (`rgba(0,0,0,0.3)`).

Sort indicator:
- `th.sortable::after` shows `↕` (dimmed) by default.
- `.asc::after` shows `↑` (full opacity).
- `.desc::after` shows `↓` (full opacity).

Body font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

Responsive: At `max-width: 768px`, input groups stack vertically and action buttons center.

Container: `max-width: 1000px`, centered with `margin: 0 auto`.

---

## Page Title

```html
<title>Manager</title>
```

---

## Key Behaviors to Preserve

1. The "Generate & Add" button starts **disabled** on page load. It only becomes enabled after a successful Load.
2. Every mutation (add, edit name, new password, delete) immediately writes the full CSV back to the file. There is no "Save" button - persistence is automatic.
3. Pressing Enter in the service name input triggers "Generate & Add".
4. The `addEntry()` function exists as a utility that checks for duplicates by case-insensitive service name match. If a duplicate is found, it updates the password instead of creating a new entry. This function is NOT called by the main UI flow (which uses `addWithPassword()`), but it is retained.
5. When saving fails (e.g., file handle lost), the in-memory change still takes effect - the user sees the change but gets a warning that CSV save failed.
6. Sort defaults to ascending on page load. The sort state is tracked in a global `sortDirection` variable.
7. The `csvFileHandle` global variable persists the file handle across operations. Once you Load, all subsequent saves write to that same file without re-prompting.

---

## Browser Requirements

- Requires a Chromium-based browser (Chrome, Edge, Brave) for the File System Access API (`showOpenFilePicker`, `createWritable`).
- Must be served over HTTPS or localhost (or opened as a local file in some browsers) for `crypto.getRandomValues` and clipboard API.
- Does NOT work in Firefox or Safari (they don't support the File System Access API).

---

## What This App Does NOT Have

- No server or backend
- No database
- No authentication beyond the prompt-based verification
- No encryption of the CSV file
- No build step, bundler, or package manager
- No external dependencies or CDN links
- No service worker or offline caching
- No routing (single page)
- No localStorage or IndexedDB usage
