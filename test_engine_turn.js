
import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  
  // Wait for intro animation to complete (it takes ~4000ms from load)
  console.log('Waiting 4.5s for intro animation to finish...');
  await new Promise(r => setTimeout(r, 4500));
  
  // Check engine status
  const status = await page.evaluate(() => {
    return window.railEngine?.sequences.map(s => ({
      slug: s.product.slug,
      isAnimating: s.isAnimating,
      currentFrame: Math.round(s.currentFrame),
      loaded: s.framesLoadedCount
    }));
  });
  console.log('Engine status after intro:', status);

  // Now trigger turn on sequence 2 (money-rose-shirt)
  await page.evaluate(() => {
    window.railEngine.sequences[2].start360Turn(3200);
  });
  
  // Wait 850ms (at ~1/4 turn, should be around frame 37-55)
  await new Promise(r => setTimeout(r, 850));
  const midStatus = await page.evaluate(() => {
    return {
      frame: Math.round(window.railEngine.sequences[2].currentFrame),
      isAnimating: window.railEngine.sequences[2].isAnimating
    };
  });
  console.log('Mid-turn status (expected side view):', midStatus);
  await page.screenshot({ path: 'verified_midturn_side.png' });
  
  // Wait another 850ms (at ~1/2 turn, back view)
  await new Promise(r => setTimeout(r, 850));
  const backStatus = await page.evaluate(() => {
    return {
      frame: Math.round(window.railEngine.sequences[2].currentFrame),
      isAnimating: window.railEngine.sequences[2].isAnimating
    };
  });
  console.log('Half-turn status (expected back view):', backStatus);
  await page.screenshot({ path: 'verified_midturn_back.png' });

  await browser.close();
}
run();
