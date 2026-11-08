# Store assets

The store listings live in `../fastlane` (text in `metadata/`, App Store screenshots in `screenshots/`,
Play images in `metadata/android/en-US/images/`). Codemagic uploads them with the manual workflows
**store listing (App Store)** and **store listing (Google Play)**; nothing is submitted for review.

## Re-cutting the screenshots (on the server)

```
cd play-store-assets
node capture-screenshots.mjs        # raw/<size>/*.png (local build on :3510 first, see the script)
node frame-screenshots.mjs          # captioned, exact store sizes -> ../fastlane
```

Sizes: iPhone 1290x2796 (6.7/6.9" slot), iPad 2048x2732 (12.9/13"), Play phone 1080x1920, 7" tablet
1200x1920, 10" tablet 1600x2560. Captions are in `frame-screenshots.mjs`.

Data source: invented sample data (`sample-data.mjs`: a made-up driver, loads, messages, fuel stops) on
the real driver screens from a LOCAL build of the Orest web app; the browser answers every driver-portal
call from the sample data, so nothing signs in and nothing reaches orestexpress.online. Steps (build,
dead-port config.js, `next start -p 3510`) are at the top of `capture-screenshots.mjs`. The App Store
review demo driver is NOT usable for screenshots: it carries the account holder's name, phone and email.

Never capture a real customer, driver or load: store screenshots are public.
Uses system Chrome and the Orest web app's Playwright and sharp (no install). `raw/` is git-ignored.
