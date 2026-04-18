// ==UserScript==
// @name         Neopets - Quick Pet Switcher
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds a pet switcher panel on Turmaculus, Symol Hole, and Fishing pages
// @author       Krawwly
// @match        https://www.neopets.com/medieval/turmaculus.phtml*
// @match        https://www.neopets.com/medieval/symolhole.phtml*
// @match        https://www.neopets.com/water/fishing.phtml*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CACHE_KEY = 'neopets_pet_names_cache';

    function getCached() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    }

    function setCache(names) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(names));
    }

    async function fetchPetNames() {
        const res = await fetch('https://www.neopets.com/home/', { credentials: 'include' });
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const nameplates = doc.querySelectorAll('[data-name].hp-carousel-nameplate');
        return [...nameplates].map(el => el.getAttribute('data-name')).filter(Boolean);
    }

    function buildPanel(pets) {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 40px;
            right: 20px;
            z-index: 99999;
            background: #fff;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 10px 14px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 160px;
        `;

        const label = document.createElement('div');
        label.textContent = 'Switch Active Pet';
        label.style.cssText = 'font-weight: bold; margin-bottom: 8px; font-size: 13px; color: #333;';
        panel.appendChild(label);

        const grid = document.createElement('div');
        grid.style.cssText = pets.length > 10
            ? 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;'
            : 'display: flex; flex-direction: column; gap: 6px;';
        panel.appendChild(grid);

        for (const name of pets) {
            const btn = document.createElement('button');
            btn.textContent = name;
            btn.style.cssText = `
                display: block;
                width: 100%;
                padding: 6px 10px;
                background: #f5f5f5;
                border: 1px solid #aaa;
                border-radius: 4px;
                cursor: pointer;
                text-align: left;
                font-size: 13px;
            `;
            btn.addEventListener('mouseenter', () => btn.style.background = '#e0e0e0');
            btn.addEventListener('mouseleave', () => btn.style.background = '#f5f5f5');
            btn.addEventListener('click', async () => {
                btn.textContent = '...';
                btn.disabled = true;
                await fetch(`https://www.neopets.com/process_changepet.phtml?new_active_pet=${encodeURIComponent(name)}`, {
                    credentials: 'include'
                });
                location.reload();
            });
            grid.appendChild(btn);
        }

        document.body.appendChild(panel);
    }

    async function init() {
        const cached = getCached();

        if (cached && cached.length) {
            // Show instantly from cache
            buildPanel(cached);
            // Refresh cache in background silently
            fetchPetNames().then(fresh => {
                if (fresh.length) setCache(fresh);
            }).catch(() => {});
        } else {
            // First ever load — fetch then show
            const names = await fetchPetNames();
            if (names.length) {
                setCache(names);
                buildPanel(names);
            }
        }
    }

    init();
})();
