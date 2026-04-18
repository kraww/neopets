// ==UserScript==
// @name         Neopets Gallery - Quick Remove
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds an X button to gallery items for quick removal
// @author       Krawwly
// @match        https://www.neopets.com/gallery/index.phtml*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // Only run on the "Item Remove Form" version of the gallery page
    const params = new URLSearchParams(window.location.search);
    if (params.get('dowhat') !== 'remove') return;

    const STYLES = `
        .gallery-remove-x {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 20px;
            height: 20px;
            background: #cc2200;
            color: white;
            border: 2px solid #881100;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            opacity: 0;
            transition: opacity 0.15s;
            padding: 0;
        }

        .gallery-img-wrapper {
            position: relative;
            display: inline-block;
        }

        .gallery-img-wrapper:hover .gallery-remove-x {
            opacity: 1;
        }
    `;

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    function getMaxSelectValue(select) {
        let maxVal = null;
        let maxOpt = null;
        for (const opt of select.options) {
            const val = parseInt(opt.value, 10);
            if (!isNaN(val) && (maxVal === null || val > maxVal)) {
                maxVal = val;
                maxOpt = opt.value;
            }
        }
        return maxOpt;
    }

    function addRemoveButtons() {
        const form = document.getElementById('gallery_form');
        if (!form) return;

        const itemImgs = Array.from(form.querySelectorAll('img.itemimg'));
        const allSelects = Array.from(form.querySelectorAll('select'));
        if (itemImgs.length === 0 || allSelects.length === 0) return;

        itemImgs.forEach((img, i) => {
            // Don't add twice
            if (img.parentElement.classList.contains('gallery-img-wrapper')) return;

            // Match by index — Nth image corresponds to Nth select
            const removeSelect = allSelects[i];
            if (!removeSelect) return;

            // Find the parent td (for item name lookup only)
            const td = img.closest('td');

            // Wrap the image so we can position the X button over it
            const wrapper = document.createElement('span');
            wrapper.className = 'gallery-img-wrapper';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);

            // Create X button
            const xBtn = document.createElement('button');
            xBtn.className = 'gallery-remove-x';
            xBtn.type = 'button';
            xBtn.title = 'Remove from gallery';
            xBtn.textContent = 'x';
            wrapper.appendChild(xBtn);

            xBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const itemName = td.querySelector('b')?.textContent?.trim() || 'this item';
                if (!confirm(`Remove ${itemName} from your gallery?`)) return;

                // Reset all other remove selects to their blank/0 option first
                form.querySelectorAll('select').forEach(sel => {
                    // Set to first option (usually blank "Qty" placeholder)
                    sel.selectedIndex = 0;
                });

                // Set this item's select to its max numeric value
                const maxVal = getMaxSelectValue(removeSelect);
                if (maxVal !== null) {
                    removeSelect.value = maxVal;
                } else {
                    // Fallback: just pick the last option
                    removeSelect.selectedIndex = removeSelect.options.length - 1;
                }

                // Make sure dowhat=remove is submitted — create the hidden input if it doesn't exist
                let doWhatInput = form.querySelector('input[name="dowhat"]');
                if (!doWhatInput) {
                    doWhatInput = document.createElement('input');
                    doWhatInput.type = 'hidden';
                    doWhatInput.name = 'dowhat';
                    form.appendChild(doWhatInput);
                }
                doWhatInput.value = 'remove';

                form.submit();
            });
        });
    }

    injectStyles();
    addRemoveButtons();
})();
