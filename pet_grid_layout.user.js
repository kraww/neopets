// ==UserScript==
// @name         Neopets - Pet Grid Layout
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Replaces the horizontal pet carousel on the home page with a grid
// @author       Krawwly
// @match        https://www.neopets.com/home/index.phtml*
// @match        https://www.neopets.com/home/
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        #krawwly-pet-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 10px;
            padding: 10px 0;
            width: 100%;
        }
        .krawwly-pet-cell {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            cursor: pointer;
        }
        .krawwly-pet-img {
            width: 140px;
            height: 140px;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center bottom;
        }
        /* Shrink the cloned nameplate to match the pet cell size */
        .krawwly-pet-cell .hp-carousel-nameplate {
            margin-top: 5px;
            padding: 3px 10px !important;
            font-size: 14px !important;
            width: auto !important;
            max-width: 120px !important;
            min-width: unset !important;
        }
    `;
    document.head.appendChild(style);

    function buildGrid() {
        // Grab all real (non-cloned) pet containers from Slick
        const containers = Array.from(
            document.querySelectorAll('.hp-carousel-container .slick-slide:not(.slick-cloned) .hp-carousel-pet-container')
        );
        if (containers.length === 0) return false;

        // Find where to insert — right after the carousel container
        const carousel = document.querySelector('.hp-carousel-container');
        if (!carousel) return false;

        // Don't build twice
        if (document.getElementById('krawwly-pet-grid')) return true;

        const grid = document.createElement('div');
        grid.id = 'krawwly-pet-grid';

        containers.forEach(container => {
            const petDiv      = container.querySelector('.hp-carousel-pet');
            const nameplateEl = container.querySelector('.hp-carousel-nameplate');
            if (!petDiv) return;

            const bgImage = petDiv.style.backgroundImage;
            const onclick = petDiv.getAttribute('onclick') || '';

            const cell = document.createElement('div');
            cell.className = 'krawwly-pet-cell';
            if (onclick) cell.setAttribute('onclick', onclick);

            // Copy all data-* attributes so any Neopets JS that reads them still works
            Array.from(petDiv.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) cell.setAttribute(attr.name, attr.value);
            });

            const img = document.createElement('div');
            img.className = 'krawwly-pet-img';
            img.style.backgroundImage = bgImage;

            cell.appendChild(img);

            // Clone the original nameplate so it keeps all Neopets styling
            if (nameplateEl) cell.appendChild(nameplateEl.cloneNode(true));

            grid.appendChild(cell);
        });

        // Hide the original carousel, insert our grid in its place
        carousel.style.display = 'none';
        carousel.parentNode.insertBefore(grid, carousel.nextSibling);
        return true;
    }

    let attempts = 0;
    const interval = setInterval(() => {
        if (buildGrid() || ++attempts > 20) clearInterval(interval);
    }, 300);

})();
