// ==========================================================================
// STACK IN SILENCE — 3D Frame Sequence & Canvas Rendering Engine
// ==========================================================================

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class GarmentSequence {
  constructor(product, canvas, shadowEl) {
    this.product = product;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.shadowEl = shadowEl;
    this.totalFrames = 150;
    
    this.frames = new Array(this.totalFrames).fill(null);
    this.framesLoadedCount = 0;
    this.currentFrame = 0;
    this.targetFrame = 0;
    
    // Animation state
    this.isAnimating = false;
    this.animStartTime = 0;
    this.animDuration = 3300; // ms for one full 360 turn (50% slower, smooth editorial glide)
    this.animStartFrame = 0;
    this.animDistance = 150;
    
    // Hover intent tracking
    this.hoverTimeout = null;
    this.isHovered = false;
    
    // Load initial frames
    this.preloadPasses();
  }

  async preloadPasses() {
    // 1. Immediately load frame 1 (index 0)
    await this.loadFrame(0);
    this.renderFrame(0);

    // 2. Pass 1: Load every 3rd frame (50 frames total)
    const pass1Indices = [];
    for (let i = 0; i < this.totalFrames; i += 3) {
      if (i !== 0) pass1Indices.push(i);
    }
    
    await Promise.all(pass1Indices.map(idx => this.loadFrame(idx)));

    // 3. Pass 2: Load remaining frames in background idle chunks
    const pass2Indices = [];
    for (let i = 0; i < this.totalFrames; i++) {
      if (i % 3 !== 0) pass2Indices.push(i);
    }

    const loadChunk = (start) => {
      const chunk = pass2Indices.slice(start, start + 12);
      if (chunk.length === 0) return;
      Promise.all(chunk.map(idx => this.loadFrame(idx))).then(() => {
        if (start + 12 < pass2Indices.length) {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => loadChunk(start + 12));
          } else {
            setTimeout(() => loadChunk(start + 12), 20);
          }
        }
      });
    };

    setTimeout(() => loadChunk(0), 100);
  }

  loadFrame(index) {
    if (this.frames[index]) return Promise.resolve(this.frames[index]);

    return new Promise((resolve) => {
      const img = new Image();
      const frameNum = String(index + 1).padStart(4, '0');
      img.src = `/assets/seq/${this.product.slug}/${frameNum}.webp`;
      img.onload = () => {
        this.frames[index] = img;
        this.framesLoadedCount++;
        resolve(img);
      };
      img.onerror = () => {
        // Fallback to nearest available frame
        resolve(null);
      };
    });
  }

  getNearestLoadedFrame(index) {
    const wrappedIdx = ((Math.round(index) % this.totalFrames) + this.totalFrames) % this.totalFrames;
    if (this.frames[wrappedIdx]) return this.frames[wrappedIdx];

    // Search outward for closest loaded frame
    for (let offset = 1; offset < 8; offset++) {
      const left = (wrappedIdx - offset + this.totalFrames) % this.totalFrames;
      if (this.frames[left]) return this.frames[left];
      const right = (wrappedIdx + offset) % this.totalFrames;
      if (this.frames[right]) return this.frames[right];
    }
    return this.frames[0]; // fallback to front
  }

  renderFrame(index) {
    const frame = this.getNearestLoadedFrame(index);
    if (!frame) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);

    // Update dynamic shadow scaling based on garment projected width
    if (this.shadowEl && this.product.projectedWidths && this.product.frontWidth) {
      const normIdx = Math.round(index) % this.totalFrames;
      const projW = this.product.projectedWidths[normIdx] || this.product.frontWidth;
      const scale = (projW / this.product.frontWidth) * 0.95;
      this.shadowEl.style.setProperty('--shadow-scale', scale.toFixed(3));
    }
  }

  start360Turn(duration = 3300) {
    this.isAnimating = true;
    this.animStartTime = performance.now();
    this.animDuration = duration;
    this.animStartFrame = this.currentFrame;
    this.animDistance = 150; // Full 360 turn
  }

  update(now) {
    if (!this.isAnimating) return;

    const elapsed = now - this.animStartTime;
    const progress = Math.min(1, elapsed / this.animDuration);
    const eased = easeInOutCubic(progress);

    this.currentFrame = (this.animStartFrame + eased * this.animDistance) % this.totalFrames;
    this.renderFrame(this.currentFrame);

    if (progress >= 1) {
      this.isAnimating = false;
      this.currentFrame = (this.animStartFrame + this.animDistance) % this.totalFrames;
      this.renderFrame(this.currentFrame);
    }
  }

  onPointerEnter() {
    this.isHovered = true;
    clearTimeout(this.hoverTimeout);
    // 40ms hover intent delay prevents accidental triggers
    this.hoverTimeout = setTimeout(() => {
      if (this.isHovered && !this.isAnimating) {
        this.start360Turn(3200);
      }
    }, 45);
  }

  onPointerLeave() {
    this.isHovered = false;
    clearTimeout(this.hoverTimeout);
  }
}

export class RailEngine {
  constructor(products) {
    this.products = products;
    this.sequences = [];
    this.isRunning = false;
    this.rafId = null;
    this.init();
  }

  init() {
    this.products.forEach((product, idx) => {
      const canvas = document.getElementById(`canvas-${idx}`);
      const shadow = document.getElementById(`shadow-${idx}`);
      const station = document.getElementById(`garment-station-${idx}`);

      if (canvas && station) {
        const seq = new GarmentSequence(product, canvas, shadow);
        this.sequences.push(seq);

        station.addEventListener('pointerenter', () => seq.onPointerEnter());
        station.addEventListener('pointerleave', () => seq.onPointerLeave());
      }
    });

    this.startLoop();
    this.triggerIntroAnimation();
  }

  triggerIntroAnimation() {
    // Staggered intro turn across the 3 garments on initial page load (50% slower)
    setTimeout(() => this.sequences[0]?.start360Turn(3200), 160);
    setTimeout(() => this.sequences[1]?.start360Turn(3200), 380);
    setTimeout(() => this.sequences[2]?.start360Turn(3200), 600);
  }

  startLoop() {
    this.isRunning = true;
    const loop = (now) => {
      if (!this.isRunning) return;
      for (const seq of this.sequences) {
        seq.update(now);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopLoop() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
