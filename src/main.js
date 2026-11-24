// ==========================================================================
// STACK IN SILENCE — Main Application Bootstrap
// ==========================================================================

import { RailEngine } from './engine.js';
import { ProductViewer } from './viewer.js';
import { CartManager } from './cart.js';

async function initStorefront() {
  try {
    // 1. Load product data
    const response = await fetch('/products.json');
    const data = await response.json();
    const products = data.products;

    // 2. Initialize commerce & cart
    const cartManager = new CartManager(products);

    // 3. Initialize rail sequence engine
    const railEngine = new RailEngine(products);
    window.railEngine = railEngine;

    // 4. Initialize product viewer modal
    const viewer = new ProductViewer(products, railEngine, cartManager);

    // 5. Setup drawer dialogs and catalog
    initCatalogDrawer(products, viewer, cartManager);
    initMenuDrawer(viewer);

    // 6. Connect viewer footer "View in the shop →" button
    document.getElementById('viewer-shop-link')?.addEventListener('click', () => {
      viewer.close();
      openCatalogDrawer();
    });

    document.getElementById('btn-shop-toggle')?.addEventListener('click', openCatalogDrawer);
    document.getElementById('btn-quick-catalog')?.addEventListener('click', openCatalogDrawer);

    console.log('Stack In Silence Storefront initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize storefront:', err);
  }
}

function openCatalogDrawer() {
  const drawer = document.getElementById('catalog-drawer');
  drawer?.classList.add('open');
  drawer?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCatalogDrawer() {
  const drawer = document.getElementById('catalog-drawer');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function initCatalogDrawer(products, viewer, cartManager) {
  const drawer = document.getElementById('catalog-drawer');
  const closeBtn = document.getElementById('catalog-close');
  const backdrop = document.getElementById('catalog-backdrop');
  const grid = document.getElementById('catalog-grid');

  closeBtn?.addEventListener('click', closeCatalogDrawer);
  backdrop?.addEventListener('click', closeCatalogDrawer);

  if (!grid) return;

  grid.innerHTML = products.map((p, idx) => `
    <div class="catalog-card" data-index="${idx}">
      <img class="catalog-card-img" src="${p.stillUrl}" alt="${p.name}" />
      <div class="catalog-card-info">
        <div>
          <div class="catalog-card-title">${p.name}</div>
          <div class="catalog-card-subtitle">${p.subtitle}</div>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
          <div class="catalog-card-price">${p.price}</div>
          <button class="nav-btn quick-buy-btn" data-slug="${p.slug}" style="padding: 4px 12px; font-size: 11px;">
            Quick Add
          </button>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.catalog-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.quick-buy-btn')) return;
      const idx = parseInt(card.dataset.index, 10);
      closeCatalogDrawer();
      const station = document.getElementById(`garment-station-${idx}`);
      viewer.open(idx, station);
    });
  });

  grid.querySelectorAll('.quick-buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      cartManager.addItem(slug, 'L', 1);
      btn.textContent = 'Added ✓';
      setTimeout(() => {
        btn.textContent = 'Quick Add';
      }, 1200);
    });
  });
}

function initMenuDrawer(viewer) {
  const menuBtn = document.getElementById('btn-menu');
  const menuDrawer = document.getElementById('menu-drawer');
  const menuClose = document.getElementById('menu-close');
  const menuBackdrop = document.getElementById('menu-backdrop');

  const openMenu = () => {
    menuDrawer.classList.add('open');
    menuDrawer.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    menuDrawer.classList.remove('open');
    menuDrawer.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  menuBtn?.addEventListener('click', openMenu);
  menuClose?.addEventListener('click', closeMenu);
  menuBackdrop?.addEventListener('click', closeMenu);

  document.getElementById('menu-link-collection')?.addEventListener('click', () => {
    closeMenu();
    openCatalogDrawer();
  });

  document.getElementById('menu-link-stills')?.addEventListener('click', () => {
    closeMenu();
    viewer.open(0, document.getElementById('garment-station-0'));
  });

  document.getElementById('menu-link-sizing')?.addEventListener('click', () => {
    closeMenu();
    const sgModal = document.getElementById('size-guide-modal');
    sgModal?.classList.add('open');
    sgModal?.setAttribute('aria-hidden', 'false');
  });

  document.getElementById('menu-link-demo')?.addEventListener('click', () => {
    closeMenu();
    alert('Stack In Silence Storefront Specification: Vanilla JS ES Modules, HTML5 Canvas, WebP frame sequences, fluid CSS tokens, zero framework lock-in.');
  });
}

// Start when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStorefront);
} else {
  initStorefront();
}
