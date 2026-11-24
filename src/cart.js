// ==========================================================================
// STACK IN SILENCE — Persistent Cart & Commerce Engine
// ==========================================================================

const CART_STORAGE_KEY = 'sis_cart_v1';
const FREE_SHIPPING_THRESHOLD = 150.00;

export class CartManager {
  constructor(products) {
    this.products = products;
    this.items = this.loadCart();
    this.listeners = [];
    this.initUI();
  }

  loadCart() {
    try {
      const data = localStorage.getItem(CART_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('LocalStorage inaccessible, using session memory:', e);
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.warn('Failed to persist cart to storage:', e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.items);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.items);
    }
  }

  addItem(slug, size = 'L', quantity = 1) {
    const product = this.products.find(p => p.slug === slug);
    if (!product) return;

    const existingIndex = this.items.findIndex(
      item => item.slug === slug && item.size === size
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        slug: product.slug,
        name: product.name,
        subtitle: product.subtitle,
        priceNumber: product.priceNumber,
        priceFormatted: product.price,
        size: size,
        quantity: quantity,
        stillUrl: product.stillUrl
      });
    }

    this.saveCart();
  }

  updateQuantity(index, delta) {
    if (this.items[index]) {
      this.items[index].quantity += delta;
      if (this.items[index].quantity <= 0) {
        this.items.splice(index, 1);
      }
      this.saveCart();
    }
  }

  removeItem(index) {
    if (this.items[index]) {
      this.items.splice(index, 1);
      this.saveCart();
    }
  }

  clear() {
    this.items = [];
    this.saveCart();
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce(
      (sum, item) => sum + item.priceNumber * item.quantity,
      0
    );
  }

  initUI() {
    const cartBtn = document.getElementById('btn-cart');
    const cartDrawer = document.getElementById('cart-drawer');
    const cartClose = document.getElementById('cart-close');
    const cartBackdrop = document.getElementById('cart-backdrop');
    const clearBtn = document.getElementById('btn-clear-cart');
    const checkoutBtn = document.getElementById('btn-checkout');

    const openCart = () => {
      cartDrawer.classList.add('open');
      cartDrawer.setAttribute('aria-hidden', 'false');
      cartBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };

    const closeCart = () => {
      cartDrawer.classList.remove('open');
      cartDrawer.setAttribute('aria-hidden', 'true');
      cartBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    cartBtn?.addEventListener('click', openCart);
    cartClose?.addEventListener('click', closeCart);
    cartBackdrop?.addEventListener('click', closeCart);

    clearBtn?.addEventListener('click', () => {
      this.clear();
    });

    checkoutBtn?.addEventListener('click', () => {
      closeCart();
      this.openCheckoutModal();
    });

    this.subscribe(() => this.renderCartUI());
  }

  renderCartUI() {
    const badge = document.getElementById('cart-badge');
    const countTitle = document.getElementById('cart-count-title');
    const itemsContainer = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const shippingFill = document.getElementById('shipping-progress-fill');
    const shippingText = document.getElementById('shipping-text');
    const footer = document.getElementById('cart-footer');

    const count = this.getItemCount();
    const subtotal = this.getSubtotal();

    if (badge) badge.textContent = count;
    if (countTitle) countTitle.textContent = `${count} item${count === 1 ? '' : 's'}`;
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)} USD`;

    // Free shipping threshold calculations
    if (shippingFill && shippingText) {
      if (subtotal >= FREE_SHIPPING_THRESHOLD) {
        shippingFill.style.width = '100%';
        shippingText.textContent = '✓ You unlocked Free Worldwide Express Delivery!';
      } else {
        const remaining = (FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2);
        const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
        shippingFill.style.width = `${pct}%`;
        shippingText.textContent = `Add $${remaining} more for Free Worldwide Express Delivery`;
      }
    }

    if (!itemsContainer) return;

    if (this.items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="cart-empty-state">
          <h3 class="cart-empty-title">Your Bag is Empty</h3>
          <p class="cart-empty-subtitle">Explore the garments hanging on the studio rail to begin.</p>
        </div>
      `;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';

    itemsContainer.innerHTML = this.items.map((item, idx) => `
      <div class="cart-item-row" data-index="${idx}">
        <img class="cart-item-thumb" src="${item.stillUrl}" alt="${item.name}" />
        <div class="cart-item-info">
          <div>
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-variant">Size: ${item.size}</div>
          </div>
          <div class="cart-item-bottom">
            <div class="qty-control">
              <button class="qty-btn" data-action="dec" data-index="${idx}" aria-label="Decrease quantity">−</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn" data-action="inc" data-index="${idx}" aria-label="Increase quantity">+</button>
            </div>
            <div class="cart-item-price">$${(item.priceNumber * item.quantity).toFixed(2)}</div>
          </div>
        </div>
      </div>
    `).join('');

    // Attach quantity event handlers
    itemsContainer.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index, 10);
        const action = btn.dataset.action;
        this.updateQuantity(idx, action === 'inc' ? 1 : -1);
      });
    });
  }

  openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    const closeBtn = document.getElementById('checkout-close');
    const backdrop = document.getElementById('checkout-backdrop');
    const summaryBox = document.getElementById('checkout-order-summary');
    const confirmBtn = document.getElementById('btn-complete-demo-order');

    if (!modal) return;

    const subtotal = this.getSubtotal();
    const count = this.getItemCount();

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 8px;">Order Details (${count} items)</div>
        ${this.items.map(item => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; opacity: 0.9;">
            <span>${item.name} (${item.size}) × ${item.quantity}</span>
            <span style="font-family: var(--font-mono);">$${(item.priceNumber * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
        <div style="border-top: 1px solid rgba(67, 44, 31, 0.15); margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-weight: 700;">
          <span>Total Demo Amount</span>
          <span style="font-family: var(--font-mono); font-size: 14px;">$${subtotal.toFixed(2)} USD</span>
        </div>
      `;
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    const closeModal = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    };

    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        alert('Demo order placed successfully! In production, this forwards directly to your Shopify checkout checkout_url.');
        this.clear();
        closeModal();
      };
    }
  }
}
