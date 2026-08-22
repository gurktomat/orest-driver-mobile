package com.orestexpress.driver;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * Orest Driver - Capacitor host activity.
 *
 * Registers FCM notification channels at app start so the backend can pick
 * the right tone per event type via the channel_id field on each payload.
 * Channel sounds are immutable after first install on the device - the
 * channel name is what makes them distinct here.
 *
 *   orest_driver_message - message.mp3 (gentle 2-tone chime)
 *                          Used for new dispatcher messages.
 *   orest_driver_load    - load.mp3 (ascending C-E-G chord)
 *                          Used for new load assignments.
 *   orest_driver_urgent  - urgent.mp3 (3 rapid beeps)
 *                          Used for pickup reminders / time-sensitive alerts.
 *   orest_driver_default - system default sound (legacy fallback).
 *
 * Plus one channel per user-selectable tone (orest_driver_<tone>) - see
 * the picker in DriverNotificationsCard; aurora.wav ships as WAV (raw/
 * accepts both formats).
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerNotificationChannels();
        startLoadWatchdog();
    }

    private void registerNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return; // Channels only exist on Android 8.0+
        }

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        AudioAttributes audio = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build();
        String pkg = getPackageName();

        nm.createNotificationChannel(buildChannel(
            "orest_driver_message", "New messages",
            "Dispatcher messages",
            new long[]{0, 200, 100, 200},
            Uri.parse("android.resource://" + pkg + "/raw/message"),
            audio
        ));

        nm.createNotificationChannel(buildChannel(
            "orest_driver_load", "Load assignments",
            "New loads tendered to you",
            new long[]{0, 300, 150, 300},
            Uri.parse("android.resource://" + pkg + "/raw/load"),
            audio
        ));

        nm.createNotificationChannel(buildChannel(
            "orest_driver_urgent", "Urgent alerts",
            "Pickup reminders and time-sensitive dispatch",
            new long[]{0, 400, 200, 400, 200, 400},
            Uri.parse("android.resource://" + pkg + "/raw/urgent"),
            audio
        ));

        // Per-driver tone choice channels - selected via the in-app
        // "Notification sound" picker. Same vibration pattern across
        // all of them; only the sound differs.
        long[] vibe = new long[]{0, 250, 150, 250};
        nm.createNotificationChannel(buildChannel(
            "orest_driver_aurora", "Aurora tone",
            "Warm two-note bell tone",
            vibe, Uri.parse("android.resource://" + pkg + "/raw/aurora"), audio
        ));
        nm.createNotificationChannel(buildChannel(
            "orest_driver_bell", "Bell tone",
            "Bell-like notification tone",
            vibe, Uri.parse("android.resource://" + pkg + "/raw/bell"), audio
        ));
        nm.createNotificationChannel(buildChannel(
            "orest_driver_glass", "Glass tone",
            "Bright glassy ping tone",
            vibe, Uri.parse("android.resource://" + pkg + "/raw/glass"), audio
        ));
        nm.createNotificationChannel(buildChannel(
            "orest_driver_pulse", "Pulse tone",
            "Two-pulse alert tone",
            vibe, Uri.parse("android.resource://" + pkg + "/raw/pulse"), audio
        ));
        nm.createNotificationChannel(buildChannel(
            "orest_driver_classic", "Classic tone",
            "Classic two-tone phone ring",
            vibe, Uri.parse("android.resource://" + pkg + "/raw/classic"), audio
        ));

        // Legacy fallback - used when older payloads omit a channel_id.
        NotificationChannel def = new NotificationChannel(
            "orest_driver_default", "General",
            NotificationManager.IMPORTANCE_HIGH
        );
        def.setDescription("Default notification channel");
        def.enableVibration(true);
        def.setShowBadge(true);
        nm.createNotificationChannel(def);
    }

    private NotificationChannel buildChannel(
        String id, String name, String description,
        long[] vibration, Uri sound, AudioAttributes audio
    ) {
        NotificationChannel ch = new NotificationChannel(
            id, name, NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription(description);
        ch.enableVibration(true);
        ch.setVibrationPattern(vibration);
        ch.enableLights(true);
        ch.setShowBadge(true);
        ch.setSound(sound, audio);
        return ch;
    }

    // ---- Stalled-load watchdog ----
    //
    // `server.errorPath` (offline.html) covers a load that FAILS: Capacitor's
    // BridgeWebViewClient hands over to the local page from onReceivedError. It
    // does nothing for a load that merely HANGS - a captive portal, or one bar of
    // LTE that completes the handshake and then goes quiet. The WebView reports
    // nothing for as long as that lasts, and paints only `backgroundColor` while
    // it waits. That is the same black screen, just on a slower fuse.
    //
    // So measure the load here. This is a STALL detector, not a deadline: any
    // forward movement in getProgress() restarts the clock, so a slow but living
    // connection is left alone for as long as it needs. Only a load that has not
    // advanced AT ALL for STALLED_LOAD_MS is given up on.
    //
    // It guards the FIRST load and disarms permanently once one paints. After
    // that the user has real content on screen, and replacing it with an error
    // page would be strictly worse than letting them wait. Every later attempt
    // belongs to offline.html, which times out its own hop back.

    private static final long STALLED_LOAD_MS = 15_000L;
    private static final long WATCHDOG_TICK_MS = 1_000L;

    private final Handler watchdogHandler = new Handler(Looper.getMainLooper());
    private final Runnable watchdogTick = new Runnable() {
        @Override
        public void run() {
            checkForStalledLoad();
        }
    };
    private int watchdogLastProgress = -1;
    private long watchdogClockStartedAt = 0L;
    private boolean watchdogFinished = false;

    private void startLoadWatchdog() {
        if (bridge == null) {
            return; // setContentView fell back to no_webview; there is nothing to watch
        }
        // Any of these means something is on screen - including the error page
        // Capacitor itself just loaded - so the watchdog has nothing left to do.
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                stopLoadWatchdog();
            }

            @Override
            public void onPageLoaded(WebView view) {
                stopLoadWatchdog();
            }

            @Override
            public void onReceivedError(WebView view) {
                stopLoadWatchdog();
            }

            @Override
            public void onReceivedHttpError(WebView view) {
                stopLoadWatchdog();
            }
        });
        watchdogHandler.postDelayed(watchdogTick, WATCHDOG_TICK_MS);
    }

    private void stopLoadWatchdog() {
        watchdogFinished = true;
        watchdogHandler.removeCallbacks(watchdogTick);
    }

    private void checkForStalledLoad() {
        if (watchdogFinished) {
            return;
        }
        WebView webView = (bridge != null) ? bridge.getWebView() : null;
        String errorUrl = (bridge != null) ? bridge.getErrorUrl() : null;
        if (webView == null || errorUrl == null) {
            stopLoadWatchdog(); // no WebView, or no errorPath configured to go to
            return;
        }

        long now = SystemClock.elapsedRealtime();
        if (watchdogClockStartedAt == 0L) {
            watchdogClockStartedAt = now;
        }

        // ANY change in progress is evidence of life, in either direction. Counting
        // only upward movement made this a high-water mark that a SECOND navigation
        // could never beat (a new navigation restarts progress near 0), freezing the
        // stall clock at the previous navigation's last tick. The commit/loaded
        // listeners above already disarm us before that can bite here, but the iOS
        // shell had no such disarm and this exact hole produced a black screen on
        // every push-tap deep link. Keep the two shells honest.
        int progress = webView.getProgress();
        if (progress != watchdogLastProgress) {
            watchdogLastProgress = progress;
            watchdogClockStartedAt = now;
        }
        if (progress >= 100) {
            stopLoadWatchdog();
            return;
        }

        if (now - watchdogClockStartedAt < STALLED_LOAD_MS) {
            watchdogHandler.postDelayed(watchdogTick, WATCHDOG_TICK_MS);
            return;
        }

        stopLoadWatchdog();
        webView.stopLoading();
        webView.loadUrl(errorUrl);
    }

    // public, not protected: BridgeActivity already widens it, and narrowing an
    // override is a compile error.
    @Override
    public void onDestroy() {
        stopLoadWatchdog();
        super.onDestroy();
    }
}
