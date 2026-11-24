import puppeteer from 'puppeteer-core';
import path from 'path';

async function testRotation() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  // Screenshot at rest
  await page.screenshot({ path: 'test_rotation_rest.png' });
  console.log('Saved test_rotation_rest.png');

  // Test hovering shirt (station 2) - this was the one showing white glitches in the user video
  console.log('Hovering over money-rose-shirt (#garment-station-2)...');
  const station2 = await page.$('#garment-station-2');
  const box2 = await station2.boundingBox();
  
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  
  // Wait ~800ms (around 25% of the 3300ms turn, exactly where side view frame 52 occurs)
  await new Promise(r => setTimeout(r, 850));
  await page.screenshot({ path: 'test_rotation_shirt_side1.png' });
  console.log('Saved test_rotation_shirt_side1.png (side view)');

  // Wait ~850ms more (around 50% turn, back view)
  await new Promise(r => setTimeout(r, 850));
  await page.screenshot({ path: 'test_rotation_shirt_back.png' });
  console.log('Saved test_rotation_shirt_back.png (back view)');

  // Wait ~850ms more (around 75% turn, side view 2)
  await new Promise(r => setTimeout(r, 850));
  await page.screenshot({ path: 'test_rotation_shirt_side2.png' });
  console.log('Saved test_rotation_shirt_side2.png (side view 2)');

  // Move mouse away to let it settle
  await page.mouse.move(10, 10);
  await new Promise(r => setTimeout(r, 1200));

  // Now hover center tee (station 1)
  console.log('Hovering over all-we-need-tee (#garment-station-1)...');
  const station1 = await page.$('#garment-station-1');
  const box1 = await station1.boundingBox();
  await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
  await new Promise(r => setTimeout(r, 850));
  await page.screenshot({ path: 'test_rotation_tee_side1.png' });
  console.log('Saved test_rotation_tee_side1.png (tee side view)');

  await page.mouse.move(10, 10);
  await new Promise(r => setTimeout(r, 1200));

  // Now hover longsleeve (station 0)
  console.log('Hovering over arch-longsleeve (#garment-station-0)...');
  const station0 = await page.$('#garment-station-0');
  const box0 = await station0.boundingBox();
  await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
  await new Promise(r => setTimeout(r, 850));
  await page.screenshot({ path: 'test_rotation_longsleeve_side1.png' });
  console.log('Saved test_rotation_longsleeve_side1.png (longsleeve side view)');

  await browser.close();
  console.log('All rotation test screenshots captured successfully!');
}

testRotation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
