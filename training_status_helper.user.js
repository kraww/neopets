// ==UserScript==
// @name         Neopets Training Status Helper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Collapse/expand pets and pin your main pet to the top on the training status page
// @author       you
// @match        https://www.neopets.com/island/training.phtml*
// @match        https://www.neopets.com/pirates/academy.phtml*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'neo_training_helper';

    function loadPrefs() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
        catch { return {}; }
    }

    function savePrefs(prefs) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }

    // ---------- Find pet blocks ----------
    // Each pet block starts with a <tr> whose single <td> contains "PetName (...) is"
    // We collect those header rows and everything up to the next header (or end of table)

    function findPetBlocks() {
        const allRows = Array.from(document.querySelectorAll('tr'));
        const blocks = [];

        allRows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 1) {
                const text = cells[0].textContent.trim();
                // Header rows look like "Amno (Level 1) is not on a course" or "Amno is currently..."
                if (/^\S+ (\(Level \d+\) )?is /i.test(text)) {
                    blocks.push({ headerRow: row, petName: text.split(/\s/)[0], contentRows: [] });
                }
            } else if (blocks.length > 0) {
                blocks[blocks.length - 1].contentRows.push(row);
            }
        });

        return blocks;
    }

    // ---------- Build UI ----------

    function buildToolbar(block, prefs) {
        const petName = block.petName;
        const headerCell = block.headerRow.querySelector('td');

        // Don't add twice
        if (headerCell.querySelector('.nts-toolbar')) return;

        const toolbar = document.createElement('span');
        toolbar.className = 'nts-toolbar';
        toolbar.style.cssText = 'float:right; display:inline-flex; gap:4px; align-items:center;';

        // --- Pin button ---
        const pinBtn = document.createElement('button');
        pinBtn.textContent = prefs.pinned === petName ? '★ Pinned' : '☆ Pin';
        pinBtn.title = 'Pin this pet to the top';
        pinBtn.style.cssText = btnStyle(prefs.pinned === petName ? '#c8a000' : '#555');
        pinBtn.addEventListener('click', () => {
            const p = loadPrefs();
            if (p.pinned === petName) {
                delete p.pinned;
            } else {
                p.pinned = petName;
            }
            savePrefs(p);
            applyAll();
        });

        // --- Collapse button ---
        const collapsed = (prefs.collapsed || []).includes(petName);
        const colBtn = document.createElement('button');
        colBtn.textContent = collapsed ? '▶ Show' : '▼ Hide';
        colBtn.title = 'Toggle collapse';
        colBtn.style.cssText = btnStyle('#333');
        colBtn.addEventListener('click', () => {
            const p = loadPrefs();
            p.collapsed = p.collapsed || [];
            if (p.collapsed.includes(petName)) {
                p.collapsed = p.collapsed.filter(n => n !== petName);
            } else {
                p.collapsed.push(petName);
            }
            savePrefs(p);
            applyAll();
        });

        toolbar.appendChild(pinBtn);
        toolbar.appendChild(colBtn);
        headerCell.appendChild(toolbar);
    }

    function btnStyle(bg) {
        return `background:${bg}; color:#fff; border:none; border-radius:3px; padding:1px 6px; font-size:11px; cursor:pointer; line-height:1.4;`;
    }

    // ---------- Apply collapse + pin ----------

    function applyAll() {
        const prefs = loadPrefs();
        const blocks = findPetBlocks();

        // Rebuild toolbars (prefs may have changed)
        blocks.forEach(block => {
            const headerCell = block.headerRow.querySelector('td');
            const existing = headerCell.querySelector('.nts-toolbar');
            if (existing) existing.remove();
            buildToolbar(block, prefs);
        });

        // Pin: move pinned block's rows before all others
        if (prefs.pinned) {
            const pinnedBlock = blocks.find(b => b.petName === prefs.pinned);
            if (pinnedBlock) {
                const firstHeaderRow = blocks[0].headerRow;
                const parent = firstHeaderRow.parentNode;

                // Insert pinned header first, then its content rows
                [pinnedBlock.headerRow, ...pinnedBlock.contentRows].forEach(row => {
                    parent.insertBefore(row, firstHeaderRow);
                });

                // Add a visual separator after the pinned block
                let sep = document.getElementById('nts-pin-sep');
                if (!sep) {
                    sep = document.createElement('tr');
                    sep.id = 'nts-pin-sep';
                    sep.innerHTML = '<td colspan="99" style="border-top:3px solid #c8a000; padding:0;"></td>';
                }
                const rowAfterPinned = pinnedBlock.contentRows[pinnedBlock.contentRows.length - 1];
                if (rowAfterPinned && rowAfterPinned.nextSibling) {
                    parent.insertBefore(sep, rowAfterPinned.nextSibling);
                }
            }
        } else {
            const sep = document.getElementById('nts-pin-sep');
            if (sep) sep.remove();
        }

        // Collapse: hide/show content rows
        const collapsed = prefs.collapsed || [];
        blocks.forEach(block => {
            const hide = collapsed.includes(block.petName);
            block.contentRows.forEach(row => {
                row.style.display = hide ? 'none' : '';
            });
        });
    }

    // ---------- Run ----------
    applyAll();

})();
