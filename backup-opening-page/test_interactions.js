import puppeteer from 'puppeteer-core';

async function testInteractions() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // 1. Click center garment station (Garment 1: All We Need Tee)
  console.log('Clicking center garment station...');
  await page.click('#garment-station-1');
  await new Promise(r => setTimeout(r, 800));

  // Check viewer state
  const viewerState = await page.evaluate(() => {
    const modal = document.querySelector('#product-viewer');
    const title = document.querySelector('#viewer-title')?.textContent;
    const price = document.querySelector('#viewer-price')?.textContent;
    const counter = document.querySelector('#viewer-counter')?.textContent;
    return {
      isOpen: modal.classList.contains('open'),
      title,
      price,
      counter
    };
  });
  console.log('VIEWER STATE:', viewerState);

  // Capture open viewer screenshot
  await page.screenshot({ path: 'viewer_open.png' });
  console.log('Viewer screenshot saved to viewer_open.png');

  // 2. Click "Back" tab
  console.log('Clicking "Back" tab...');
  await page.click('#tab-back');
  // Wait for 50% slower tab turn (~1400ms)
  await new Promise(r => setTimeout(r, 1600));

  await page.screenshot({ path: 'viewer_back_turned.png' });
  console.log('Viewer back turned screenshot saved to viewer_back_turned.png');

  // 3. Select size XL and Add to Bag
  console.log('Selecting size XL and adding to bag...');
  await page.click('button.size-chip[data-size="XL"]');
  await page.click('#btn-add-to-bag');
  await new Promise(r => setTimeout(r, 400));

  // 4. Close viewer and open Bag drawer
  console.log('Closing viewer and opening Bag drawer...');
  await page.click('#viewer-close');
  await new Promise(r => setTimeout(r, 500));
  await page.click('#btn-cart');
  await new Promise(r => setTimeout(r, 500));

  const cartState = await page.evaluate(() => {
    const drawer = document.querySelector('#cart-drawer');
    const badge = document.querySelector('#cart-badge')?.textContent;
    const items = Array.from(document.querySelectorAll('.cart-item-row')).map(item => ({
      title: item.querySelector('.cart-item-title')?.textContent,
      variant: item.querySelector('.cart-item-variant')?.textContent,
      price: item.querySelector('.cart-item-price')?.textContent
    }));
    return {
      isOpen: drawer.classList.contains('open'),
      badge,
      items
    };
  });
  console.log('CART STATE:', cartState);

  await page.screenshot({ path: 'cart_drawer_open.png' });
  console.log('Cart drawer screenshot saved to cart_drawer_open.png');

  await browser.close();
}

testInteractions().catch(err => console.error('FATAL:', err));
