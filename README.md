# Stack In Silence — High-Fashion Interactive E-Commerce Storefront

A production-grade, 60fps editorial online store landing page for the streetwear brand **Stack In Silence**, modeled on the interactive clothing-rail experience (`web_demo.mp4`).

Built strictly with **Plain HTML5, CSS3, and Vanilla JavaScript (ES Modules)** — zero framework lock-in, zero bulky dependencies, and ready to be ported directly to Shopify (Liquid / Hydrogen) or any headless commerce backend.

---

## ✦ Core Features & Interactions

1. **Interactive Clothing Rail (Studio Stage)**:
   - Centered 4:5 editorial aspect ratio with continuous studio gradient background and horizontal steel rail extending edge-to-edge across wide displays.
   - Three hanging cream garments:
     - **Garment 01 (Left)**: *Stack In Silence Arch Longsleeve* ($110.00)
     - **Garment 02 (Center)**: *All We Need Vintage Boxy Tee* ($85.00)
     - **Garment 03 (Right)**: *Money Rose Resort Shirt* ($125.00)
   - **Hover-to-Turn**: Hover intent (~45ms) triggers a buttery 360° turn sequence rendered at 60fps on HTML5 canvas with cubic-bezier easing (`easeInOutCubic`).
   - **Staggered Intro Animation**: On initial page load, the three garments execute a staggered ~120ms turn sequence to visually introduce their interactive nature.
   - **Dynamic Projected Floor Shadows**: Each garment features soft radial floor shadows that dynamically scale their width in real time matching the garment's projected width at every angle (e.g. narrowing on side profiles, expanding on front/back views).

2. **Signature Blurred Editorial Viewer (FLIP Modal)**:
   - Clicking any hanging garment initiates a **FLIP spatial transition** (`cubic-bezier(0.22, 1, 0.36, 1)`, ~520ms) flying from its position on the rail to the center stage.
   - Background blurs with a warm cream wash (`backdrop-filter: blur(28px) saturate(130%)`, `rgba(244, 238, 236, 0.90)`).
   - **Interactive 360° Scrubbing**: Drag horizontally with touch or mouse to rotate the garment with natural pointer inertia and momentum damping (`velocity *= 0.92`).
   - **Front / Back Segmented Tabs**: Clicking "Front" or "Back" calculates the shortest rotational angular path around the 150-frame circle and smoothly turns the garment to reveal front embroidery or back prints (e.g. "ALL WE NEED IS MONEY" cash roll).
   - **Studio Flat Toggle**: Toggle between the 3D interactive turntable and high-resolution studio flat photography.
   - **Complete Editorial Specs**: Fabric GSM, weave, distressing, size options (`S`, `M`, `L`, `XL`, `XXL`), and size recommendation notes.
   - **Carousel Navigation**: Left/Right chevrons and keyboard arrow keys (`←`, `→`, `Esc`).

3. **Persistent Bag & Fast Commerce Path**:
   - Slideover cart drawer persisted in `localStorage`.
   - Real-time item count badge on header.
   - Free worldwide shipping threshold bar ($150.00 target).
   - Line items with size display and inline quantity increments/decrements.
   - Quick Shop catalog drawer for customers who prefer a conventional fast path directly to checkout.
   - Production-ready demo checkout handoff modal.

4. **Continuous Hardware-Accelerated Marquee**:
   - Deep espresso `#432c1f` strip at the bottom with cream `#d9cbbe` typography.
   - Statement loop: `ALL WE NEED IS MONEY ✦ STACK IN SILENCE ✦ WEAR THE REMINDER ✦ THE FIRST DROP ✦`.
   - Pure CSS `transform: translateX` animation running at 60fps, pausing on hover.

---

## ✦ Asset Processing Pipeline (`tools/build_assets.py`)

Run via `py tools/build_assets.py`:
1. **Mathematical Clean Plate Generation**:
   - The studio poster (`add_this_on_top_as_579f8e2c_2K.jpg`) background was mathematically modeled using margin column profiles ($x \in [5, 30]$ and $x \in [W-30, W-5]$) with 1D vertical Gaussian filtering ($\sigma = 25$) and horizontal ramp interpolation.
   - Inpaints garments and hanger clips while preserving 100% of the arched top wordmark, horizontal steel rail, soft floor shadows, studio lighting, matching film grain, and bottom tagline.
2. **Trimap & GrabCut Garment Cutout Engine**:
   - Automatic rail detection per garment (`rail_y = 125 + np.argmin(means)`).
   - Linear background gradient estimation per row.
   - Trimap generation with definite background above rail (except hook neck at $x \in [173, 187]$) and below $y = 530$.
   - Parallelized across all 8 CPU cores using `ProcessPoolExecutor` (processing 450 frames in ~20 seconds).
   - 2× Lanczos4 super-resolution upscale to $720 \times 800$ with light unsharp mask.
   - WebP quality 80 encoding (average ~15 KB per frame).
   - Generates `public/assets/manifest.json` with frame bounding boxes, keyframe indices, hook positions, and per-frame projected widths.

---

## ✦ Project Structure

```
StackinSilence/
├── assets/
│   └── raw/                       # Original high-res poster and 30fps smooth zips
├── public/
│   ├── assets/
│   │   ├── clean_plate.webp       # Inpainted studio background with rail & wordmark
│   │   ├── wordmark.webp          # Standalone transparent wordmark
│   │   ├── stills/                # Crisp front stills for each garment
│   │   ├── flats/                 # High-res front & back studio flat photos
│   │   ├── seq/                   # 720x800 WebP 150-frame turntable sequences
│   │   │   ├── arch-longsleeve/   # 0001.webp - 0150.webp
│   │   │   ├── all-we-need-tee/   # 0001.webp - 0150.webp
│   │   │   └── money-rose-shirt/  # 0001.webp - 0150.webp
│   │   └── manifest.json          # Machine-readable product manifest
│   └── products.json              # Canonical store catalog
├── src/
│   ├── engine.js                  # 60fps requestAnimationFrame sequence engine
│   ├── viewer.js                  # FLIP modal, 360 drag scrub, inertia & tabs
│   ├── cart.js                    # Persistent cart manager & slideover drawer
│   ├── style.css                  # Design tokens, responsive stage & typography
│   └── main.js                    # Application entry point
├── tools/
│   └── build_assets.py            # Automated multi-core segmentation pipeline
├── index.html                     # Semantic, accessible HTML5 layout
└── package.json                   # Vite dev/build configuration
```

---

## ✦ Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Visit http://localhost:5173/

# Production build
npm run build
```
