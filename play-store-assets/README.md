# Store assets

The store listings live in `../fastlane` (text in `metadata/`, App Store screenshots in `screenshots/`,
Play images in `metadata/android/en-US/images/`). Codemagic uploads them with the manual workflows
**store listing (App Store)** and **store listing (Google Play)**; nothing is submitted for review.

## Re-cutting the screenshots (on the server)

```
cd play-store-assets
node capture-screenshots.mjs        # raw/<size>/*.png
node frame-screenshots.mjs          # captioned, exact store sizes -> ../fastlane
```

Sizes: iPhone 1290x2796 (6.7/6.9" slot), iPad 2048x2732 (12.9/13"), Play phone 1080x1920, 7" tablet
1200x1920, 10" tablet 1600x2560. Captions are in `frame-screenshots.mjs`.

Data source: the App Store review demo driver in the synthetic demo tenant (phone and PIN in
`capture-screenshots.mjs`), signed in by the script on orestexpress.online.

Never capture a real customer, driver or load: store screenshots are public.
Uses system Chrome and the Orest web app's Playwright and sharp (no install). `raw/` is git-ignored.
