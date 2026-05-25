import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting local click testing...');
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
      // Ensure we don't hide any other banners
      localStorage.removeItem('scicomm_version_seen');
    });

    console.log('Navigating to feed...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    
    // Wait for the buttons to appear
    console.log('Waiting for buttons to load...');
    let buttonsLoaded = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const buttonsCount = await page.evaluate(() => document.querySelectorAll('button').length);
      if (buttonsCount > 0) {
        console.log(`Buttons loaded! Found ${buttonsCount} buttons.`);
        buttonsLoaded = true;
        break;
      }
    }

    if (!buttonsLoaded) {
      console.log('Buttons failed to load. Body HTML:', await page.evaluate(() => document.body.innerHTML.substring(0, 1000)));
      await browser.close();
      return;
    }

    // Capture initial state
    await page.screenshot({ path: 'C:\\Users\\Abdul\\.gemini\\antigravity\\brain\\a6f01a68-8fa8-43f3-a397-c5eef8de341b\\click_0_initial.png' });

    // Click "Got It! 🎉" on Changelog if present
    const dismissedChangelog = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Got It!'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log('Dismissed Changelog:', dismissedChangelog);
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'C:\\Users\\Abdul\\.gemini\\antigravity\\brain\\a6f01a68-8fa8-43f3-a397-c5eef8de341b\\click_1_changelog_dismissed.png' });

    // Click "Let's Go" on Audio Unlock if present
    const dismissedAudio = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes("Let's Go"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log('Dismissed Audio Unlock:', dismissedAudio);
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'C:\\Users\\Abdul\\.gemini\\antigravity\\brain\\a6f01a68-8fa8-43f3-a397-c5eef8de341b\\click_2_audio_dismissed.png' });

    // Now try clicking the promo "X" close button
    console.log('Attempting to click "The Portal is Mobile" Close button...');
    const clickedPromoClose = await page.evaluate(() => {
      const promoHeader = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.includes('The Portal is Mobile'));
      if (!promoHeader) {
        console.log('Promo banner header not found.');
        return false;
      }
      const container = promoHeader.closest('.app-announcement-banner') || promoHeader.closest('.scicomm-card');
      if (!container) {
        console.log('Promo banner container not found.');
        return false;
      }
      
      // Find the Close button inside this container
      const closeBtn = container.querySelector('button');
      if (closeBtn) {
        console.log('Found close button:', closeBtn.outerHTML);
        closeBtn.click();
        return true;
      }
      console.log('Close button inside container not found.');
      return false;
    });

    console.log('Clicked Promo Close button:', clickedPromoClose);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'C:\\Users\\Abdul\\.gemini\\antigravity\\brain\\a6f01a68-8fa8-43f3-a397-c5eef8de341b\\click_3_promo_closed.png' });

  } catch (err) {
    console.error('Click test crashed:', err.stack);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
