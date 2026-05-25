import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  console.log('Starting screenshot debug...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log('[BROWSER CONSOLE]', msg.type(), msg.text());
  });
  
  page.on('pageerror', err => {
    console.error('[BROWSER EXCEPTION]', err.stack || err.message);
  });

  try {
    console.log('Navigating to portal page...');
    await page.goto('http://localhost:5173/#/portal', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Injecting session...');
    await page.evaluate(() => {
      localStorage.setItem('workspaceId', 'aiuscicomm');
      localStorage.setItem('userId', 'TobHqkvdBGX0igSUy5Rz');
      localStorage.setItem('scicomm_app_announcement_hidden', 'false');
    });

    console.log('Navigating to root feed...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 6000));

    console.log('Current URL after loading:', page.url());
    
    // Check what is rendered
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Body Text snippet:', bodyText.substring(0, 500));

    // Capture screenshot
    const screenshotPath = 'C:\\Users\\Abdul\\.gemini\\antigravity\\brain\\a6f01a68-8fa8-43f3-a397-c5eef8de341b\\debug_screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);

  } catch (err) {
    console.error('Screenshot script failed:', err.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
