import puppeteer from 'puppeteer';

async function run() {
  console.log('Launching browser to capture page error...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', (err) => {
    console.error('PAGE ERROR TRIGGERED:');
    console.error(err.toString());
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('PAGE CONSOLE ERROR:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:3080/', { waitUntil: 'networkidle0' });
    console.log('Page loaded, waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    console.error('Load failed:', e.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

run().catch(console.error);
