// ==UserScript==
// @name         Neopets Item Transfer Log
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Logs items sent/received via transfers and inventory gives. View the log on the Transfer List page.
// @author       Krawwly
// @match        https://www.neopets.com/items/transfer_list.phtml*
// @match        https://www.neopets.com/inventory.phtml*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'neo_transfer_log';
    const MAX_ENTRIES = 500;

    // ============================================================
    // STORAGE HELPERS
    // ============================================================

    function getLog() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch { return []; }
    }

    function saveLog(entries) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    }

    // direction: 'in' (received/accepted) | 'out' (sent/declined/returned)
    // nc: true if this is a Neocash item transfer
    function addEntry(action, item, user, direction, nc = false) {
        const log = getLog();
        log.unshift({ ts: Date.now(), action, item, user, direction, nc });
        saveLog(log);
    }

    // ============================================================
    // TRANSFER LIST PAGE
    // ============================================================

    if (window.location.pathname.includes('transfer_list')) {
        hookTransferButtons();
        renderLogPanel();
    }

    function hookTransferButtons() {
        document.addEventListener('submit', (e) => {
            const form = e.target;

            // Build a column-index -> action map by reading the table header row.
            const colActionMap = {};
            const table = form.querySelector('table');
            if (table) {
                const headerRow = table.querySelector('tr');
                if (headerRow) {
                    Array.from(headerRow.children).forEach((cell, i) => {
                        const text = cell.textContent.toLowerCase();
                        if      (text.includes('accept'))  colActionMap[i] = { action: 'Accepted',  direction: 'in' };
                        else if (text.includes('return'))  colActionMap[i] = { action: 'Returned',  direction: 'out' };
                        else if (text.includes('decline')) colActionMap[i] = { action: 'Declined',  direction: 'in' };
                        else if (text.includes('cancel'))  colActionMap[i] = { action: 'Cancelled', direction: 'out' };
                        else if (text.includes('discard')) colActionMap[i] = { action: 'Discarded', direction: 'out' };
                        else if (text.includes('open'))    colActionMap[i] = { action: 'OPEN',      direction: null };
                    });
                }
            }

            const checked = Array.from(form.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked'));
            for (const input of checked) {
                const val  = (input.value || '').toLowerCase();
                const name = (input.name  || '').toLowerCase();

                let action = null, direction = null;

                // First try: keywords in value/name
                if      (val.includes('accept')  || name.includes('accept'))  { action = 'Accepted';  direction = 'in'; }
                else if (val.includes('return')  || name.includes('return'))  { action = 'Returned';  direction = 'out'; }
                else if (val.includes('decline') || name.includes('decline')) { action = 'Declined';  direction = 'in'; }
                else if (val.includes('cancel')  || name.includes('cancel'))  { action = 'Cancelled'; direction = 'out'; }
                else if (val.includes('discard') || name.includes('discard')) { action = 'Discarded'; direction = 'out'; }
                else if (val.includes('open')    || name.includes('open'))    { action = 'OPEN';      direction = null; }
                else {
                    // Second try: column position
                    const td = input.closest('td');
                    const tr = input.closest('tr');
                    if (td && tr) {
                        const colIndex = Array.from(tr.children).indexOf(td);
                        const mapped   = colActionMap[colIndex];
                        if (mapped) { action = mapped.action; direction = mapped.direction; }
                    }
                }

                if (!action) continue;

                const row = input.closest('tr');
                const username = extractUsername(row);

                if (action === 'OPEN') {
                    // Page 1 NC gift: save the sender's username so page 2 can use it
                    sessionStorage.setItem('neo_tl_pending_user', username);
                    sessionStorage.setItem('neo_tl_pending_nc', '1');
                    // Don't log — page 2 will log with the real item name
                    continue;
                }

                // For page 2 (ACCEPT/RETURN/DISCARD): if no username in the row,
                // fall back to the one saved from page 1
                const resolvedUser = (username !== 'Unknown User')
                    ? username
                    : (sessionStorage.getItem('neo_tl_pending_user') || 'Unknown User');

                const isNC = sessionStorage.getItem('neo_tl_pending_nc') === '1';

                // Clear saved state after using it
                sessionStorage.removeItem('neo_tl_pending_user');
                sessionStorage.removeItem('neo_tl_pending_nc');

                addEntry(action, extractItemName(row), resolvedUser, direction, isNC);
            }
        }, true);
    }

    function extractItemName(row) {
        if (!row) return 'Unknown Item';

        // Priority 1: bold/strong text in the row (NC page 2 puts item name in <b>)
        for (const el of row.querySelectorAll('b, strong')) {
            const t = el.textContent.trim();
            if (t && t.length > 1 && t.length < 80) return t;
        }

        // Priority 2: the cell containing an <img> (regular transfer rows)
        for (const td of row.querySelectorAll('td')) {
            if (!td.querySelector('img')) continue;
            for (const a of td.querySelectorAll('a')) {
                const t = a.textContent.trim();
                if (t && t.length > 1) return t;
            }
            const t = td.textContent.trim();
            if (t && t.length > 1 && t.length < 120) return t;
        }

        return 'Unknown Item';
    }

    function extractUsername(container) {
        if (!container) return 'Unknown User';
        // Neopets user links: /userlookup.phtml?user=username
        const userLink = container.querySelector('a[href*="userlookup"]');
        if (userLink) return userLink.textContent.trim();
        // Fallback: text patterns in the row
        const text = container.textContent || '';
        const fromMatch = text.match(/\bfrom[:\s]+([a-z0-9_]+)/i);
        const toMatch   = text.match(/\bto[:\s]+([a-z0-9_]+)/i);
        return fromMatch?.[1] || toMatch?.[1] || 'Unknown User';
    }

    // ============================================================
    // INVENTORY PAGE — watch for "Give to NeoFriend" modal
    // ============================================================

    if (window.location.pathname.includes('/inventory')) {
        watchInventoryModal();
    }

    function watchInventoryModal() {
        let lastLoggedText = null;
        let pendingNCItem = null; // saved from giftbox verification step

        const observer = new MutationObserver(() => {
            const bodyText = document.body.innerText || document.body.textContent;

            // --- Regular inventory give ---
            // "You have given ITEM to User 'USERNAME'."
            const giveMatch = bodyText.match(/you have given (.+?) to user ['"]([^'"]+)['"]/i);
            if (giveMatch && giveMatch[0] !== lastLoggedText) {
                lastLoggedText = giveMatch[0];
                addEntry('Sent', giveMatch[1].trim(), giveMatch[2].trim(), 'out', false);
                return;
            }

            // --- NC giftbox: verification screen ---
            // "You are about to give USERNAME the following item(s): ITEM."
            const verifyMatch = bodyText.match(/you are about to give \S+ the following item\(s\):\s*(.+?)\./i);
            if (verifyMatch) {
                pendingNCItem = verifyMatch[1].trim();
            }

            // --- NC giftbox: success screen ---
            // "Congratulations! Your gift has been delivered to USERNAME."
            const successMatch = bodyText.match(/your gift has been delivered to ([a-z0-9_]+)/i);
            if (successMatch && bodyText !== lastLoggedText) {
                lastLoggedText = bodyText.slice(0, 80); // use start of text as dedup key
                const username = successMatch[1].trim();
                const itemName = pendingNCItem || 'NC Item';
                pendingNCItem = null;
                addEntry('Sent', itemName, username, 'out', true);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    // ============================================================
    // LOG PANEL — rendered on transfer list page
    // ============================================================

    function getThemeHeaderColor() {
        // Read the background color off an existing Neopets themed header
        // so the panel matches whatever site theme the user has enabled
        const candidates = [
            '.contentModuleHeader',
            '.module-header',
            '[class*="moduleHeader"]',
            '[class*="module_header"]',
            '.sidebar-title',
            '#sidebar h3',
            // The sidebar boxes (Misrow, Search Neopets, Neofriends) use a shared header style
            '.sidebarModule .header',
            '.sidebarHeader',
            '#sidebar .header',
        ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const bg = getComputedStyle(el).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        }
        return '#4a6e9a'; // fallback if no theme header found
    }

    function renderLogPanel() {
        const themeColor = getThemeHeaderColor();

        const style = document.createElement('style');
        style.textContent = `
            #neo-tl-panel {
                font-family: Arial, Verdana, sans-serif;
                font-size: 11px;
                margin: 8px 0 12px 0;
                border: 1px solid #666;
                background: #fff;
            }
            #neo-tl-header {
                background: ${themeColor};
                color: #fff;
                padding: 3px 6px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }
            #neo-tl-header .neo-tl-title {
                font-weight: bold;
                font-size: 11px;
            }
            #neo-tl-header .neo-tl-controls {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            #neo-tl-export-btn, #neo-tl-clear-btn {
                background: transparent;
                color: #fff;
                border: 1px solid #fff;
                padding: 1px 6px;
                cursor: pointer;
                font-size: 10px;
                font-family: Arial, Verdana, sans-serif;
            }
            #neo-tl-export-btn:hover, #neo-tl-clear-btn:hover { background: rgba(255,255,255,0.2); }
            #neo-tl-toggle-arrow { font-size: 10px; }
            #neo-tl-body { padding: 0; }
            #neo-tl-body table {
                width: 100%;
                border-collapse: collapse;
            }
            #neo-tl-body th {
                background: #FFCC00;
                color: #000;
                padding: 3px 6px;
                text-align: left;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                border-bottom: 1px solid #666;
            }
            #neo-tl-body td {
                padding: 3px 6px;
                border-bottom: 1px solid #eee;
                vertical-align: middle;
                font-size: 11px;
            }
            #neo-tl-body tbody tr:last-child td { border-bottom: none; }
            #neo-tl-body tbody tr:hover { background: #f5f8ff; }
            .neo-tl-in  { color: #006600; font-weight: bold; }
            .neo-tl-out { color: #cc0000; font-weight: bold; }
            .neo-tl-empty {
                color: #666;
                text-align: center;
                padding: 10px;
                font-style: italic;
                font-size: 11px;
            }
            .neo-tl-count {
                font-weight: normal;
                font-size: 10px;
                opacity: 0.8;
                margin-left: 4px;
            }
            .neo-tl-nc-badge {
                display: inline-block;
                background: #7b42c4;
                color: #fff;
                font-size: 9px;
                font-weight: bold;
                padding: 0 4px;
                border-radius: 2px;
                margin-left: 5px;
                vertical-align: middle;
                letter-spacing: 0.3px;
            }
        `;
        document.head.appendChild(style);

        const panel = document.createElement('div');
        panel.id = 'neo-tl-panel';

        const header = document.createElement('div');
        header.id = 'neo-tl-header';
        header.innerHTML = `
            <span class="neo-tl-title">Item Transfer Log <span class="neo-tl-count" id="neo-tl-count"></span></span>
            <span class="neo-tl-controls">
                <button id="neo-tl-export-btn" type="button">Export CSV</button>
                <button id="neo-tl-clear-btn" type="button">Clear Log</button>
                <span id="neo-tl-toggle-arrow">&#9660;</span>
            </span>
        `;
        panel.appendChild(header);

        const body = document.createElement('div');
        body.id = 'neo-tl-body';
        panel.appendChild(body);

        // From DevTools: content lives inside td.content > div[align="center"] (Jump to block).
        // Insert the panel inside td.content, right after that div — works whether or
        // not there are pending transfers on the page.
        const contentTd  = document.querySelector('td.content');
        const jumpToDiv  = contentTd?.querySelector('div[align="center"]');

        if (contentTd && jumpToDiv) {
            contentTd.insertBefore(panel, jumpToDiv.nextSibling);
        } else if (contentTd) {
            contentTd.prepend(panel);
        } else {
            document.body.prepend(panel);
        }

        // Toggle collapse/expand
        let collapsed = false;
        header.addEventListener('click', (e) => {
            if (e.target.id === 'neo-tl-clear-btn') return;
            collapsed = !collapsed;
            body.style.display = collapsed ? 'none' : '';
            document.getElementById('neo-tl-toggle-arrow').innerHTML = collapsed ? '&#9654;' : '&#9660;';
        });

        // Export CSV button
        document.getElementById('neo-tl-export-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const log = getLog();
            if (log.length === 0) { alert('No entries to export.'); return; }

            const rows = [['Time', 'Action', 'Item', 'User', 'Direction']];
            for (const entry of log) {
                const d = new Date(entry.ts);
                const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                rows.push([
                    `${dateStr} ${timeStr}`,
                    entry.action,
                    entry.item,
                    entry.user,
                    entry.direction === 'in' ? 'Received' : 'Sent'
                ]);
            }

            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `neopets-transfer-log-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Clear button
        document.getElementById('neo-tl-clear-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Clear all transfer log entries?')) {
                localStorage.removeItem(STORAGE_KEY);
                buildTable(body);
                document.getElementById('neo-tl-count').textContent = '';
            }
        });

        buildTable(body);
    }

    function buildTable(body) {
        const log = getLog();
        body.innerHTML = '';

        const count = document.getElementById('neo-tl-count');
        if (count) count.textContent = log.length > 0 ? `(${log.length})` : '';

        if (log.length === 0) {
            body.innerHTML = '<div class="neo-tl-empty">No events logged yet. Accept, decline, or return transfers — or send items from your inventory — to start tracking.</div>';
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>
            <th>Time</th>
            <th>Action</th>
            <th>Item</th>
            <th>User</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const entry of log) {
            const tr = document.createElement('tr');
            const d = new Date(entry.ts);
            const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const actionClass = entry.direction === 'in' ? 'neo-tl-in' : 'neo-tl-out';
            const ncBadge = entry.nc ? '<span class="neo-tl-nc-badge">NC</span>' : '';
            tr.innerHTML = `
                <td>${dateStr} ${timeStr}</td>
                <td><span class="${actionClass}">${entry.action}</span></td>
                <td>${entry.item}${ncBadge}</td>
                <td>${entry.user}</td>
            `;
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        body.appendChild(table);
    }

})();
