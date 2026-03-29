// ==UserScript==
// @name         Neopets - Pet Grid Layout
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Replaces the horizontal pet carousel on the home page with a grid
// @author       Krawwly
// @match        https://www.neopets.com/home/index.phtml*
// @match        https://www.neopets.com/home/
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const css = `
        /* Hide prev/next arrows */
        .hp-carousel-container .slick-arrow {
            display: none !important;
        }

        /* Remove the overflow clip on the slider viewport */
        .hp-carousel-container .slick-list {
            overflow: visible !important;
        }

        /* Replace the sliding track with a grid */
        .hp-carousel-container .slick-track {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important;
            gap: 8px !important;
            transform: none !important;
            width: 100% !important;
            float: none !important;
        }

        /* Make all real slides visible and block-level */
        .hp-carousel-container .slick-slide {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            float: none !important;
            width: auto !important;
            height: auto !important;
        }

        /* Hide cloned slides — must come AFTER .slick-slide rule to win specificity */
        .hp-carousel-container .slick-slide.slick-cloned,
        .hp-carousel-container .slick-slide[data-slick-index^="-"] {
            display: none !important;
        }

        /* Make the inner pet container fill its grid cell */
        .hp-carousel-pet-container {
            width: 100% !important;
        }

        /* Shrink the oversized name buttons */
        .hp-carousel-nameplate {
            padding: 4px 10px !important;
            margin-top: 6px !important;
            font-size: 14px !important;
        }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Slick also sets aria-hidden="true" on non-visible slides which can affect
    // rendering in some browsers — remove those attributes after the slider initializes.
    function unhideSlides() {
        const hidden = document.querySelectorAll('.hp-carousel-container .slick-slide[aria-hidden="true"]:not(.slick-cloned)');
        if (hidden.length === 0) return false;
        hidden.forEach(el => el.removeAttribute('aria-hidden'));
        return true;
    }

    // Slick initializes after page load, so poll briefly
    let attempts = 0;
    const interval = setInterval(() => {
        if (unhideSlides() || ++attempts > 20) clearInterval(interval);
    }, 300);

})();
