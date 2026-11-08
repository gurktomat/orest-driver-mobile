# Store listing - Route Relay Driver

The listing text is in `../fastlane/metadata` and is the source of truth (2026-11 rewrite, new brand):
- App Store: `metadata/en-US/` (name, subtitle, promotional text, description, keywords, release notes, URLs)
- Google Play: `metadata/android/en-US/` (title, short and full description, icon, feature graphic, screenshots)

Codemagic uploads both with the manual workflows "store listing (App Store)" and "store listing
(Google Play)". Edit the text files there, not here. Keep claims matched to shipped features.

## URLs
- Support: https://orestexpress.online
- Marketing: https://routerelay.io
- Privacy policy: https://orestexpress.online/privacy-policy
- Data deletion: https://orestexpress.online/privacy-policy#data-deletion

## Review notes (both stores - paste into review/app-access fields)
Demo account: phone 7737444848, PIN 8186 (real sandbox driver in production).
Driver accounts are provisioned by the carrier's dispatch office; the app has no
account creation. Native capabilities beyond the embedded portal: APNs/FCM push
with per-type channels, camera document capture, biometric login, offline cache.
