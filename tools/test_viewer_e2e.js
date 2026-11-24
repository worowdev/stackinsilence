import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\yusuf\\.gemini\\antigravity\\brain\\2e176f6e-0daf-4425-ae43-ff36dadbc594';
const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(`Starting E2E tests using browser at: ${CHROME_PATH}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  // Listen for console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[PAGE ERROR]: ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[PAGE UNCAUGHT]: ${err.toString()}`));

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => typeof window.openViewer === 'function', { timeout: 10000 });
  
  // Test frame loading directly in page context
  const testLoad = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ ok: true, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = (err) => {
        resolve({ ok: false, err: String(err) });
      };
      img.src = '/assets/viewer/all-we-need-tee/0001.webp';
    });
  });
  console.log('Direct image load test in browser:', testLoad);

  await sleep(1500);

  // 1. Initial Rail State
  console.log('1. Capturing Initial Rail View at rest...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_01_rail_rest.png') });

  // 2. Open Viewer on Garment 0 (Arch Longsleeve)
  console.log('2. Opening Viewer on Garment 0 (Arch Longsleeve)...');
  await page.evaluate(() => {
    window.openViewer('arch-longsleeve');
  });

  // Capture morph in-flight (at ~200ms)
  await sleep(200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_02_morph_inflight.png') });

  // Wait for open animation to settle (total duration 600ms)
  await sleep(600);
  console.log('3. Capturing Garment 0 Front Settled (p=1.0)...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_03_longsleeve_front.png') });

  // 3. Turn to Back on Garment 0
  console.log('4. Clicking Back Tab on Garment 0...');
  await page.click('#tab-back');
  await sleep(900); // TURN_MS is 800ms
  console.log('5. Capturing Garment 0 Back Settled (p=90.0)...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_04_longsleeve_back.png') });

  // 4. Navigate to Next (Garment 1: All We Need Tee)
  console.log('6. Clicking Next arrow to Garment 1 (Tee)...');
  await page.click('#viewer-next');
  await sleep(600);
  console.log('7. Capturing Garment 1 Front Settled...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_05_tee_front.png') });

  // Turn to Back on Garment 1 (All We Need Is Money print)
  console.log('8. Clicking Back Tab on Garment 1...');
  const stateBefore = await page.evaluate(() => ({
    p: window.viewer.p,
    curr: window.viewer.currentIndex,
    slug: window.viewer.products[window.viewer.currentIndex].slug,
    f0: !!window.viewer.frameCache['all-we-need-tee'].frames[0],
    f89: !!window.viewer.frameCache['all-we-need-tee'].frames[89]
  }));
  console.log('State before clicking back:', stateBefore);
  await page.click('#tab-back');
  await sleep(1000);
  const stateAfter = await page.evaluate(() => ({
    p: window.viewer.p,
    isTurning: window.viewer.isTurning,
    f89: !!window.viewer.frameCache['all-we-need-tee'].frames[89]
  }));
  console.log('State after clicking back:', stateAfter);
  console.log('9. Capturing Garment 1 Back Settled (Verifying "ALL WE NEED IS MONEY" print)...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_06_tee_back_money_print.png') });

  // 5. Navigate to Next (Garment 2: Money Rose Shirt)
  console.log('10. Clicking Next arrow to Garment 2 (Rose Shirt)...');
  await page.click('#viewer-next');
  await sleep(600);
  console.log('11. Capturing Garment 2 Front Settled...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_07_shirt_front.png') });

  // Test drag scrubbing on Garment 2
  console.log('11b. Testing Drag Scrub & Magnetic Snap...');
  const wrapBox = await page.$eval('#viewer-canvas-wrap', el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(wrapBox.x, wrapBox.y);
  await page.mouse.down();
  await page.mouse.move(wrapBox.x + 120, wrapBox.y, { steps: 8 });
  const midDragP = await page.evaluate(() => window.viewer.p);
  console.log('Mid-drag playhead p:', midDragP);
  await page.mouse.up();
  await sleep(600); // magnetic snap to back
  const postSnapP = await page.evaluate(() => window.viewer.p);
  console.log('Post-snap playhead p:', postSnapP);

  // Turn to Back on Garment 2
  console.log('12. Clicking Back Tab on Garment 2...');
  await page.click('#tab-back');
  await sleep(900);
  console.log('13. Capturing Garment 2 Back Settled...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_08_shirt_back.png') });

  // 6. Test Close Action
  console.log('14. Clicking Close Button...');
  await page.click('#viewer-close');
  await sleep(600); // CLOSE_MS is 480ms
  console.log('15. Capturing Restored Rail View after close...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_09_rail_restored.png') });

  // 7. Mobile Viewport Test (390 x 844, iPhone 14 / standard modern mobile)
  console.log('16. Testing Mobile Viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(500);
  await page.evaluate(() => {
    window.openViewer('all-we-need-tee');
  });
  await sleep(800);
  console.log('17. Capturing Mobile Viewer Open...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_10_mobile_front.png') });

  await page.click('#tab-back');
  await sleep(900);
  console.log('18. Capturing Mobile Viewer Back...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_11_mobile_back.png') });

  await page.click('#viewer-close');
  await sleep(600);
  console.log('19. Capturing Mobile Restored Rail View...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_12_mobile_rail_rest.png') });

  await browser.close();
  console.log('All E2E tests finished successfully!');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
