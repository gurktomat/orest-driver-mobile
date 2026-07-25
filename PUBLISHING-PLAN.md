# Store Publishing Plan — Orest Driver + Route Relay TMS

**State verified 2026-07-23** against the live App Store Connect API and Google Play Console.
Companion to `PUBLISHING.md` (which is the *how*); this file is the *what's left and in what order*.

---

## The one scheduling fact that drives everything

Google Play's account is **personal** (`idobby`, ID 6724950143902630431). Personal accounts must
run a **closed test with ≥12 testers opted in for 14 continuous days** before they may even
*apply* for production access. That 14-day clock cannot be compressed, and it does not start
until an AAB is actually live on a closed track.

**Therefore: start the Google closed test first.** Everything else — Apple screenshots, Apple
metadata, Apple submission — runs in parallel underneath that clock. Doing Apple first and
Google second adds ~3 weeks of wall time for no reason.

Realistic earliest dates, if the Google track goes live on day 0:

| Milestone | Earliest |
| --- | --- |
| Apple: Route Relay Driver live | ~5–8 days (rename + rebuild + screenshots + review) |
| Apple: Route Relay TMS live (unlisted) | ~1–2 weeks (metadata + separate unlisted approval) |
| Google: closed test LIVE | submitted 2026-07-23; Google review up to ~7 days |
| Google: production access can be applied for | ~7 days review + 14 days testing ≈ 3 weeks |
| Google: both apps live | ~4–5 weeks |

**Status 2026-07-23: Play submission SENT.** Driver app's first-ever AAB (version 9 (1.0),
target SDK 36) is uploaded to the closed Alpha track and 13 changes are in review — release,
store listing (now "Route Relay Driver"), and all app-content declarations. The 14-day tester
clock does **not** start until Google approves and the track goes live.

---

## Verified current state

### Apple — App Store Connect

Both apps sit at version **1.0**, state **PREPARE_FOR_SUBMISSION**.

**Orest Driver** (app `6764219438`, `com.orestexpress.driver`) — one blocker only:

| Item | State |
| --- | --- |
| Build attached | ✅ 29744320 |
| Description / keywords / support URL | ✅ |
| Subtitle / privacy policy URL | ✅ |
| Primary category | ✅ BUSINESS |
| Age rating | ✅ 4+ |
| TestFlight external | ✅ live (`join/tpKZeC6s`) |
| **Screenshots** | ❌ **NONE — blocking** |
| **Rename to "Route Relay Driver"** | ❌ pending (Phase 0.5) — needs a fresh build too |

**Route Relay TMS** (app `6764661215`, `com.orestexpress.tms`) — substantially incomplete:

| Item | State |
| --- | --- |
| Build attached to 1.0 | ❌ none (29746923 is on TestFlight but not attached) |
| Description / keywords / support URL | ❌ empty |
| Subtitle / privacy policy URL | ❌ empty |
| Primary category | ❌ unset |
| Age rating | ⚠️ declaration exists but age band unresolved |
| Screenshots | ❌ none |
| TestFlight external | ✅ live (`join/MucM3729`, build 29746923) |

### Google — Play Console

Account-level: **1 user, 0 permission groups** — the Codemagic service account was never
invited, so every CI upload fails `caller does not have permission`. Android developer
verification is ✅ satisfied for both apps.

**Driver** (`4972278831977107395`) — Draft, 0 installs, updated Jul 21:

- ❌ **App bundle explorer is EMPTY. No AAB has ever reached Play.** This is the top blocker.
- Staged but *not submitted*: closed testing Alpha (US, tester list "Route Relay"), en-US store
  listing, content rating questionnaire, target audience 18+, privacy policy URL, ads
  declaration, data safety, health apps declaration, app category (Productivity).
- "Send app for review" is disabled until the dashboard's required steps are done.

**Route Relay TMS** — Draft, 0 installs, untouched since Apr 29. Assume everything above is
outstanding for it too.

---

## Shared dependency: screenshots

Screenshots block Apple for both apps and are required for both Play listings. The capture
pipeline exists (`play-store-assets/capture-screenshots.mjs`, sizes fixed 2026-07-21: 1080x2400
Play, Apple-exact 6.9" 1320x2868 and 6.5" 1284x2778) but **current output is empty-state
placeholders** — the demo driver account has no loads and the web install banners are visible.

Do this once, properly, and it unblocks four submissions:

1. Stage a throwaway demo load against the demo driver (`7737444848` / PIN `8186`) so the
   screens show real content.
2. Dismiss/suppress the web install banners in the capture run.
3. `npm i --no-save playwright-core`, then capture with `CHROMIUM_PATH=/snap/bin/chromium`.
4. Review every shot for real customer names / addresses / rates before upload — these become
   public marketing assets.
