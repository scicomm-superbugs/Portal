import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  console.log('Starting screenshot capture...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));
  page.on('pageerror', err => console.error('[BROWSER EXCEPTION]', err.stack || err.message));

  const artifactDir = 'C:\\Users\\Abdul\\.gemini\\antigravity\\brain\\dc88f2d2-31f2-413e-85ed-f7fcd52eb8c9';

  try {
    // 1. Visit the portal login page
    console.log('Navigating to local login page...');
    await page.goto('http://localhost:5173/#/portal', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Set the localStorage workspaceId, userId, and scicommDarkMode to bypass login and simulate a logged-in scientist in dark mode
    console.log('Injecting session into localStorage...');
    await page.evaluate(() => {
      localStorage.setItem('workspaceId', 'aiuscicomm');
      localStorage.setItem('userId', 'TobHqkvdBGX0igSUy5Rz'); // Test scientist ID
      localStorage.setItem('scicommDarkMode', 'true');
      localStorage.setItem('scicomm_app_announcement_hidden', 'false'); // Ensure announcement banner is visible for testing
    });

    // 3. Reload to let AuthContext initialize as logged-in in dark mode
    console.log('Reloading to restore session in dark mode...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));

    // Dismiss welcome audio modal
    console.log('Dismissing welcome audio modal...');
    await page.evaluate(() => {
      const letsGoBtn = Array.from(document.querySelectorAll('button')).find(el => el.innerText.includes("Let's Go"));
      if (letsGoBtn) {
        letsGoBtn.click();
        console.log("Welcome audio modal dismissed");
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // Capture main feed in dark mode
    console.log('Capturing home feed...');
    await page.screenshot({ path: path.join(artifactDir, 'dark_feed.png') });

    // Open Workspace dropdown by hovering
    console.log('Hovering over Workspace dropdown...');
    const workspaceElement = await page.evaluateHandle(() => {
      const els = Array.from(document.querySelectorAll('nav div, nav span'));
      return els.find(el => el.innerText.includes('WorkSpace'));
    });
    if (workspaceElement) {
      const box = await workspaceElement.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        console.log('Hovered over Workspace dropdown container successfully');
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(artifactDir, 'workspace_dropdown.png') });

    // Go to Profile page directly
    console.log('Navigating to profile page directly...');
    await page.goto('http://localhost:5173/#/profile', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(artifactDir, 'profile_page.png') });

    // Go to Admin dashboard directly
    console.log('Navigating to Admin dashboard directly...');
    await page.goto('http://localhost:5173/#/admin', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(artifactDir, 'admin_dashboard.png') });

    console.log('Screenshots captured successfully.');
  } catch (err) {
    console.error('Capture script crashed:', err.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
