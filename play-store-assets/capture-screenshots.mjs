// Raw store screenshots of the Route Relay Driver app (the live driver portal), at every App Store and
// Google Play size. Signs in as the App Store review demo driver, which belongs to the synthetic demo
// tenant ("Route Relay Demo": fictional loads, brokers and 555-01xx numbers). Store screenshots are
// public: NEVER point this at a real driver.
//
// Run on the server (system Chrome, the Orest web app's Playwright; nothing to install):
//   cd play-store-assets && node capture-screenshots.mjs
// Optional env: DRIVER_PHONE / DRIVER_PIN (the review account by default), ONLY_SIZE=iphone,
//   CHROME_PATH (default /usr/bin/google-chrome), PLAYWRIGHT_MODULE (path to playwright-core).
// Output: raw/<size>/<n-page>.png. scripts/ in the store folder frames them with captions.

import { mkdir } from 'node:fs/promises';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || '/opt/tms/app/orest_tms_full/tms-frontend-next/node_modules/playwright-core/index.mjs'
);

const BASE = 'https://orestexpress.online';
const PHONE = process.env.DRIVER_PHONE || '7737444848';
const PIN = process.env.DRIVER_PIN || '8186';

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const AND = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const ANDTAB = 'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

// Raw pixel sizes: App Store 6.7/6.9" iPhone and 12.9/13" iPad slots; Play phone, 7" and 10" tablet.
const SIZES = {
  iphone: { width: 430, height: 932, scale: 3, ua: IOS },     // 1290x2796
  ipad: { width: 1024, height: 1366, scale: 2, ua: IPAD },    // 2048x2732
  phone: { width: 360, height: 640, scale: 3, ua: AND },      // 1080x1920
  tab7: { width: 600, height: 960, scale: 2, ua: ANDTAB },    // 1200x1920
  tab10: { width: 800, height: 1280, scale: 2, ua: ANDTAB },  // 1600x2560
};

const PAGES = [
  { slug: '1-dashboard', url: '/driver/dashboard' },
  { slug: '2-loads', url: '/driver/loads' },
  { slug: '3-documents', url: '/driver/documents' },
  { slug: '4-messages', url: '/driver/messages' },
  { slug: '5-fuel', url: '/driver/fuel' },
  { slug: '6-profile', url: '/driver/profile' },
];

async function login(page) {
  await page.goto(`${BASE}/driver/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('input[type="tel"], input[placeholder*="hone"], input[autocomplete="tel"]').first().fill(PHONE);
  await page.locator('input[type="password"], input[inputmode="numeric"][maxlength="4"], input[placeholder*="PIN"]').first().fill(PIN);
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30000 });
  await page.waitForTimeout(2000);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
for (const [size, v] of Object.entries(SIZES)) {
  if (process.env.ONLY_SIZE && process.env.ONLY_SIZE !== size) continue;
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.scale,
    isMobile: true,
    hasTouch: true,
    userAgent: v.ua,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  // The PWA-install and push-permission prompts are not part of the native app (and Apple rejects
  // screenshots that mention another install method). The notification key carries the driver id.
  await ctx.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      if (typeof k === 'string' && (k === 'driver-pwa-banner-dismissed' || k.startsWith('driver-notif-prompt-dismissed:'))) return '1';
      return get.call(this, k);
    };
  });
  const page = await ctx.newPage();
  try {
    await login(page);
    await mkdir(`raw/${size}`, { recursive: true });
    for (const pg of PAGES) {
      await page.goto(`${BASE}${pg.url}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `raw/${size}/${pg.slug}.png` });
      console.log(`  ${size} ${pg.slug}`);
    }
  } catch (err) {
    console.error(`!! ${size} failed: ${err.message}`);
  }
  await ctx.close();
}
await browser.close();
console.log('Done: raw/<size>/*.png');
