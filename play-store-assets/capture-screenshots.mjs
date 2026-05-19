// Playwright script — captures Play Store screenshots from the live driver portal.
// Uses the demo driver creds (7737444848 / 8186) provisioned for App Store reviewers.
//
// Run:  node capture-screenshots.mjs
// Outputs: ./shots/{phone,tablet-portrait,tablet-landscape}/{login,dashboard,messages,profile}.png

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const BASE = 'https://orestexpress.online';
const PHONE = process.env.DRIVER_PHONE || '7737444848';
const PIN = process.env.DRIVER_PIN || '8186';

const VIEWPORTS = {
  phone: { width: 1080, height: 1920, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'tablet-portrait': { width: 1600, height: 2560, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'tablet-landscape': { width: 2560, height: 1600, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const PAGES = [
  { slug: 'login', url: '/driver/login', loginFirst: false, wait: 1500 },
  { slug: 'dashboard', url: '/driver/dashboard', loginFirst: true, wait: 2500 },
  { slug: 'messages', url: '/driver/messages', loginFirst: true, wait: 2500 },
  { slug: 'profile', url: '/driver/profile', loginFirst: true, wait: 2500 },
];

async function login(page) {
  await page.goto(`${BASE}/driver/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Phone field
  const phoneInput = page.locator('input[type="tel"], input[placeholder*="hone"], input[autocomplete="tel"]').first();
  await phoneInput.fill(PHONE);
  // PIN field
  const pinInput = page.locator('input[type="password"], input[inputmode="numeric"][maxlength="4"], input[placeholder*="PIN"]').first();
  await pinInput.fill(PIN);
  // Submit
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  // Wait for navigation away from login
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function captureFor(viewportName, viewport) {
  console.log(`\n=== ${viewportName} (${viewport.width}x${viewport.height}) ===`);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  let loggedIn = false;

  for (const target of PAGES) {
    if (target.loginFirst && !loggedIn) {
      await login(page);
      loggedIn = true;
    }
    if (target.url !== page.url().replace(BASE, '')) {
      console.log(`  → ${target.url}`);
      await page.goto(`${BASE}${target.url}`, { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(target.wait);
    const out = `shots/${viewportName}/${target.slug}.png`;
    await mkdir(dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: false });
    console.log(`  ✓ ${out}`);
  }

  await browser.close();
}

(async () => {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    try {
      await captureFor(name, vp);
    } catch (err) {
      console.error(`!! ${name} failed:`, err.message);
    }
  }
  console.log('\nDone.');
})();
