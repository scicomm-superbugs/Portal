import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting Puppeteer automation test...');
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
    // 1. Visit the portal login page
    console.log('Navigating to local login page...');
    await page.goto('http://localhost:5173/#/portal', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Set the localStorage workspaceId and userId to bypass login and simulate a logged-in scientist
    console.log('Injecting session into localStorage...');
    await page.evaluate(() => {
      localStorage.setItem('workspaceId', 'aiuscicomm');
      localStorage.setItem('userId', 'TobHqkvdBGX0igSUy5Rz'); // Test scientist ID
      localStorage.setItem('scicomm_app_announcement_hidden', 'false'); // Ensure announcement banner is visible for testing
    });

    // 3. Reload to let AuthContext initialize as logged-in
    console.log('Reloading to restore session...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));

    // Print the current URL and page title to verify
    console.log('Current URL:', page.url());
    const title = await page.title();
    console.log('Page Title:', title);

    // 4. Check if the feed and buttons are visible
    console.log('Checking visible buttons...');
    const buttonsInfo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.map(b => ({
        text: b.innerText,
        html: b.outerHTML.substring(0, 100),
        visible: b.offsetWidth > 0 && b.offsetHeight > 0
      }));
    });
    console.log('Found buttons:', JSON.stringify(buttonsInfo, null, 2));

    // 5. Try clicking the promo close button if it exists
    console.log('Attempting to click promo banner close button...');
    const clickedClose = await page.evaluate(() => {
      // Find a button containing X or similar, or look for the button next to "The Portal is Mobile"
      const promoHeader = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.includes('The Portal is Mobile'));
      if (!promoHeader) {
        console.log('Promo banner "The Portal is Mobile" not found on page.');
        return false;
      }
      const banner = promoHeader.closest('.app-announcement-banner') || promoHeader.closest('.scicomm-card');
      if (!banner) {
        console.log('Banner container not found.');
        return false;
      }
      const closeBtn = banner.querySelector('button');
      if (closeBtn) {
        console.log('Clicking close button:', closeBtn.outerHTML);
        closeBtn.click();
        return true;
      }
      console.log('Close button not found in banner.');
      return false;
    });
    console.log('Clicked close button:', clickedClose);
    await new Promise(r => setTimeout(r, 2000));

    console.log('Test execution complete.');
  } catch (err) {
    console.error('Test script crashed:', err.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
