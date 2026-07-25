// Playwright script — captures Play Store screenshots from the live driver portal.
// Uses the demo driver creds (7737444848 / 8186) provisioned for App Store reviewers.
//
// Run:  node capture-screenshots.mjs
// Outputs: ./shots/{phone,tablet-portrait,tablet-landscape}/{login,dashboard,messages,profile}.png

import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const BASE = 'https://orestexpress.online';
const PHONE = process.env.DRIVER_PHONE || '7737444848';
const PIN = process.env.DRIVER_PIN || '8186';

// Output PNG = viewport CSS px × deviceScaleFactor. Google Play rejects any
// dimension > 3840px; Apple wants EXACT device pixels per size class.
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

const VIEWPORTS = {
  // Google Play (≤3840px)
  phone: { width: 360, height: 800, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ua: ANDROID_UA }, // 1080x2400
  'tablet-portrait': { width: 1600, height: 2560, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ua: ANDROID_UA },
  'tablet-landscape': { width: 2560, height: 1600, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ua: ANDROID_UA },
  // Apple App Store — exact pixel sizes per size class
  'iphone-69': { width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ua: IOS_UA }, // 1320x2868 (6.9")
  'iphone-65': { width: 428, height: 926, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ua: IOS_UA }, // 1284x2778 (6.5")
  // Apple REQUIRES an iPad Pro 12.9" shot whenever the build declares iPad
  // support (TARGETED_DEVICE_FAMILY includes 2), else review submission 409s
  // with STATE_ERROR.SCREENSHOT_REQUIRED.APP_IPAD_PRO_3GEN_129.
  'ipad-129': { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ua: IOS_UA }, // 2048x2732
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
  // CHROMIUM_PATH lets this run on hosts where playwright's bundled browsers
  // are unavailable (e.g. the TMS server: CHROMIUM_PATH=/snap/bin/chromium).
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    userAgent: viewport.ua,
    colorScheme: 'dark',
  });
  // Suppress the PWA-install and push-permission prompts. Store screenshots must
  // not reference other install methods (Apple rejects that), and both banners
  // still render the pre-rebrand name. The notification prompt's key is suffixed
  // with the driver id, so intercept by prefix rather than seeding a fixed key.
  await context.addInitScript(() => {
    const origGet = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      if (typeof k === 'string' &&
          (k === 'driver-pwa-banner-dismissed' ||
           k.startsWith('driver-notif-prompt-dismissed:'))) {
        return '1';
      }
      return origGet.call(this, k);
    };
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
  const only = process.env.ONLY_VIEWPORT;
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    if (only && name !== only) continue;
    try {
      await captureFor(name, vp);
    } catch (err) {
      console.error(`!! ${name} failed:`, err.message);
    }
  }
  console.log('\nDone.');
})();
