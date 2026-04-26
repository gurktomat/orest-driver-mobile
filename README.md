# Orest Driver — Android Native App

A Capacitor wrap of the existing PWA at `https://orestexpress.online/driver`,
giving drivers a real installable Android app with custom notification
channels, native camera, foreground service, and FCM push.

## What's done

- **Capacitor 8** project configured to load the live PWA inside a WebView
  (`server.url = "https://orestexpress.online/driver/dashboard"`).
- **Two notification channels** registered at app start (`MainActivity.java`):
  - `orest_driver_default` — IMPORTANCE_HIGH, vibration, system sound. Used for messages.
  - `orest_driver_urgent` — IMPORTANCE_HIGH, longer vibration. For new load assignments.
- **Backend FCM endpoints** at `/api/v1/driver-portal/fcm/{subscribe,unsubscribe,test}`,
  separate from the existing Web Push endpoints.
- **`driver_fcm_subscription` table** (migration 087) keyed to `driver_id`.
- **`fcm_service.send_fcm_to_driver()`** sends FCM HTTP v1 API pushes when
  Firebase service-account JSON is present at `/app/storage/fcm-service-account.json`.
  Until then it's a no-op (returns 0) — safe to deploy ahead of Firebase setup.
- **Driver-message hook** (`services/driver_messages.push_message_to_driver`)
  fires both Web Push (existing PWA) AND FCM (native app) on every dispatcher
  message. Whichever channel the driver has subscribed to wins.
- **Debug APK built and hosted** at `https://orestexpress.online/orest-driver.apk`.
- **Driver-portal install card** appears only on Android browsers (not iOS,
  not when running inside the Capacitor WebView), guides driver through
  the one-time install flow.

## How drivers install

1. Open `https://orestexpress.online/driver` in Chrome on Android.
2. Profile tab → green "Install the Orest Driver Android app" card → tap **Download App**.
3. Open the downloaded `orest-driver.apk` (notification or Files app).
4. If prompted, allow "Install unknown apps" for the browser/Files app.
5. Tap Install → Open. Done.

Future updates: rebuild the APK, replace the file at
`/opt/tms/app/orest_tms_full/tms-frontend-next/public/orest-driver.apk`,
redeploy frontend. Drivers tap the same Download button → installs over
the existing app (debug keystore is stable, no uninstall needed).

## What you (Jaroslav) need to do to enable FCM push

The native app builds and installs without FCM, but pushes don't work
until you configure Firebase. Steps:

### 1. Create a Firebase project (one-time, free)

