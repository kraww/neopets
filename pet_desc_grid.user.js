// ==UserScript==
// @name         Neopets - Pet Description Grid
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Replaces the pet picker carousel on the description page with a compact grid
// @author       Krawwly
// @match        https://www.neopets.com/neopet_desc.phtml*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const css = `
        /* Hide prev/next arrows */
        #bxwrap .bx-controls {
            display: none !important;
        }

        /* Unlock the clipped viewport */
        #bxwrap .bx-viewport {
            overflow: visible !important;
            height: auto !important;
        }

        /* Replace the slider track with a grid */
        ul#bxlist {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)) !important;
            gap: 10px !important;
            width: 100% !important;
            transform: none !important;
            transition: none !important;
            position: static !important;
            padding: 0 !important;
        }

        /* Hide cloned slides */
        ul#bxlist li.bx-clone {
            display: none !important;
        }

        /* Real slides */
        ul#bxlist li {
            float: none !important;
            position: static !important;
            width: auto !important;
            margin: 0 !important;
            list-style: none !important;
            text-align: center !important;
            visibility: visible !important;
        }

        /* 50x50 square with full image centered inside */
        ul#bxlist li a img {
            display: block !important;
            width: 50px !important;
            height: 50px !important;
            object-fit: none !important;
            object-position: center !important;
            border: 1px solid #000 !important;
            margin: 0 auto !important;
        }

        /* Pet name label */
        ul#bxlist li a div {
            font-size: 11px !important;
            margin-top: 3px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // bxSlider sets aria-hidden="true" on non-visible slides — remove those
    function unhide() {
        const hidden = document.querySelectorAll('ul#bxlist li:not(.bx-clone)[aria-hidden="true"]');
        if (hidden.length === 0) return false;
        hidden.forEach(el => el.removeAttribute('aria-hidden'));
        return true;
    }

    let attempts = 0;
    const interval = setInterval(() => {
        if (unhide() || ++attempts > 20) clearInterval(interval);
    }, 300);

})();
