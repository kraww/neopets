// ==UserScript==
// @name         Neopets - Persistent Timer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Click the NST clock to set a countdown timer that persists while browsing Neopets
// @author       Krawwly
// @match        https://www.neopets.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'neo_timer';

    function getState() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
        catch { return {}; }
    }
    function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    function clearState() { localStorage.removeItem(STORAGE_KEY); }

    // ── Find the NST clock ──

    function findClock() {
        return document.querySelector('.nst.nav-top-nst') ||
               document.querySelector('.nav-top-nst') ||
               document.querySelector('#nst') ||
               [...document.querySelectorAll('div,span,td')].find(
                   el => el.children.length === 0 && /\d+:\d+.+NST/i.test(el.textContent)
               ) || null;
    }

    const clock = findClock();
    if (!clock) return;

    // ── Styles ──

    const style = document.createElement('style');
    style.textContent = `
        #neo-timer-hint {
            font-size: 10px;
            margin-left: 4px;
            vertical-align: middle;
        }
        #neo-timer-display {
            font-size: 11px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            color: rgba(255,255,255,0.35);
            background: rgba(0,0,0,0.15);
            border-radius: 3px;
            padding: 1px 6px;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            display: block;
            margin-top: 1px;
            letter-spacing: 0.5px;
        }
        #neo-timer-popup {
            position: fixed;
            background: #1a3a6b;
            border: 2px solid #FFD700;
            border-radius: 10px;
            padding: 12px 14px;
            z-index: 999999;
            display: none;
            box-shadow: 0 6px 20px rgba(0,0,0,0.5);
            font-family: Arial, sans-serif;
            min-width: 170px;
        }
    `;
    document.head.appendChild(style);

    // ── Hint icon and timer display ──

    const hint = document.createElement('span');
    hint.id = 'neo-timer-hint';
    hint.textContent = '⏱';
    hint.style.cssText = 'font-size:10px;margin-left:4px;vertical-align:middle;display:inline;';
    hint.style.setProperty('filter', 'grayscale(1) brightness(0)', 'important');

    const timerDisplay = document.createElement('div');
    timerDisplay.id = 'neo-timer-display';
    timerDisplay.title = 'Click to cancel timer';

    // timeRow holds the clock text + hint icon on one line.
    // timerDisplay sits below it as a second flex row.
    const timeRow = document.createElement('span');
    timeRow.id = 'neo-clock-timerow';
    timeRow.style.whiteSpace = 'nowrap';

    clock.style.cursor = 'pointer';
    clock.title = 'Click to set a timer';

    // The container that becomes a flex column.
    // For <td> we must use an inner wrapper — changing display on a td breaks the table.
    const container = document.createElement('div');
    container.id = 'neo-clock-container';
    container.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;line-height:normal;';

    // Called on load and whenever Neopets wipes the clock's content.
    function attachElements() {
        // Grab whatever text Neopets currently has in the clock
        const currentText = [...clock.childNodes]
            .filter(n => n !== container)
            .map(n => n.textContent)
            .join('');

        timeRow.textContent = currentText;
        timeRow.appendChild(hint);

        container.innerHTML = '';
        container.appendChild(timeRow);
        container.appendChild(timerDisplay);

        // Clear the clock and put our container in
        clock.textContent = '';
        clock.appendChild(container);

        if (clock.tagName !== 'TD') {
            // Match the clock div's original inline style so the nav doesn't shift
            clock.style.display = 'inline-block';
        }
    }

    attachElements();

    // Re-attach whenever Neopets overwrites the clock
    const observer = new MutationObserver(() => {
        if (clock.contains(container)) return; // already attached, ignore
        observer.disconnect();
        attachElements();
        observer.observe(clock, { childList: true });
    });
    observer.observe(clock, { childList: true });

    function positionDisplay() {} // no-op — display lives inside the clock

    // ── Popup ──

    const popup = document.createElement('div');
    popup.id = 'neo-timer-popup';
    popup.innerHTML = `
        <div style="color:#FFD700;font-weight:bold;font-size:12px;margin-bottom:8px;">Set Timer</div>
        <input id="neo-timer-input" type="text" placeholder="e.g. 2:00:00 or 5:30"
            style="width:100%;padding:5px 7px;border-radius:5px;border:1px solid #FFD700;
                   background:#0d2145;color:#fff;font-size:12px;box-sizing:border-box;outline:none;">
        <div style="font-size:10px;color:rgba(255,255,255,0.5);margin:4px 0 6px;">hh:mm:ss, mm:ss, or minutes</div>
        <input id="neo-timer-name" type="text" placeholder="Label (optional)" maxlength="10"
            style="width:100%;padding:5px 7px;border-radius:5px;border:1px solid rgba(255,215,0,0.4);
                   background:#0d2145;color:#fff;font-size:12px;box-sizing:border-box;outline:none;margin-bottom:8px;">
        <div style="display:flex;gap:6px;">
            <button id="neo-timer-start" style="flex:1;background:#FFD700;color:#1a3a6b;border:none;
                border-radius:5px;padding:5px;font-size:11px;font-weight:bold;cursor:pointer;">Start</button>
            <button id="neo-timer-stop" style="flex:1;background:transparent;color:#fff;
                border:1px solid rgba(255,255,255,0.4);border-radius:5px;padding:5px;
                font-size:11px;cursor:pointer;">Clear</button>
        </div>
    `;
    document.body.appendChild(popup);

    function showPopup() {
        const rect = clock.getBoundingClientRect();
        popup.style.top  = (rect.bottom + 6) + 'px';
        popup.style.left = rect.left + 'px';
        popup.style.display = 'block';
        setTimeout(() => document.getElementById('neo-timer-input').focus(), 50);
    }
    function hidePopup() { popup.style.display = 'none'; }

    // ── Helpers ──

    function parseInput(val) {
        val = val.trim();
        if (!val) return 0;
        if (val.includes(':')) {
            const parts = val.split(':').map(v => parseInt(v, 10) || 0);
            if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
            if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
        }
        return parseFloat(val) * 60 * 1000;
    }

    function formatMs(ms) {
        if (ms <= 0) return '00:00:00';
        const totalSec = Math.ceil(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    }

    // ── Flashing ──

    let flashInterval = null;

    function stopFlashing() {
        if (flashInterval) { clearInterval(flashInterval); flashInterval = null; }
        timerDisplay.style.background = 'rgba(0,0,0,0.15)';
        timerDisplay.style.color = 'rgba(255,255,255,0.3)';
        timerDisplay.textContent = '[00:00:00]';
    }

    function startFlashing() {
        if (flashInterval) return;
        let on = true;
        flashInterval = setInterval(() => {
            timerDisplay.style.background = on ? '#cc0000' : 'rgba(80,0,0,0.5)';
            on = !on;
        }, 350);
        setTimeout(() => {
            stopFlashing();
            clearState();
        }, 15000);
    }

    // ── Tick ──

    function tick() {
        const state = getState();
        if (!state.endTime) {
            if (!flashInterval) {
                timerDisplay.textContent = '[00:00:00]';
                timerDisplay.style.color = 'rgba(255,255,255,0.3)';
                timerDisplay.style.background = 'rgba(0,0,0,0.15)';
            }
            return;
        }
        const remaining = state.endTime - Date.now();
        positionDisplay();
        timerDisplay.style.display = 'block';
        if (remaining <= 0) {
            timerDisplay.textContent = '⏰ 00:00:00';
            clearState();
            startFlashing();
            return;
        }
        const label = state.name ? state.name + ' ' : '';
        timerDisplay.textContent = label + formatMs(remaining);
        timerDisplay.style.color = '#fff';
        timerDisplay.style.background = remaining < 30000
            ? 'rgba(180,40,0,0.8)'
            : 'rgba(0,0,0,0.5)';
    }

    setInterval(tick, 500);
    tick();

    // ── Events ──

    clock.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.style.display === 'none' ? showPopup() : hidePopup();
    });

    timerDisplay.addEventListener('click', (e) => {
        if (getState().endTime || flashInterval) {
            e.stopPropagation();
            if (confirm('Cancel the timer?')) {
                stopFlashing();
                clearState();
            }
        }
        // no active timer — let the click bubble up to clock to open the popup
    });

    document.addEventListener('click', hidePopup);
    popup.addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('neo-timer-start').addEventListener('click', () => {
        const input = document.getElementById('neo-timer-input');
        const ms = parseInput(input.value);
        if (!ms || isNaN(ms) || ms <= 0) {
            input.style.borderColor = '#cc0000';
            setTimeout(() => input.style.borderColor = '#FFD700', 800);
            return;
        }
        const nameInput = document.getElementById('neo-timer-name');
        const name = nameInput.value.trim().slice(0, 10);
        stopFlashing();
        saveState({ endTime: Date.now() + ms, name });
        input.value = '';
        nameInput.value = '';
        hidePopup();
        tick();
    });

    document.getElementById('neo-timer-stop').addEventListener('click', () => {
        stopFlashing();
        clearState();
        hidePopup();
    });

    document.getElementById('neo-timer-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  document.getElementById('neo-timer-start').click();
        if (e.key === 'Escape') hidePopup();
    });

})();