- Go to <https://console.firebase.google.com>
- Add project: **Orest Driver**
- Skip Google Analytics (or enable, doesn't matter)
- In the project, click **Add app** → Android icon
- Package name: `com.orestexpress.driver`
- App nickname: Orest Driver
- Download `google-services.json`

### 2. Drop config files in two places

```bash
# 1. App-side (for the Android build)
cp google-services.json /opt/tms/tms-driver-android/android/app/google-services.json

# 2. Server-side (for backend FCM sends).
#    Project Settings → Service accounts → Generate new private key →
#    save as fcm-service-account.json:
docker compose -f /opt/tms/app/orest_tms_full/docker-compose.yml \
  cp fcm-service-account.json api:/app/storage/fcm-service-account.json
```

### 3. Add the env var to `docker-compose.yml` under `api.environment:`

```yaml
FCM_SERVICE_ACCOUNT_JSON_PATH: /app/storage/fcm-service-account.json
```

(or leave it — the service defaults to that exact path.)

### 4. Rebuild + redeploy

```bash
# Rebuild Android APK with google-services.json
cd /opt/tms/tms-driver-android/android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
  ANDROID_SDK_ROOT=/opt/android-sdk \
  ANDROID_HOME=/opt/android-sdk \
  ./gradlew assembleDebug --no-daemon
cp app/build/outputs/apk/debug/app-debug.apk \
  /opt/tms/app/orest_tms_full/tms-frontend-next/public/orest-driver.apk

# Redeploy frontend (so drivers download new APK)
cd /opt/tms/app/orest_tms_full && ./scripts/deploy-frontend.sh

# Restart api (so it picks up FCM env)
docker compose up -d --no-deps --force-recreate api
```

### 5. Drivers reinstall

After Firebase is wired, drivers tap **Download App** again → install over →
open → app registers FCM token → next message fires a real Android push.

## Custom notification tones

Drop `.mp3` or `.ogg` files into:

```
android/app/src/main/res/raw/<lowercase_name>.mp3
```

Then in `MainActivity.java`, uncomment the `setSound()` block in the
`urgent` channel registration and point at `raw/<name>` (no extension).

Constraints:
- Lowercase + underscores only (Android resource naming).
- Channel sounds are locked at install time. Once a driver has a channel,
  changing the sound here doesn't affect existing installs — they need to
  uninstall + reinstall, OR you create a new channel with a new id.

## Going to Google Play Store

The current APK is debug-signed (Android default debug keystore). Play
Store requires release signing. To upgrade:

```bash
# Generate a release keystore (DO NOT commit, store the password securely)
keytool -genkeypair -v -keystore orest-driver-release.jks \
  -alias orest-driver -keyalg RSA -keysize 2048 -validity 10950
# Then update android/app/build.gradle with signingConfigs.release
```

Sample `signingConfigs.release` block:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../orest-driver-release.jks')
            storePassword System.getenv("ORST_KS_PWD")
            keyAlias 'orest-driver'
            keyPassword System.getenv("ORST_KS_PWD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

Then `./gradlew bundleRelease` produces an `.aab` for Play Store upload
($25 one-time developer fee at <https://play.google.com/console>).

## Project layout

```
tms-driver-android/
├── capacitor.config.ts          # webDir, server.url, plugins
├── package.json
├── web/index.html               # bootstrap page (immediate redirect to live PWA)
├── android/
│   └── app/
│       ├── build.gradle
│       └── src/main/
│           ├── AndroidManifest.xml      # permissions, deep links, FCM channel
│           ├── res/values/
│           │   ├── colors.xml           # FCM notification color
│           │   └── strings.xml
│           ├── res/raw/                 # Drop custom .mp3 sounds here
│           └── java/com/orestexpress/driver/
│               └── MainActivity.java    # Notification channel registration
└── CUSTOM_SOUNDS.md             # how-to for custom tones
```

## Build commands

```bash
cd /opt/tms/tms-driver-android

# After editing native code (MainActivity.java, AndroidManifest.xml, etc.):
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
  ANDROID_SDK_ROOT=/opt/android-sdk \
  ANDROID_HOME=/opt/android-sdk \
  npx cap sync android

# Build debug APK:
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
  ANDROID_SDK_ROOT=/opt/android-sdk \
  ANDROID_HOME=/opt/android-sdk \
  cd android && ./gradlew assembleDebug --no-daemon

# Result: android/app/build/outputs/apk/debug/app-debug.apk
```

## What's NOT done (next sessions)

- **Firebase config** — needs your action (steps above).
- **Driver-app FCM token registration** — currently the WebView calls
  `subscribeToPush()` (Web Push). To register FCM tokens from inside the
  Capacitor app, the native app needs a JS bridge that calls the
  `@capacitor/push-notifications` plugin, gets the token, and POSTs to
  `/driver-portal/fcm/subscribe`. That's a ~30-line addition to the
  driver app's `DriverNotificationsCard` — wiring deferred until Firebase
  is configured.
- **Custom notification sound files** — drop `.mp3` files into `res/raw/`
  and uncomment the channel `setSound()` block.
- **App icon** — currently using Capacitor's default (green Android robot).
  Replace `android/app/src/main/res/mipmap-*` with branded icons, or use
  `npx @capacitor/assets generate` with a 1024x1024 source.
- **Release signing** — needed only for Google Play Store distribution.
- **Background location** — Capacitor `@capawesome/capacitor-background-geolocation`
  plugin would add this; reuses existing `/driver-portal/location` endpoint.
- **Native camera plugin** — `@capacitor/camera` for higher-res BOL/POD
  capture than the WebView camera input.
```