5. Upload: Apple via API (`appScreenshotSets` → `appScreenshots`), Play via console UI.

---

## Plan

### Phase 0 — DECIDED 2026-07-23 (Jaroslav)

1. **Brand → publish the driver app as "Route Relay Driver."** (Chosen over keeping
   "Orest Driver"; aligns with the Route Relay commercialization direction.)
2. **TMS app → unlisted / closed.** Apple unlisted distribution (link-only), Play closed track
   only. Not publicly listed. Start the Apple unlisted request early — Apple reviews it
   separately from the build.
3. **Google upload → do both.** Manually upload the Codemagic build #7 AAB now to start the
   14-day clock today, *and* invite the service account
   (`codemagic-play-publisher@orest-driver-publishing.iam`) with the two testing-track
   permissions so future CI works. **Jaroslav must click Invite — an assistant cannot grant
   account access.**

### Phase 0.5 — rebrand work created by decision 1

The store name is not the whole job: the **on-device** name is `Orest Driver` in three places,
and a large store-vs-device name mismatch is a real Apple review risk (guideline 2.3.7) as well
as confusing for drivers looking at their own home screens.

Rename in the driver shell:

- `ios/App/App/Info.plist` → `CFBundleDisplayName`
- `android/app/src/main/res/values/strings.xml` → `app_name`
- `capacitor.config.json` → `appName`

Then rebuild both platforms and upload fresh binaries. Also rename the store listings: Apple
`appInfoLocalizations.name` (currently "Orest Driver") and Play's listing name (currently
"Driver").

**Sequencing — this does NOT need to block Phase 1.** Play's 14-day requirement counts days with
≥12 testers opted in; replacing the build mid-test does not reset it. So start the closed test
with the existing build #7 AAB, and land the renamed build during the 14 days.

**It does change the Apple driver timeline.** Orest Driver is no longer "screenshots away" — it
now needs screenshots **plus** the rename plus a fresh build attached to version 1.0. If you'd
rather keep Apple on the original fast path, the alternative is to submit as "Orest Driver" now
and rebrand in version 1.1 — say so and I'll re-sequence.

⚠️ Capture screenshots **after** the rename, or every shot shows the old name and has to be
re-cut.

### Phase 1 — start the Google clock (do first, same day)

1. Upload an AAB to the Driver **closed (Alpha)** track — manually if the SA invite isn't done.
2. Complete Play's required app content: content rating questionnaire, target audience 18+,
   privacy policy URL (`https://orestexpress.online/privacy-policy`), ads declaration (no ads),
   data safety, health apps declaration, app category.
3. Finish the en-US store listing (needs the screenshots above; a first pass can use
   placeholder-free basic shots and be improved later — listing graphics are editable anytime).
4. **Send app for review** → once the closed release is live, recruit **≥12 testers to actually
   opt in** via the tester link. Opting in is the part people forget; 89 emails on a list is not
   12 opted-in testers. Track the count.
5. Day 14: **Apply for production access.**

### Phase 2 — Apple, Orest Driver (parallel with Phase 1)

1. Capture and upload screenshots (shared dependency above).
2. Re-verify build attachment — 29744320 is currently attached; attach a newer build if you
   ship one first.
3. Submit for review. Expect 1–3 days. Demo credentials and B2B review notes are already set.

### Phase 3 — Apple, Route Relay TMS

1. Decide unlisted vs public (Phase 0.2). If unlisted, request an unlisted distribution link —
   note Apple reviews that request separately, so start it early.
2. Fill metadata: subtitle, privacy policy URL, primary category, description, keywords,
   support URL, resolve the age rating band.
3. Attach build 29746923 to version 1.0.
4. Screenshots, then submit.

### Phase 4 — Google, Route Relay TMS

Mirrors Phase 1 but on a closed track only (per Phase 0.2). Nothing here is on the critical
path — do it after the driver app clears.

---

## Risks

- **The 14-day clock is the whole schedule.** Any slip in Phase 1 slips the launch one-for-one.
- **Tester opt-in shortfall.** Fewer than 12 *opted-in* testers for 14 continuous days resets
  progress. Over-recruit; aim for 20.
- **CI is not wired.** The GitHub→Codemagic webhook is dead and Play publishing config is
  broken (`release_status` dropped; draft apps reject non-draft API publishes). All builds are
  manual today. Fix after launch, not before — do not let it block Phase 1.
- **Screenshot content leakage.** These are public. Review for real customer data before upload.
- **Apple rejection risk on the TMS app** if submitted as a public consumer app with a
  login-walled experience. Unlisted distribution avoids this.
- **Health apps declaration** appears in Play's required list — answer it truthfully as *not* a
  health app; an incorrect declaration is a policy problem later.
