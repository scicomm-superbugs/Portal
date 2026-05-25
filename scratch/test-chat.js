import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting Puppeteer chat navigation test...');
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
    // 1. Visit portal
    console.log('Navigating to portal...');
    await page.goto('http://localhost:5173/#/portal', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // 2. Set localized session for abdullah.amr871 in aiuscicomm
    console.log('Injecting session into localStorage...');
    await page.evaluate(() => {
      localStorage.setItem('workspaceId', 'aiuscicomm');
      localStorage.setItem('userId', 'HDJpQVqaLQHUWic6yv3l'); // abdullah.amr871 scientist ID in aiuscicomm_scientists
    });

    // 3. Reload to main feed
    console.log('Navigating to feed...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // 4. Navigate to Chat center
    console.log('Navigating to chat...');
    await page.goto('http://localhost:5173/#/chat', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const url = page.url();
    const title = await page.title();
    console.log('Page URL:', url);
    console.log('Page Title:', title);

    console.log('Test completed.');
  } catch (err) {
    console.error('Test crashed:', err.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
