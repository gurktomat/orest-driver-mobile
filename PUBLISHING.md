# Store publishing runbook — Orest Driver (and notes for Orest Express TMS)

State as of 2026-07-21. CI/signing/distribution plumbing is DONE for both apps on both
platforms; what remains is store-console work (listings, compliance forms, promotion)
plus final screenshot polish. Console steps below are ordered — top to bottom is the
critical path.

## Where things stand

| | Orest Driver (com.orestexpress.driver) | Orest Express (com.orestexpress.tms) |
|---|---|---|
| iOS build+sign | ✓ Codemagic (ad-hoc + TestFlight workflows) | ✓ same |
| TestFlight | ✓ **external beta live** — passed Apple beta review; demo creds + privacy URL on file in ASC Test Information | ✓ internal only |
| Android build+sign | ✓ release APK (sideload) + AAB | ✓ |
| Google Play | ✓ AAB auto-publishes to **internal track** (SA `codemagic-play-publisher@orest-driver-publishing.iam`) | ✓ internal track |
| targetSdk | 36 (ahead of Play's requirement) | 36 |
| Privacy declarations | `play-store-assets/data-safety.json` + `ios/App/App/PrivacyInfo.xcprivacy` — **location claims corrected 2026-07-21** (app no longer requests/collects location; b336518 removed the plugin+permissions) | data-safety.json present (no location — correct) |
| Store graphics | icon-512 ✓, feature graphic ✓, screenshots: `play-store-assets/shots/` (5 sizes incl. Apple 6.9"/6.5") — **empty-state placeholders, re-cut before submitting** (below) | missing icon-512/feature graphic/screenshots |
| Privacy policy | ✓ live: https://orestexpress.online/privacy-policy | same URL |
| Listing text | drafts in `play-store-assets/listing-copy.md` | not written |

## Decisions needed before public release

1. **Brand.** Recommended: publish the driver app as **"Orest Driver"** now. The bundle id
   (`com.orestexpress.driver`) is permanent either way; the *display* name/icon can be
   rebranded in a later release. Route Relay's multi-tenant product should get its own
   white-label apps (new bundle ids per brand) when that ships — don't block Orest's
   drivers on that.
2. **Play account type.** Check Play Console → account. If it's a **personal** account
   created after Nov 2023, Google requires a closed test with ≥20 testers for 14
   consecutive days before production access — if so, start the closed track NOW to
   start the clock. Organization accounts skip this.
3. **Express TMS app: don't go public-store.** It's an internal dispatcher tool until
   Route Relay. Recommended: Apple **Unlisted App Distribution** (link-only install,
   request via ASC support form) + Play **closed track**. A public listing invites
   Guideline 4.2 scrutiny for no benefit.

## Driver → Google Play production

1. Play Console → Store presence → **Main store listing**: title `Orest Driver`,
   short + full description from `play-store-assets/listing-copy.md`;
   graphics: `icon-512.png`, `feature-graphic-1024x500.png`, ≥2 phone screenshots
   from `shots/phone/` (tablet sets optional but present).
2. Policy → **App content**:
   - Privacy policy URL: `https://orestexpress.online/privacy-policy`
   - **Data safety** — enter exactly what `data-safety.json` says (location = NOT collected).
   - Content rating questionnaire → Utility/Business → Everyone.
   - Target audience: 18+. Ads: none. News app: no. COVID: no.
   - **App access**: "Restricted access" → demo credentials phone `7737444848`, PIN `8186`,
     note: *"Driver accounts are provisioned by the carrier's dispatch office; there is no
     self-signup. The demo account is a real sandbox driver in the production system."*
3. Release → promote the latest **internal** build → closed (if the 14-day rule applies)
   or straight to **Production** → roll out (start 20% staged if cautious).
4. Leave `codemagic.yaml` `track: internal` — CI keeps feeding internal; promote per
   release in the console. Flip to `production` later only if you want push-to-prod CI.

## Driver → Apple App Store

1. ASC → Orest Driver → App Store tab → **1.0 Prepare for Submission**: description +
   keywords from `listing-copy.md`, support URL `https://orestexpress.online`,
   screenshots from `shots/iphone-69/` (6.9" — required; 6.5" set also captured).
2. **App Privacy** (nutrition labels): mirror `PrivacyInfo.xcprivacy` — collects phone,
   name, email, photos, user ID, device ID, crash/performance data; all linked to
   identity, **none used for tracking, NO location**.
3. **App Review Information**: demo `7737444848` / `8186` (already on file from
   TestFlight). Notes field — preempt the two likely flags:
   - *B2B*: "App for professional drivers of freight carriers using our TMS. Accounts
     are provisioned by the carrier's dispatch — the app has no account creation, so
     Guideline 5.1.1(v) account deletion does not apply; data deletion is available on
     request per the privacy policy."
   - *4.2 defense*: native push (APNs channels for load assignment vs messages), camera
     document capture (BOL/POD), Face ID login, offline caching, haptics.
4. Export compliance: HTTPS only → exempt encryption. Content rights: n/a.
5. Select the latest TestFlight build → **Submit for Review**.

**Rejection playbook:** 4.2 (minimum functionality) → reply with the native-capability
list + video; 2.1 (login issues) → re-verify demo creds before resubmitting; 5.1.1
(account deletion) → point at the no-self-signup note + privacy policy deletion path.

## Re-cutting screenshots (before submitting either store)

Current shots show an empty dashboard ("No loads assigned") + web-only install banners.
For the final pass:
1. Assign the demo driver (`7737444848`) a realistic throwaway load (create via TMS,
   delete after capture — prod tenant, use the throwaway-shipment recipe).
2. Dismiss the install/push banners in the capture session (or seed their localStorage
   dismiss keys in the script).
3. `cd play-store-assets && CHROMIUM_PATH=/snap/bin/chromium node capture-screenshots.mjs`
   (script installs via `npm i --no-save playwright-core` if node_modules is fresh).
   Outputs land in `shots/` (gitignored).

## CI cautions

- **Pushing this repo to `main` auto-triggers** `ios-driver-adhoc` + `android-driver-release`
  (mac mini minutes + a new AAB on the Play internal track). TestFlight workflow is
  manual-trigger only.
- iOS `MARKETING_VERSION` and Android `versionName` are both `1.0` — bump together per
  release. Android `versionCode` auto-increments via Codemagic `BUILD_NUMBER`; iOS build
  number is epoch-minutes.
- Keep `data-safety.json` ↔ `PrivacyInfo.xcprivacy` in sync (same data, both stores).

## Express app (when its turn comes)

Needs: icon-512 + feature graphic + screenshots (no capture script yet — copy the driver
one, admin login), listing text, Apple unlisted-distribution request (or ABM custom app),
demo admin account for review. Its iOS icon already carries Route Relay branding
(841c750) — align the branding decision before submitting anywhere.
