// Raw store screenshots of the Route Relay Driver app, with INVENTED sample data (sample-data.mjs): the
// real driver screens from a LOCAL build of the Orest web app, every driver-portal API call answered in the
// browser from the sample data. No sign-in, no real driver, nothing reaches orestexpress.online.
// (The review demo driver is not usable for this: it carries the account holder's name, phone and email.)
//
// 1. Build and start the web app locally (from the Orest repo's tms-frontend-next):
//      npx next build --webpack --experimental-build-mode compile
//      cp <prod config.js> public/config.js, then set API_URL to "http://127.0.0.1:9" (a dead port)
//      npx next start -p 3510
// 2. cd play-store-assets && node capture-screenshots.mjs   -> raw/<size>/<n-page>.png
// 3. node frame-screenshots.mjs                             -> ../fastlane
// Env: BASE (default http://127.0.0.1:3510), ONLY_SIZE, CHROME_PATH, PLAYWRIGHT_MODULE.

import { mkdir } from 'node:fs/promises';
import SAMPLE, { DRIVER, LOADS } from './sample-data.mjs';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || '/opt/tms/app/orest_tms_full/tms-frontend-next/node_modules/playwright-core/index.mjs'
);
const BASE = process.env.BASE || 'http://127.0.0.1:3510';
const API = 'http://127.0.0.1:9'; // config.js API_URL of the local build: a dead port

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const AND = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const ANDTAB = 'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const SIZES = {
  iphone: { width: 430, height: 932, scale: 3, ua: IOS },     // 1290x2796
  ipad: { width: 1024, height: 1366, scale: 2, ua: IPAD },    // 2048x2732
  phone: { width: 360, height: 640, scale: 3, ua: AND },      // 1080x1920
  tab7: { width: 600, height: 960, scale: 2, ua: ANDTAB },    // 1200x1920
  tab10: { width: 800, height: 1280, scale: 2, ua: ANDTAB },  // 1600x2560
};
const PAGES = [
  { slug: '1-dashboard', url: '/driver/dashboard' },
  { slug: '2-load', url: `/driver/loads/${LOADS[0].id}` },
  { slug: '3-messages', url: '/driver/messages' },
  { slug: '4-fuel', url: '/driver/fuel' },
  { slug: '5-profile', url: '/driver/profile' },
];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// The client only reads the token's expiry; no server ever sees it (every API call is answered below).
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: DRIVER.id, type: 'driver', exp: 4102444800 })}.sample`;
const ANSWERS = {
  ...SAMPLE,
  'GET /loads': LOADS,
  'GET /messages/unread': { total: 2, conversations: 1, safety_reviews_enabled: false, safety_events_enabled: false },
  'GET /notification-tone': { tone: 'default' },
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [size, v] of Object.entries(SIZES)) {
  if (process.env.ONLY_SIZE && process.env.ONLY_SIZE !== size) continue;
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.scale, isMobile: true, hasTouch: true,
    userAgent: v.ua, colorScheme: 'dark', reducedMotion: 'reduce', timezoneId: 'America/Chicago', locale: 'en-US',
  });
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem('driver_token', t);
    localStorage.setItem('driver_user', u);
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      if (typeof k === 'string' && (k === 'driver-pwa-banner-dismissed' || k.startsWith('driver-notif-prompt-dismissed:'))) return '1';
      return get.call(this, k);
    };
  }, [TOKEN, JSON.stringify(DRIVER)]);
  await ctx.route(`${API}/**`, (r) => {
    const u = new URL(r.request().url());
    const key = `${r.request().method()} ${u.pathname.replace('/api/v1/driver-portal', '')}`;
    const body = ANSWERS[key];
    if (body === undefined) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"not in sample data"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  // nothing else leaves the machine except map tiles and fonts
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost|[a-z0-9.-]*tomtom\.com|fonts\.)/, (r) => r.abort());
  const page = await ctx.newPage();
  await mkdir(`raw/${size}`, { recursive: true });
  for (const pg of PAGES) {
    await page.goto(`${BASE}${pg.url}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `raw/${size}/${pg.slug}.png` });
  }
  console.log(`driver ${size} done`);
  await ctx.close();
}
await browser.close();
