// ==UserScript==
// @name         Neopets - Dice-A-Roo Fixed Roll Button
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Pins "Roll Again" to a fixed spot on screen so you can spam-click without moving your mouse
// @author       Krawwly
// @match        https://www.neopets.com/games/play_dicearoo.phtml*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Fixed position on screen where the Roll Again button will always appear
    const FIXED_X = 40;  // px from left edge of viewport
    const FIXED_Y = 40;  // px from top edge of viewport

    function addFixedButton() {
        // Don't add twice
        if (document.getElementById('dar-fixed-roll')) return;

        // Find the real Roll Again button on the page
        const realBtn = [...document.querySelectorAll('input[type=submit], button')]
            .find(el => el.value?.includes('Roll Again') || el.textContent?.includes('Roll Again'));

        if (!realBtn) return;

        const btn = document.createElement('button');
        btn.id = 'dar-fixed-roll';
        btn.textContent = 'Roll Again';
        btn.style.cssText = `
            position: fixed;
            left: ${FIXED_X}px;
            top: ${FIXED_Y}px;
            z-index: 99999;
            padding: 14px 28px;
            font-size: 18px;
            font-weight: bold;
            background: #c00;
            color: #fff;
            border: 3px solid #800;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            user-select: none;
        `;

        btn.addEventListener('mousedown', e => e.preventDefault()); // prevent focus shift
        btn.addEventListener('click', () => {
            // Click the real page button so the form submits normally
            const current = [...document.querySelectorAll('input[type=submit], button')]
                .find(el => el.value?.includes('Roll Again') || el.textContent?.includes('Roll Again'));
            if (current) current.click();
        });

        document.body.appendChild(btn);
    }

    // Run on load and after each page update (Dice-A-Roo reloads the page on each roll,
    // so DOMContentLoaded is enough — but we also watch for any dynamic injection)
    addFixedButton();

    const observer = new MutationObserver(addFixedButton);
    observer.observe(document.body, { childList: true, subtree: true });
})();
