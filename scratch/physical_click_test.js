import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting physical click test...');
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
    console.log('Navigating to portal...');
    await page.goto('http://localhost:5173/#/portal', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Injecting session...');
    await page.evaluate(() => {
      localStorage.setItem('workspaceId', 'aiuscicomm');
      localStorage.setItem('userId', 'TobHqkvdBGX0igSUy5Rz');
      localStorage.setItem('scicomm_app_announcement_hidden', 'false');
      localStorage.removeItem('scicomm_version_seen');
    });

    console.log('Navigating to feed...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    
    // Wait for buttons
    console.log('Waiting for elements to be visible...');
    await page.waitForSelector('button', { timeout: 10000 });

    // 1. Try to physically click "Got It! 🎉"
    console.log('Trying to physically click Changelog "Got It!"...');
    // Find button containing Got It
    const changelogButton = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Got It!'));
    });
    
    if (changelogButton && changelogButton.asElement()) {
      await changelogButton.asElement().click();
      console.log('Physically clicked Changelog "Got It!" successfully.');
    } else {
      console.log('Changelog button not found.');
    }
    await new Promise(r => setTimeout(r, 1000));

    // 2. Try to physically click "Let's Go"
    console.log('Trying to physically click Audio Unlock "Let\'s Go"...');
    const audioButton = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes("Let's Go"));
    });
    
    if (audioButton && audioButton.asElement()) {
      await audioButton.asElement().click();
      console.log('Physically clicked Audio Unlock "Let\'s Go" successfully.');
    } else {
      console.log('Audio Unlock button not found.');
    }
    await new Promise(r => setTimeout(r, 1000));

    // 3. Try to physically click "The Portal is Mobile" Close button
    console.log('Trying to physically click Promo Close button...');
    const closeButton = await page.evaluateHandle(() => {
      const promoHeader = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.includes('The Portal is Mobile'));
      if (!promoHeader) return null;
      const container = promoHeader.closest('.app-announcement-banner') || promoHeader.closest('.scicomm-card');
      if (!container) return null;
      return container.querySelector('button');
    });

    if (closeButton && closeButton.asElement()) {
      await closeButton.asElement().click();
      console.log('Physically clicked Promo Close button successfully.');
    } else {
      console.log('Promo Close button not found.');
    }
    await new Promise(r => setTimeout(r, 1500));
    
    // Check if the banner is still visible
    const isBannerVisible = await page.evaluate(() => {
      return !!Array.from(document.querySelectorAll('h2')).find(h => h.innerText.includes('The Portal is Mobile'));
    });
    console.log('Promo banner still visible:', isBannerVisible);

    await page.screenshot({ path: 'C:\\Users\\Abdul\\.gemini\\antigravity\\brain\\a6f01a68-8fa8-43f3-a397-c5eef8de341b\\physical_click_result.png' });

  } catch (err) {
    console.error('Physical click test failed:', err.stack);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
