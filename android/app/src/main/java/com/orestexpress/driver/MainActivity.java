package com.orestexpress.driver;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Orest Driver — Capacitor host activity.
 *
 * Registers two FCM notification channels at app start so dispatchers can
 * pick the right priority/tone per event type via the FCM payload:
 *
 *   "orest_driver_default" — IMPORTANCE_HIGH, vibrates, plays system default
 *                            sound. Used for messages + general alerts.
 *   "orest_driver_urgent"  — IMPORTANCE_HIGH, vibrates, plays a custom sound
 *                            (raw/load_assigned). Used for new-load assignment.
 *
 * To add a custom tone: drop a .mp3/.ogg into
 *   android/app/src/main/res/raw/<name>.mp3
 * then reference it via:
 *   Uri.parse("android.resource://" + getPackageName() + "/raw/<name>")
 *
 * Channels are created on first run only; once a driver has a channel, only
 * the OS notification settings can change its sound. That's intentional —
 * the user owns their notification UX after install.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerNotificationChannels();
    }

    private void registerNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return; // Channels only exist on Android 8.0+
        }

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        // 1. Default channel — used by FCM when payload omits an explicit channel.
        NotificationChannel def = new NotificationChannel(
            "orest_driver_default",
            "Loads & messages",
            NotificationManager.IMPORTANCE_HIGH
        );
        def.setDescription("Load assignments and dispatcher messages");
        def.enableVibration(true);
        def.setVibrationPattern(new long[]{0, 250, 200, 250});
        def.enableLights(true);
        def.setShowBadge(true);
        nm.createNotificationChannel(def);

        // 2. Urgent channel — for new load tenders. Same sound as default for
        // now; once a custom .mp3 is dropped in res/raw/load_assigned.mp3,
        // uncomment the setSound() block below to use it.
        NotificationChannel urgent = new NotificationChannel(
            "orest_driver_urgent",
            "Urgent: new load",
            NotificationManager.IMPORTANCE_HIGH
        );
        urgent.setDescription("New load assigned to you");
        urgent.enableVibration(true);
        urgent.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 400});
        urgent.enableLights(true);
        urgent.setShowBadge(true);
        urgent.setBypassDnd(false); // Drivers control DND themselves.

        // To enable a custom sound for the urgent channel, drop a file at
        // android/app/src/main/res/raw/load_assigned.mp3 and uncomment:
        //
        // AudioAttributes audio = new AudioAttributes.Builder()
        //     .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        //     .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        //     .build();
        // Uri uri = Uri.parse("android.resource://" + getPackageName() + "/raw/load_assigned");
        // urgent.setSound(uri, audio);

        nm.createNotificationChannel(urgent);
    }
}
