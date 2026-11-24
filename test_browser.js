import puppeteer from 'puppeteer-core';

async function test() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  page.on('requestfailed', req => console.error('REQUEST FAILED:', req.url(), req.failure()?.errorText));

  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Wait 1 second
  await new Promise(r => setTimeout(r, 1000));

  // Check DOM
  const info = await page.evaluate(() => {
    const stage = document.querySelector('.main-stage-container');
    const plate = document.querySelector('#clean-plate-img');
    const stations = Array.from(document.querySelectorAll('.garment-station')).map(s => {
      const rect = s.getBoundingClientRect();
      const canvas = s.querySelector('canvas');
      return {
        id: s.id,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        canvas: canvas ? { width: canvas.width, height: canvas.height } : null
      };
    });

    return {
      stageRect: stage ? stage.getBoundingClientRect() : null,
      plateSrc: plate ? plate.src : null,
      plateComplete: plate ? plate.complete : null,
      plateNaturalWidth: plate ? plate.naturalWidth : null,
      plateNaturalHeight: plate ? plate.naturalHeight : null,
      stations
    };
  });

  console.log('DOM INFO:', JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'real_screen.png' });
  console.log('Screenshot saved to real_screen.png');

  await browser.close();
}

test().catch(err => console.error('FATAL:', err));
