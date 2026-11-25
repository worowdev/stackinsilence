// ==========================================================================
// STACK IN SILENCE — Cinematic Editorial Product Viewer (web_demo_2.mp4)
// Driven by single master progress value t in [0, 1] with FLIP morph & 90f scrub
// ==========================================================================

const TURN_MS = 800; // ms for Front <-> Back 180° half-turn (editorial glide)
const OPEN_MS = 600; // ms for open morph
const CLOSE_MS = 480; // ms for reverse close morph

function cubicBezier(t) {
  // Cubic-bezier approximation for (.22, 1, .36, 1)
  const c1 = 1.75;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export class ProductViewer {
  constructor(products, railEngine, cartManager) {
    this.products = products;
    this.railEngine = railEngine;
    this.cartManager = cartManager;

    this.currentIndex = 0;
    this.state = 'HOME'; // 'HOME' | 'OPENING' | 'VIEWER' | 'CLOSING'
    this.t = 0; // Master progress value in [0, 1]
    this.tweenRaf = null;
    this.lastTimestamp = 0;

    // Playhead float p in [1, 90]
    this.p = 1.0;
    this.targetP = 1.0;
    this.isTurning = false;
    this.turnStartTime = 0;
    this.turnStartP = 1.0;
    this.turnDistance = 0;
    this.turnDuration = TURN_MS;

    // Drag interaction
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragLastX = 0;
    this.dragVelocity = 0;
    this.dragStartP = 1.0;
    this.inertiaRaf = null;

    // Cache of decoded image frames per garment
    // { [slug]: { frames: Array(90), loadedCount: 0, lastAccessed: timestamp } }
    this.frameCache = {};
    this.products.forEach(p => {
      this.frameCache[p.slug] = {
        frames: new Array(90).fill(null),
        loadedCount: 0,
        lastAccessed: 0
      };
      // Preload still image as instant fallback
      p.stillImg = new Image();
      p.stillImg.src = p.stillUrl;
    });

    // Morph measurements
    this.sourceRect = null;
    this.targetRect = null;
    this.sourceEl = null;

    // Idle memory release timer
    this.idleTimer = setInterval(() => this.cleanupIdleBitmaps(), 10000);

    // Cache DOM elements
    this.cacheElements();
    this.initEvents();

    // Prefetch viewer frames on hover intent
    this.setupHoverPrefetch();

    // Eagerly preload front (frame 0) and back (frame 89) for all garments
    // (Only 6 lightweight WebP frames total ~180KB, guarantees zero-blank start)
    this.products.forEach(p => {
      this.loadSingleFrame(p.slug, 0);
      this.loadSingleFrame(p.slug, 89);
    });
  }

  cacheElements() {
    this.modal = document.getElementById('product-viewer');
    this.backdrop = document.getElementById('viewer-backdrop');
    this.layer = document.getElementById('viewer-layer');
    this.headerRow = document.getElementById('viewer-header-row');
    this.counterEl = document.getElementById('viewer-counter');
    this.closeBtn = document.getElementById('viewer-close');
    this.centerStage = document.getElementById('viewer-center-stage');
    this.metaStack = document.getElementById('viewer-meta-stack');
    this.prevBtn = document.getElementById('viewer-prev');
    this.nextBtn = document.getElementById('viewer-next');
    this.titleGroup = document.getElementById('viewer-title-group');
    this.titleEl = document.getElementById('viewer-title');
    this.subtitleEl = document.getElementById('viewer-subtitle');
    this.canvasWrap = document.getElementById('viewer-canvas-wrap');
    this.canvas = document.getElementById('viewer-canvas');
    this.ctx = this.canvas?.getContext('2d', { alpha: true });
    this.morphStill = document.getElementById('viewer-morph-still');
    this.shadowEl = document.getElementById('viewer-shadow');
    this.tabsWrap = document.getElementById('viewer-tabs-wrap');
    this.tabFront = document.getElementById('tab-front');
    this.tabBack = document.getElementById('tab-back');
    this.tabLine = document.getElementById('viewer-tab-line');
    this.footerRow = document.getElementById('viewer-footer-row');
    this.shopLink = document.getElementById('viewer-shop-link');

    // Main page headers and marquee to fade out
    this.siteHeader = document.querySelector('.site-header');
    this.marqueeStrip = document.querySelector('.marquee-strip');
    this.wordmarkContainer = document.querySelector('.stage-wordmark-container');
    this.stageFooterOverlay = document.querySelector('.stage-footer-overlay');
  }

  initEvents() {
    // Rail garment station click -> calls openViewer(slug) per spec
    this.products.forEach((product, idx) => {
      const station = document.getElementById(`garment-station-${idx}`);
      station?.addEventListener('click', () => {
        if (typeof window.openViewer === 'function') {
          window.openViewer(product.slug);
        } else {
          this.open(idx, station);
        }
      });
    });

    // Close actions
    this.closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
    this.backdrop?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Front / Back view tabs
    this.tabFront?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.turnToKeyframe('front');
    });
    this.tabBack?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.turnToKeyframe('back');
    });

    // Chevrons
    this.prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateProduct(-1);
    });
    this.nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateProduct(1);
    });

    // "View in the shop ->"
    this.shopLink?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
      const openCatalog = window.openCatalogDrawer;
      if (typeof openCatalog === 'function') openCatalog();
    });

    // Drag scrubbing on garment
    this.setupDragScrub();

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (this.state === 'HOME') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigateProduct(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateProduct(1);
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (e.target === this.canvas || e.target === this.canvasWrap) {
          e.preventDefault();
          this.toggleFrontBack();
        }
      }
    });

    // Browser back/forward navigation (deep links)
    window.addEventListener('popstate', (e) => {
      const hash = window.location.hash.replace('#', '');
      if (!hash && (this.state === 'VIEWER' || this.state === 'OPENING')) {
        this.close(false); // don't push history
      } else if (hash) {
        const prodIdx = this.products.findIndex(p => p.slug === hash);
        if (prodIdx !== -1 && this.state === 'HOME') {
          this.open(prodIdx, null, false);
        }
      }
    });

    // Window resize handling
    window.addEventListener('resize', () => {
      // Keep canvas and layout responsive
    });
  }

  setupHoverPrefetch() {
    this.products.forEach((product, idx) => {
      const station = document.getElementById(`garment-station-${idx}`);
      station?.addEventListener('pointerenter', () => {
        // Prefetch viewer sequence on hover intent
        this.prefetchSequence(product.slug);
      }, { passive: true });
    });
  }

  // ==========================================================================
  // Frame Loading & Decoding Pipeline
  // ==========================================================================
  async prefetchSequence(slug) {
    const cache = this.frameCache[slug];
    if (!cache) return;
    cache.lastAccessed = Date.now();

    const product = this.products.find(p => p.slug === slug);
    const sideIdx = (product?.viewer?.side ? product.viewer.side - 1 : 45);

    // Pass 1: Critical Keyframes (Front: 0, Back: 89, Side: sideIdx)
    const critical = [0, 89, sideIdx];
    await Promise.all(critical.map(idx => this.loadSingleFrame(slug, idx)));

    // Pass 2: Every 3rd frame (dense quick scrub)
    const pass2 = [];
    for (let i = 0; i < 90; i += 3) {
      if (!critical.includes(i)) pass2.push(i);
    }
    await Promise.all(pass2.map(idx => this.loadSingleFrame(slug, idx)));

    // Pass 3: Remaining frames in chunks
    const pass3 = [];
    for (let i = 0; i < 90; i++) {
      if (!cache.frames[i]) pass3.push(i);
    }

    const loadChunk = (start) => {
      const chunk = pass3.slice(start, start + 10);
      if (chunk.length === 0) return;
      Promise.all(chunk.map(idx => this.loadSingleFrame(slug, idx))).then(() => {
        if (start + 10 < pass3.length) {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => loadChunk(start + 10));
          } else {
            setTimeout(() => loadChunk(start + 10), 20);
          }
        }
      });
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loadChunk(0));
    } else {
      setTimeout(() => loadChunk(0), 40);
    }
  }

  loadSingleFrame(slug, index) {
    const cache = this.frameCache[slug];
    if (!cache) return Promise.resolve(null);
    if (cache.frames[index]) return Promise.resolve(cache.frames[index]);

    const frameNum = String(index + 1).padStart(4, '0');
    const url = `/assets/viewer/${slug}/${frameNum}.webp`;

    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;

      const onLoaded = (frameObj) => {
        cache.frames[index] = frameObj;
        cache.loadedCount++;
        // If this frame belongs to the currently active garment and viewer is open, re-render
        if (this.products[this.currentIndex]?.slug === slug && this.state !== 'HOME') {
          this.renderCanvas(this.p);
        }
        resolve(frameObj);
      };

      img.onload = () => {
        if ('createImageBitmap' in window) {
          createImageBitmap(img).then(bmp => onLoaded(bmp)).catch(() => onLoaded(img));
        } else {
          onLoaded(img);
        }
      };
      img.onerror = () => resolve(null);
    });
  }

  getNearestLoadedFrame(slug, index) {
    const cache = this.frameCache[slug];
    if (!cache) return null;
    const norm = clamp(Math.round(index) - 1, 0, 89);
    if (cache.frames[norm]) return cache.frames[norm];

    // Search outwards for closest loaded frame across the entire 0-89 range
    for (let offset = 1; offset < 90; offset++) {
      const left = norm - offset;
      if (left >= 0 && cache.frames[left]) return cache.frames[left];
      const right = norm + offset;
      if (right < 90 && cache.frames[right]) return cache.frames[right];
    }
    return cache.frames[0]; // fallback
  }

  cleanupIdleBitmaps() {
    const now = Date.now();
    const activeSlug = this.products[this.currentIndex]?.slug;

    this.products.forEach(p => {
      if (p.slug === activeSlug) return;
      const cache = this.frameCache[p.slug];
      if (cache && cache.loadedCount > 0 && (now - cache.lastAccessed > 20000)) {
        // Release decoded bitmaps to stay well under the 120MB memory budget
        cache.frames.fill(null);
        cache.loadedCount = 0;
      }
    });
  }

  // ==========================================================================
  // Dual-Frame Canvas Renderer (p in [1, 90])
  // ==========================================================================
  renderCanvas(p) {
    if (!this.ctx || !this.canvas) return;
    const product = this.products[this.currentIndex];
    if (!product) return;

    const cache = this.frameCache[product.slug];
    if (cache) cache.lastAccessed = Date.now();

    const clampedP = clamp(p, 1.0, 90.0);
    const f1Idx = Math.floor(clampedP);
    const f2Idx = Math.min(90, Math.ceil(clampedP));
    const fraction = clampedP - f1Idx;

    const frame1 = this.getNearestLoadedFrame(product.slug, f1Idx);
    const frame2 = (f2Idx !== f1Idx) ? this.getNearestLoadedFrame(product.slug, f2Idx) : null;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (frame1) {
      if (frame2 && fraction > 0.02 && fraction < 0.98) {
        // Cross-blend two adjacent frames for 60fps liquid sub-frame interpolation
        this.ctx.globalAlpha = 1.0 - fraction;
        this.ctx.drawImage(frame1, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = fraction;
        this.ctx.drawImage(frame2, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1.0;
      } else {
        const activeFrame = (fraction >= 0.5 && frame2) ? frame2 : frame1;
        this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(activeFrame, 0, 0, this.canvas.width, this.canvas.height);
      }
    } else if (product.stillImg && product.stillImg.complete) {
      // Seamless fallback to crisp front still while sequence is decoding
      this.ctx.globalAlpha = 1.0;
      this.ctx.drawImage(product.stillImg, 0, 0, this.canvas.width, this.canvas.height);
    }

    // Dynamic Floor Shadow Scaling based on per-frame projected width
    this.updateFloorShadow(clampedP);

    // Live Tab Underline & aria-selected tracking
    this.updateTabIndicator(clampedP);
  }

  updateFloorShadow(p) {
    if (!this.shadowEl) return;
    const product = this.products[this.currentIndex];
    const viewerData = product?.viewer;
    if (!viewerData || !viewerData.widths) return;

    const normIdx = clamp(Math.round(p) - 1, 0, 89);
    const projW = viewerData.widths[normIdx] || viewerData.frontWidth;
    const scale = (projW / viewerData.frontWidth) * 0.96;
    this.shadowEl.style.setProperty('--shadow-scale', scale.toFixed(3));
  }

  updateTabIndicator(p) {
    if (!this.tabLine || !this.tabFront || !this.tabBack) return;
    const norm = (p - 1.0) / 89.0; // 0.0 at Front, 1.0 at Back

    // Calculate indicator position
    const frontRect = this.tabFront.getBoundingClientRect();
    const backRect = this.tabBack.getBoundingClientRect();
    const parentRect = this.tabFront.parentElement.getBoundingClientRect();

    const startX = frontRect.left - parentRect.left;
    const startW = frontRect.width;
    const endX = backRect.left - parentRect.left;
    const endW = backRect.width;

    const currentX = startX + (endX - startX) * norm;
    const currentW = startW + (endW - startW) * norm;

    this.tabLine.style.transform = `translate3d(${currentX.toFixed(1)}px, 0, 0)`;
    this.tabLine.style.width = `${currentW.toFixed(1)}px`;

    if (norm < 0.5) {
      this.tabFront.classList.add('active');
      this.tabBack.classList.remove('active');
      this.tabFront.setAttribute('aria-selected', 'true');
      this.tabBack.setAttribute('aria-selected', 'false');
    } else {
      this.tabFront.classList.remove('active');
      this.tabBack.classList.add('active');
      this.tabFront.setAttribute('aria-selected', 'false');
      this.tabBack.setAttribute('aria-selected', 'true');
    }
  }

  // ==========================================================================
  // Master Progress Tween (t in [0, 1])
  // ==========================================================================
  applyMasterProgress(t) {
    this.t = t;
    const easedT = cubicBezier(t);

    // 1. Fixed blur backdrop wash (opacity only, never animate blur radius)
    // Over 0 to 450ms (t in [0, 0.75])
    const backdropOpacity = clamp(t / 0.75, 0, 1);
    if (this.backdrop) {
      this.backdrop.style.opacity = backdropOpacity.toFixed(3);
    }

    // 2. Main page header and marquee fade out (0 to 120ms, t in [0, 0.20])
    const mainPageOpacity = clamp(1 - (t / 0.20), 0, 1);
    const mainPageShiftY = -8 * (1 - mainPageOpacity);
    if (this.siteHeader) {
      this.siteHeader.style.opacity = mainPageOpacity.toFixed(3);
      this.siteHeader.style.transform = `translate3d(0, ${mainPageShiftY.toFixed(1)}px, 0)`;
      this.siteHeader.style.pointerEvents = (mainPageOpacity < 0.1) ? 'none' : '';
    }
    if (this.marqueeStrip) {
      this.marqueeStrip.style.opacity = mainPageOpacity.toFixed(3);
      this.marqueeStrip.style.transform = `translate3d(0, ${-mainPageShiftY.toFixed(1)}px, 0)`;
    }
    if (this.wordmarkContainer) {
      this.wordmarkContainer.style.opacity = mainPageOpacity.toFixed(3);
    }
    if (this.stageFooterOverlay) {
      this.stageFooterOverlay.style.opacity = mainPageOpacity.toFixed(3);
    }

    // 3. Shared-Element FLIP Morph on Canvas Wrap (0 to 560ms, t in [0, 0.93])
    if (this.canvasWrap && this.sourceRect && this.targetRect) {
      const morphProgress = clamp(easedT, 0, 1);
      const startX = this.sourceRect.left - this.targetRect.left;
      const startY = this.sourceRect.top - this.targetRect.top;
      const startScale = this.sourceRect.width / this.targetRect.width;

      const currentX = startX * (1 - morphProgress);
      const currentY = startY * (1 - morphProgress);
      const currentScale = startScale + (1 - startScale) * morphProgress;

      this.canvasWrap.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0) scale(${currentScale.toFixed(4)})`;

      // Cross-dissolve between rail front still and viewer f1 (80ms to 260ms, t in [0.13, 0.43])
      if (this.morphStill) {
        const hasViewerFrame = !!this.getNearestLoadedFrame(this.products[this.currentIndex]?.slug, 1);
        if (!hasViewerFrame) {
          this.morphStill.style.opacity = '1';
        } else if (t < 0.13) {
          this.morphStill.style.opacity = '1';
        } else if (t > 0.43) {
          this.morphStill.style.opacity = '0';
        } else {
          const dissolveProgress = (t - 0.13) / (0.43 - 0.13);
          this.morphStill.style.opacity = (1 - dissolveProgress).toFixed(3);
        }
      }
    }

    // 4. Staggered Viewer UI (320ms to 600ms, t in [0.53, 1.0])
    const stagger = (startTime, duration = 0.25) => {
      return clamp((t - startTime) / duration, 0, 1);
    };

    // Header row (counter & close btn)
    if (this.headerRow) {
      const hT = stagger(0.58, 0.25);
      this.headerRow.style.opacity = hT.toFixed(3);
      this.headerRow.style.transform = `translate3d(0, ${(10 * (1 - hT)).toFixed(1)}px, 0)`;
    }

    // Metadata stack below garment (counter, title, subtitle, tabs)
    if (this.metaStack) {
      const metaT = stagger(0.63, 0.28);
      this.metaStack.style.opacity = metaT.toFixed(3);
      this.metaStack.style.transform = `translate3d(0, ${(12 * (1 - metaT)).toFixed(1)}px, 0)`;
    }

    // Navigation chevrons
    if (this.prevBtn && this.nextBtn) {
      const navT = stagger(0.72, 0.25);
      this.prevBtn.style.opacity = navT.toFixed(3);
      this.nextBtn.style.opacity = navT.toFixed(3);
    }

    // Footer row (brand & view in shop CTA)
    if (this.footerRow) {
      const fT = stagger(0.75, 0.25);
      this.footerRow.style.opacity = fT.toFixed(3);
      this.footerRow.style.transform = `translate3d(0, ${(10 * (1 - fT)).toFixed(1)}px, 0)`;
    }

    // Floor shadow
    if (this.shadowEl) {
      const shT = stagger(0.40, 0.35);
      this.shadowEl.style.opacity = (shT * 0.85).toFixed(3);
    }
  }

  // ==========================================================================
  // Open / Close Lifecycle
  // ==========================================================================
  open(index, sourceEl, updateHistory = true) {
    if (this.state === 'VIEWER' && this.currentIndex === index) return;
    this.currentIndex = index;
    const product = this.products[index];
    if (!product) return;

    this.state = 'OPENING';
    cancelAnimationFrame(this.tweenRaf);
    cancelAnimationFrame(this.inertiaRaf);

    // Reset playhead to Front
    this.p = 1.0;
    this.targetP = 1.0;
    this.isTurning = false;

    // Prefetch remaining frames for this product
    this.prefetchSequence(product.slug);

    // Read source geometry once
    this.sourceEl = sourceEl || document.getElementById(`garment-station-${index}`);
    const railCanvas = this.sourceEl ? this.sourceEl.querySelector('.garment-canvas') : null;
    this.sourceRect = railCanvas ? railCanvas.getBoundingClientRect() : null;

    // Prepare modal visibility
    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Populate texts
    this.updateProductDetails();

    // Setup cross-dissolve still on morph proxy
    if (this.morphStill) {
      this.morphStill.style.backgroundImage = `url(${product.stillUrl})`;
      this.morphStill.style.opacity = '1';
    }

    // Measure target geometry
    this.targetRect = this.canvasWrap.getBoundingClientRect();

    // Render frame 1 immediately
    this.renderCanvas(1.0);

    // Deep link hash
    if (updateHistory) {
      history.pushState({ slug: product.slug }, '', `#${product.slug}`);
    }

    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.applyMasterProgress(1.0);
      this.state = 'VIEWER';
      this.closeBtn?.focus();
      return;
    }

    // Master tween from current t -> 1.0
    const startT = this.t;
    const startTime = performance.now();
    const duration = OPEN_MS * (1.0 - startT);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = clamp(elapsed / duration, 0, 1);
      const currentT = startT + (1.0 - startT) * progress;

      this.applyMasterProgress(currentT);

      if (progress < 1.0 && this.state === 'OPENING') {
        this.tweenRaf = requestAnimationFrame(step);
      } else {
        this.state = 'VIEWER';
        this.applyMasterProgress(1.0);
        this.closeBtn?.focus();
      }
    };
    this.tweenRaf = requestAnimationFrame(step);
  }

  close(updateHistory = true) {
    if (this.state === 'HOME') return;
    this.state = 'CLOSING';
    cancelAnimationFrame(this.tweenRaf);
    cancelAnimationFrame(this.inertiaRaf);

    // If on Back (p > 1), ease to front during closing
    if (this.p > 1.0) {
      this.turnToKeyframe('front', 250);
    }

    if (updateHistory && window.location.hash) {
      history.pushState('', '', window.location.pathname + window.location.search);
    }

    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.applyMasterProgress(0);
      this.state = 'HOME';
      this.modal.classList.remove('open');
      this.modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      this.sourceEl?.focus();
      return;
    }

    // Re-measure target & source in case of viewport change
    if (this.sourceEl) {
      const railCanvas = this.sourceEl.querySelector('.garment-canvas');
      if (railCanvas) this.sourceRect = railCanvas.getBoundingClientRect();
    }
    if (this.canvasWrap) {
      this.targetRect = this.canvasWrap.getBoundingClientRect();
    }

    const startT = this.t;
    const startTime = performance.now();
    const duration = CLOSE_MS * startT;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = clamp(elapsed / duration, 0, 1);
      const currentT = startT * (1.0 - progress);

      this.applyMasterProgress(currentT);

      if (progress < 1.0 && this.state === 'CLOSING') {
        this.tweenRaf = requestAnimationFrame(step);
      } else {
        this.state = 'HOME';
        this.applyMasterProgress(0);
        this.modal.classList.remove('open');
        this.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        this.sourceEl?.focus();
      }
    };
    this.tweenRaf = requestAnimationFrame(step);
  }

  // ==========================================================================
  // Front <-> Back Half-Turn Animation
  // ==========================================================================
  turnToKeyframe(targetKey, duration = TURN_MS) {
    const targetP = (targetKey === 'front') ? 1.0 : 90.0;
    if (Math.abs(this.p - targetP) < 0.1) return;

    this.isTurning = true;
    this.turnStartP = this.p;
    this.targetP = targetP;
    this.turnDistance = targetP - this.p;
    this.turnDuration = duration;
    this.turnStartTime = performance.now();

    const step = (now) => {
      if (!this.isTurning) return;
      const elapsed = now - this.turnStartTime;
      const progress = clamp(elapsed / this.turnDuration, 0, 1);
      const eased = easeInOutCubic(progress);

      this.p = this.turnStartP + this.turnDistance * eased;
      this.renderCanvas(this.p);

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        this.isTurning = false;
        this.p = this.targetP;
        this.renderCanvas(this.p);
      }
    };
    requestAnimationFrame(step);
  }

  toggleFrontBack() {
    if (this.p < 45.0) {
      this.turnToKeyframe('back');
    } else {
      this.turnToKeyframe('front');
    }
  }

  // ==========================================================================
  // Drag / Horizontal Scrub
  // ==========================================================================
  setupDragScrub() {
    if (!this.canvasWrap) return;

    const onPointerDown = (e) => {
      if (this.state !== 'VIEWER') return;
      this.isDragging = true;
      this.isTurning = false;
      this.dragStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      this.dragLastX = this.dragStartX;
      this.dragStartP = this.p;
      this.dragVelocity = 0;
      this.canvasWrap.classList.add('dragging');
      cancelAnimationFrame(this.inertiaRaf);
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const deltaX = currentX - this.dragLastX;
      this.dragLastX = currentX;

      // Pointer travel of 60% garment width = 89 frames
      const garmentW = this.canvasWrap.offsetWidth || 400;
      const travelSpan = garmentW * 0.60;
      const sensitivity = 89.0 / Math.max(100, travelSpan);

      // Scrub p (drag right turns towards back; drag left turns towards front)
      const rawDeltaP = (currentX - this.dragStartX) * sensitivity;
      let rawP = this.dragStartP + rawDeltaP;

      // Rubber-band resistance at boundaries [1, 90]
      if (rawP < 1.0) {
        rawP = 1.0 - (1.0 - rawP) * 0.22;
      } else if (rawP > 90.0) {
        rawP = 90.0 + (rawP - 90.0) * 0.22;
      }

      this.p = rawP;
      this.dragVelocity = deltaX * sensitivity;
      this.renderCanvas(this.p);
    };

    const onPointerUp = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.canvasWrap.classList.remove('dragging');
      this.applyDragInertia();
    };

    this.canvasWrap.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvasWrap.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  }

  applyDragInertia() {
    const step = () => {
      if (this.isDragging || this.isTurning) return;

      this.p += this.dragVelocity;
      this.dragVelocity *= 0.90; // friction

      // Clamp with rubber-band recovery
      if (this.p < 1.0) {
        this.p += (1.0 - this.p) * 0.25;
      } else if (this.p > 90.0) {
        this.p += (90.0 - this.p) * 0.25;
      }

      this.renderCanvas(this.p);

      if (Math.abs(this.dragVelocity) > 0.05) {
        this.inertiaRaf = requestAnimationFrame(step);
      } else {
        // Magnetic snap to nearest keyframe (1.0 or 90.0)
        const snapTarget = (this.p < 45.0) ? 'front' : 'back';
        this.turnToKeyframe(snapTarget, 380);
      }
    };
    this.inertiaRaf = requestAnimationFrame(step);
  }

  // ==========================================================================
  // Product Navigation (Left / Right)
  // ==========================================================================
  navigateProduct(direction) {
    if (this.state !== 'VIEWER') return;
    const count = this.products.length;
    const newIndex = (this.currentIndex + direction + count) % count;

    // Slide transition animation
    const outgoingWrap = this.canvasWrap;
    if (outgoingWrap) {
      outgoingWrap.style.transition = 'transform 220ms cubic-bezier(.22, 1, .36, 1), opacity 220ms ease';
      outgoingWrap.style.transform = `translate3d(${-direction * 40}px, 0, 0)`;
      outgoingWrap.style.opacity = '0';
    }

    setTimeout(() => {
      this.currentIndex = newIndex;
      this.p = 1.0;
      this.targetP = 1.0;
      this.isTurning = false;

      const product = this.products[newIndex];
      this.prefetchSequence(product.slug);
      this.updateProductDetails();
      this.updateTabIndicator(1.0);
      this.renderCanvas(1.0);

      // Incoming slide
      if (outgoingWrap) {
        outgoingWrap.style.transition = 'none';
        outgoingWrap.style.transform = `translate3d(${direction * 40}px, 0, 0)`;
        outgoingWrap.style.opacity = '0';

        requestAnimationFrame(() => {
          outgoingWrap.style.transition = 'transform 260ms cubic-bezier(.22, 1, .36, 1), opacity 260ms ease';
          outgoingWrap.style.transform = 'translate3d(0, 0, 0)';
          outgoingWrap.style.opacity = '1';
        });
      }

      history.replaceState({ slug: product.slug }, '', `#${product.slug}`);
    }, 220);
  }

  updateProductDetails() {
    const product = this.products[this.currentIndex];
    if (!product) return;

    if (this.counterEl) {
      this.counterEl.textContent = `0${this.currentIndex + 1} / 0${this.products.length}`;
    }
    if (this.titleEl) {
      this.titleEl.textContent = product.name.toUpperCase();
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = product.subtitle;
    }
  }
}
