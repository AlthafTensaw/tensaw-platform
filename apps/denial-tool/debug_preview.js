import { chromium } from '@playwright/test';

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR] ${err.stack || err.message}`);
  });

  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText || 'Failed'}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`[RESPONSE ERROR] ${response.status()} - ${response.url()}`);
    }
  });

  console.log('Navigating to http://localhost:4173/ ...');
  try {
    await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 5000 });
    console.log('Page loaded. Waiting 2 seconds for dynamic imports/rendering...');
    await page.waitForTimeout(2000);
    console.log('Current URL:', page.url());
    const rootHtml = await page.innerHTML('#root');
    console.log('----------------------------------------------------');
    console.log('Page HTML inside #root:');
    console.log(rootHtml);
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('Navigation failed:', error);
  }

  await browser.close();
  console.log('Browser closed.');
}

run().catch(console.error);
