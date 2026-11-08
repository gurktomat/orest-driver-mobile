// Store screenshots with captions: the brand's near-black night, a two-line headline (second line in Relay
// Blue), the app's screen below in a rounded frame. Exact store pixel sizes, opaque (App Store rejects alpha).
// Run on the server:  cd play-store-assets && node frame-screenshots.mjs <app>   (reads raw/, writes ../fastlane)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE || '/opt/tms/app/orest_tms_full/tms-frontend-next/node_modules/sharp/dist/index.cjs');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/tms/app/orest_tms_full/tms-frontend-next/node_modules/playwright-core/index.mjs');
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=Manrope:wght@700;800&display=block">';
const page = (body) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>*{box-sizing:border-box}html,body{margin:0;background:transparent}body{font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}</style></head><body>${body}</body></html>`;
let browser;
async function render(html, w, h) {
  browser ??= await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const tab = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await tab.setContent(html, { waitUntil: 'networkidle' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  const shot = await tab.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
  await tab.close();
  return shot;
}
const close = () => browser?.close();
const APP = process.argv[2] || 'driver';
const RAW = 'raw';
const REPO = '..';

const CAPTIONS = {
  tms: {
    '1-dashboard': ['Your whole operation', 'at a glance'],
    '2-dispatch': ['Dispatch every load', 'from one board'],
    '3-loads': ['Every load, from booking', 'to delivery'],
    '4-map': ['See your fleet', 'on the map'],
    '5-settlements': ['Driver settlements,', 'ready to pay'],
  },
  dock: {
    '1-today': ["Today's dock schedule,", 'door by door'],
    '2-todo': ["Know what's next", 'for every crew'],
    '3-working': ['Mark each door done', 'as you finish'],
  },
  driver: {
    '1-dashboard': ['Your load and stops,', 'front and center'],
    '2-load': ['Every stop,', 'step by step'],
    '3-messages': ['Message dispatch', 'in real time'],
    '4-fuel': ['Fuel stops', 'and what you saved'],
    '5-profile': ['Your truck, trailer', 'and requests'],
  },
};
const APP_NAME = { tms: 'ROUTE RELAY TMS', dock: 'ROUTE RELAY DOCK', driver: 'ROUTE RELAY DRIVER' };
const CANVAS = {
  iphone: [1290, 2796], ipad: [2048, 2732], phone: [1080, 1920], tab7: [1200, 1920], tab10: [1600, 2560],
};
const NIGHT = 'radial-gradient(60% 34% at 85% 104%,rgba(255,122,0,.28),transparent 70%),radial-gradient(70% 30% at 10% -4%,rgba(53,178,234,.20),transparent 66%),linear-gradient(180deg,#0b0b0c 0%,#08080a 100%)';

const frame = (w, h, shotUri, shotW, shotH, [l1, l2], appName) => {
  const tablet = w / h > 0.6;
  const head = Math.round(h * (tablet ? 0.15 : 0.19));
  const fs1 = Math.round(w * (tablet ? 0.052 : 0.074));
  const pad = Math.round(w * (tablet ? 0.08 : 0.07));
  const availW = w - pad * 2, availH = h - head - Math.round(h * 0.035);
  const k = Math.min(availW / shotW, availH / shotH);
  const sw = Math.round(shotW * k), sh = Math.round(shotH * k);
  const r = Math.round(sw * (tablet ? 0.03 : 0.07));
  return page(`<div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${NIGHT};font-family:Manrope,Inter,sans-serif">
    <div style="position:absolute;left:0;right:0;top:0;height:${head}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div style="font:600 ${Math.round(fs1 * 0.3)}px Inter,sans-serif;letter-spacing:.32em;padding-left:.32em;color:#35b2ea;margin-bottom:${Math.round(fs1 * 0.32)}px">${appName}</div>
      <div style="font-weight:800;font-size:${fs1}px;line-height:1.08;letter-spacing:-.02em;color:#fff">${l1}</div>
      <div style="font-weight:800;font-size:${fs1}px;line-height:1.08;letter-spacing:-.02em;color:#35b2ea">${l2}</div>
    </div>
    <div style="position:absolute;left:${Math.round((w - sw) / 2)}px;top:${head}px;width:${sw}px;height:${sh}px;border-radius:${r}px;overflow:hidden;box-shadow:0 ${Math.round(sw * 0.03)}px ${Math.round(sw * 0.08)}px rgba(0,0,0,.6),0 0 0 ${Math.max(2, Math.round(sw * 0.004))}px rgba(255,255,255,.14)">
      <img src="${shotUri}" style="display:block;width:${sw}px;height:${sh}px" alt="">
    </div>
  </div>`);
};

const caps = CAPTIONS[APP];
const outIos = path.join(REPO, 'fastlane/screenshots/en-US');
const outAnd = path.join(REPO, 'fastlane/metadata/android/en-US/images');
const ANDDIR = { phone: 'phoneScreenshots', tab7: 'sevenInchScreenshots', tab10: 'tenInchScreenshots' };
for (const [size, [w, h]] of Object.entries(CANVAS)) {
  const dir = path.join(RAW, size);
  if (!fs.existsSync(dir)) { console.log('no raw', size); continue; }
  const slugs = Object.keys(caps).filter((s) => fs.existsSync(path.join(dir, `${s}.png`)));
  let i = 0;
  for (const slug of slugs) {
    i++;
    const raw = fs.readFileSync(path.join(dir, `${slug}.png`));
    const m = await sharp(raw).metadata();
    const html = frame(w, h, `data:image/png;base64,${raw.toString('base64')}`, m.width, m.height, caps[slug], APP_NAME[APP]);
    const png = await sharp(await render(html, w, h)).flatten({ background: '#08080a' }).png({ compressionLevel: 9 }).toBuffer();
    let out;
    if (size === 'iphone' || size === 'ipad') { fs.mkdirSync(outIos, { recursive: true }); out = path.join(outIos, `${size}-${slug}.png`); }
    else { fs.mkdirSync(path.join(outAnd, ANDDIR[size]), { recursive: true }); out = path.join(outAnd, ANDDIR[size], `${i}.png`); }
    fs.writeFileSync(out, png);
  }
  console.log(APP, size, slugs.length, 'framed');
}
await close();
