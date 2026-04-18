// ==UserScript==
// @name         Neopets - Quick Stock Danger Highlight
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Highlights the Donate and Discard columns in red and repeats the header row below Check All
// @author       Krawwly
// @match        https://www.neopets.com/quickstock.phtml*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ── Find the table and locate Donate/Discard column indices ──

    let targetTable = null;
    let headerRow = null;
    let donateIdx = -1;
    let discardIdx = -1;

    for (const table of document.querySelectorAll('table')) {
        for (const row of table.querySelectorAll('tr')) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            let foundDonate = false, foundDiscard = false;
            cells.forEach((cell, i) => {
                const text = cell.textContent.trim().toLowerCase();
                if (text === 'donate')  { donateIdx  = i; foundDonate  = true; }
                if (text === 'discard') { discardIdx = i; foundDiscard = true; }
            });
            if (foundDonate && foundDiscard) {
                targetTable = table;
                headerRow   = row;
                break;
            }
        }
        if (targetTable) break;
    }

    if (!targetTable || donateIdx === -1 || discardIdx === -1) return;

    // ── Styles ──

    const style = document.createElement('style');
    style.textContent = `
        .qs-danger {
            background-color: rgba(200, 30, 30, 0.12) !important;
        }
        .qs-danger-header {
            background-color: rgba(160, 20, 20, 0.3) !important;
        }
    `;
    document.head.appendChild(style);

    // ── Tint Donate and Discard columns ──

    for (const row of targetTable.querySelectorAll('tr')) {
        const cells = row.querySelectorAll('td, th');
        const isHeader = row === headerRow;
        for (const idx of [donateIdx, discardIdx]) {
            if (cells[idx]) {
                cells[idx].classList.add(isHeader ? 'qs-danger-header' : 'qs-danger');
            }
        }
    }

    // ── Repeat header below the Check All row ──

    const allRows = Array.from(targetTable.querySelectorAll('tr'));
    const checkAllRow = allRows.find(row =>
        row.textContent.toLowerCase().includes('check all')
    );

    if (checkAllRow) {
        const bottomHeader = headerRow.cloneNode(true);
        // Remove any danger classes on the clone so it inherits the original header styles cleanly
        bottomHeader.querySelectorAll('.qs-danger-header').forEach(cell => {
            cell.classList.remove('qs-danger-header');
        });
        checkAllRow.parentNode.insertBefore(bottomHeader, checkAllRow.nextSibling);
    }

})();
