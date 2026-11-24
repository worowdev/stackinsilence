// ==========================================================================
// STACK IN SILENCE — Editorial Product Viewer with FLIP Animation & 360 Scrub
// ==========================================================================

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class ProductViewer {
  constructor(products, railEngine, cartManager) {
    this.products = products;
    this.railEngine = railEngine;
    this.cartManager = cartManager;

    this.currentIndex = 0;
    this.isOpen = false;
    this.selectedSize = 'L';
    this.showingFlat = false;

    // 360 Scrubbing & turntable physics
    this.currentFrame = 0;
    this.targetFrame = 0;
    this.isDragging = false;
    this.startX = 0;
    this.lastX = 0;
    this.dragVelocity = 0;
    this.inertiaRaf = null;

    // Tab rotation animation
    this.isTabRotating = false;
    this.tabAnimStart = 0;
    this.tabAnimDuration = 1400; // 50% slower, smooth front/back rotation
    this.tabStartFrame = 0;
    this.tabTargetDelta = 0;

    // Cache elements
    this.modal = document.getElementById('product-viewer');
    this.backdrop = document.getElementById('viewer-backdrop');
    this.closeBtn = document.getElementById('viewer-close');
    this.canvas = document.getElementById('viewer-canvas');
    this.ctx = this.canvas?.getContext('2d', { alpha: true });
    this.canvasWrap = document.getElementById('viewer-canvas-wrap');
    this.shadowEl = document.getElementById('viewer-shadow');
    this.counterEl = document.getElementById('viewer-counter');
    this.titleEl = document.getElementById('viewer-title');
    this.subtitleEl = document.getElementById('viewer-subtitle');
    this.priceEl = document.getElementById('viewer-price');
    this.skuEl = document.getElementById('viewer-sku');
    this.descEl = document.getElementById('viewer-desc');
    this.specsList = document.getElementById('viewer-specs-list');
    this.priceAddon = document.getElementById('btn-price-addon');
    this.addToBagBtn = document.getElementById('btn-add-to-bag');
    this.tabFront = document.getElementById('tab-front');
    this.tabBack = document.getElementById('tab-back');
    this.tabIndicator = document.getElementById('tab-indicator');
    this.prevBtn = document.getElementById('viewer-prev');
    this.nextBtn = document.getElementById('viewer-next');
    this.flatToggleBtn = document.getElementById('btn-toggle-flat');
    this.flatToggleText = document.getElementById('flat-toggle-text');
    this.flipProxy = document.getElementById('viewer-flip-proxy');

    this.initEvents();
  }

  initEvents() {
    // Open viewer when clicking any garment station on the rail
    this.products.forEach((_, idx) => {
      const station = document.getElementById(`garment-station-${idx}`);
      station?.addEventListener('click', () => this.open(idx, station));
    });

    // Close actions
    this.closeBtn?.addEventListener('click', () => this.close());
    this.backdrop?.addEventListener('click', () => this.close());

    // Navigation chevrons
    this.prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigate(-1);
    });
    this.nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigate(1);
    });

    // Front / Back view tabs
    this.tabFront?.addEventListener('click', () => this.rotateToKeyframe('front'));
    this.tabBack?.addEventListener('click', () => this.rotateToKeyframe('back'));

    // Size Selection
    const sizeOptions = document.getElementById('size-options');
    sizeOptions?.addEventListener('click', (e) => {
      const chip = e.target.closest('.size-chip');
      if (chip) {
        sizeOptions.querySelectorAll('.size-chip').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        chip.classList.add('selected');
        chip.setAttribute('aria-checked', 'true');
        this.selectedSize = chip.dataset.size;
      }
    });

    // Add to Bag Button
    this.addToBagBtn?.addEventListener('click', () => {
      const product = this.products[this.currentIndex];
      if (!product) return;

      this.cartManager.addItem(product.slug, this.selectedSize, 1);

      // Button feedback
      this.addToBagBtn.classList.add('added');
      setTimeout(() => {
        this.addToBagBtn.classList.remove('added');
      }, 1400);
    });

    // Fast Checkout Button
    document.getElementById('btn-fast-checkout')?.addEventListener('click', () => {
      const product = this.products[this.currentIndex];
      this.cartManager.addItem(product.slug, this.selectedSize, 1);
      this.close();
      this.cartManager.openCheckoutModal();
    });

    // Size Guide Drawer Trigger
    document.getElementById('btn-size-guide')?.addEventListener('click', () => {
      const sgModal = document.getElementById('size-guide-modal');
      sgModal?.classList.add('open');
      sgModal?.setAttribute('aria-hidden', 'false');
    });

    document.getElementById('size-guide-close')?.addEventListener('click', () => {
      const sgModal = document.getElementById('size-guide-modal');
      sgModal?.classList.remove('open');
      sgModal?.setAttribute('aria-hidden', 'true');
    });

    document.getElementById('size-guide-backdrop')?.addEventListener('click', () => {
      const sgModal = document.getElementById('size-guide-modal');
      sgModal?.classList.remove('open');
      sgModal?.setAttribute('aria-hidden', 'true');
    });

    // Flat Photo Toggle
    this.flatToggleBtn?.addEventListener('click', () => this.toggleFlatView());

    // 360 Drag Interaction
    this.setupDragScrub();

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.navigate(-1);
      if (e.key === 'ArrowRight') this.navigate(1);
    });
  }

  setupDragScrub() {
    if (!this.canvasWrap) return;

    const onPointerDown = (e) => {
      if (this.showingFlat) return;
      this.isDragging = true;
      this.isTabRotating = false;
      this.startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      this.lastX = this.startX;
      this.dragVelocity = 0;
      this.canvasWrap.classList.add('dragging');
      cancelAnimationFrame(this.inertiaRaf);
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const deltaX = currentX - this.lastX;
      this.lastX = currentX;

      // Sensitivity: ~4px drag = 1 frame
      const frameDelta = -deltaX / 3.8;
      this.currentFrame = ((this.currentFrame + frameDelta) % 150 + 150) % 150;
      this.dragVelocity = frameDelta;

      this.renderCurrentFrame();
      this.updateActiveTabIndicator();
    };

    const onPointerUp = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.canvasWrap.classList.remove('dragging');
      this.applyInertia();
    };

    this.canvasWrap.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvasWrap.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  }

  applyInertia() {
    if (Math.abs(this.dragVelocity) < 0.05) return;

    const step = () => {
      if (this.isDragging || this.isTabRotating) return;

      this.currentFrame = ((this.currentFrame + this.dragVelocity) % 150 + 150) % 150;
      this.dragVelocity *= 0.92; // friction
      this.renderCurrentFrame();
      this.updateActiveTabIndicator();

      if (Math.abs(this.dragVelocity) > 0.04) {
        this.inertiaRaf = requestAnimationFrame(step);
      }
    };
    this.inertiaRaf = requestAnimationFrame(step);
  }

  open(index, sourceEl) {
    this.currentIndex = index;
    this.isOpen = true;
    this.showingFlat = false;

    // Sync initial frame from rail
    const railSeq = this.railEngine.sequences[index];
    this.currentFrame = railSeq ? railSeq.currentFrame : 0;

    this.updateProductDetails();
    this.renderCurrentFrame();

    // FLIP Animation
    this.executeFLIP(sourceEl);

    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  executeFLIP(sourceEl) {
    if (!sourceEl || !this.flipProxy || !this.canvas) return;

    const startRect = sourceEl.getBoundingClientRect();
    const targetRect = this.canvas.getBoundingClientRect();

    const product = this.products[this.currentIndex];
    this.flipProxy.style.backgroundImage = `url(${product.stillUrl})`;
    this.flipProxy.style.display = 'block';
    this.flipProxy.style.top = `${startRect.top}px`;
    this.flipProxy.style.left = `${startRect.left}px`;
    this.flipProxy.style.width = `${startRect.width}px`;
    this.flipProxy.style.height = `${startRect.height}px`;
    this.flipProxy.style.opacity = '1';
    this.flipProxy.style.transition = 'all 520ms cubic-bezier(0.22, 1, 0.36, 1)';

    this.canvas.style.opacity = '0';

    requestAnimationFrame(() => {
      this.flipProxy.style.top = `${targetRect.top}px`;
      this.flipProxy.style.left = `${targetRect.left}px`;
      this.flipProxy.style.width = `${targetRect.width}px`;
      this.flipProxy.style.height = `${targetRect.height}px`;
    });

    setTimeout(() => {
      this.canvas.style.opacity = '1';
      this.flipProxy.style.display = 'none';
    }, 530);
  }

  close() {
    this.isOpen = false;
    cancelAnimationFrame(this.inertiaRaf);
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  navigate(dir) {
    this.currentIndex = (this.currentIndex + dir + this.products.length) % this.products.length;
    this.currentFrame = 0;
    this.showingFlat = false;
    this.updateProductDetails();
    this.renderCurrentFrame();
  }

  updateProductDetails() {
    const product = this.products[this.currentIndex];
    if (!product) return;

    if (this.counterEl) {
      this.counterEl.textContent = `0${this.currentIndex + 1} / 0${this.products.length}`;
    }
    if (this.titleEl) this.titleEl.textContent = product.name;
    if (this.subtitleEl) this.subtitleEl.textContent = product.subtitle;
    if (this.priceEl) this.priceEl.textContent = `${product.price} USD`;
    if (this.priceAddon) this.priceAddon.textContent = `— ${product.price}`;
    if (this.skuEl) this.skuEl.textContent = `SIS-D01-00${this.currentIndex + 1}`;
    if (this.descEl) this.descEl.textContent = product.description;

    if (this.specsList && product.details) {
      this.specsList.innerHTML = product.details.map(d => `<li>${d}</li>`).join('');
    }

    if (this.flatToggleText) {
      this.flatToggleText.textContent = 'View Studio Flat';
    }

    this.updateActiveTabIndicator();
  }

  renderCurrentFrame() {
    if (this.showingFlat) return;

    const seq = this.railEngine.sequences[this.currentIndex];
    if (!seq) return;

    const frame = seq.getNearestLoadedFrame(this.currentFrame);
    if (!frame || !this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);

    // Update shadow scale
    const product = this.products[this.currentIndex];
    if (this.shadowEl && product.projectedWidths && product.frontWidth) {
      const normIdx = Math.round(this.currentFrame) % 150;
      const projW = product.projectedWidths[normIdx] || product.frontWidth;
      const scale = (projW / product.frontWidth) * 0.95;
      this.shadowEl.style.setProperty('--shadow-scale', scale.toFixed(3));
    }
  }

  rotateToKeyframe(targetKey) {
    const product = this.products[this.currentIndex];
    if (!product || !product.keyframes) return;

    const targetFrameIdx = targetKey === 'front' ? 0 : product.keyframes.back - 1;
    this.isDragging = false;
    cancelAnimationFrame(this.inertiaRaf);

    // Find shortest angular path around 150 frames
    const current = ((this.currentFrame % 150) + 150) % 150;
    let delta = targetFrameIdx - current;
    if (delta > 75) delta -= 150;
    if (delta < -75) delta += 150;

    this.isTabRotating = true;
    this.tabAnimStart = performance.now();
    this.tabStartFrame = current;
    this.tabTargetDelta = delta;

    const step = (now) => {
      if (!this.isTabRotating) return;
      const elapsed = now - this.tabAnimStart;
      const progress = Math.min(1, elapsed / this.tabAnimDuration);
      const eased = easeInOutCubic(progress);

      this.currentFrame = ((this.tabStartFrame + eased * this.tabTargetDelta) % 150 + 150) % 150;
      this.renderCurrentFrame();
      this.updateActiveTabIndicator();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.isTabRotating = false;
        this.currentFrame = targetFrameIdx;
        this.renderCurrentFrame();
        this.updateActiveTabIndicator();
      }
    };
    requestAnimationFrame(step);
  }

  updateActiveTabIndicator() {
    const product = this.products[this.currentIndex];
    if (!product || !product.keyframes) return;

    const backIdx = product.keyframes.back - 1;
    const current = ((Math.round(this.currentFrame) % 150) + 150) % 150;

    // Determine whether closer to front (0) or back (backIdx)
    const distToFront = Math.min(current, 150 - current);
    const distToBack = Math.abs(current - backIdx);

    const isBackActive = distToBack < distToFront;

    if (this.tabFront && this.tabBack && this.tabIndicator) {
      if (isBackActive) {
        this.tabBack.classList.add('active');
        this.tabBack.setAttribute('aria-selected', 'true');
        this.tabFront.classList.remove('active');
        this.tabFront.setAttribute('aria-selected', 'false');
        this.tabIndicator.style.transform = 'translateX(100%)';
      } else {
        this.tabFront.classList.add('active');
        this.tabFront.setAttribute('aria-selected', 'true');
        this.tabBack.classList.remove('active');
        this.tabBack.setAttribute('aria-selected', 'false');
        this.tabIndicator.style.transform = 'translateX(0)';
      }
    }
  }

  toggleFlatView() {
    this.showingFlat = !this.showingFlat;
    const product = this.products[this.currentIndex];
    if (!product) return;

    if (this.showingFlat) {
      // Determine front vs back flat photo
      const isBackActive = this.tabBack?.classList.contains('active');
      const side = isBackActive ? 'back' : 'front';
      const flatImgUrl = `/assets/flats/${product.slug}-${side}.jpg`;

      const img = new Image();
      img.src = flatImgUrl;
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      };
      if (this.flatToggleText) this.flatToggleText.textContent = 'View 3D Turntable';
    } else {
      if (this.flatToggleText) this.flatToggleText.textContent = 'View Studio Flat';
      this.renderCurrentFrame();
    }
  }
}
