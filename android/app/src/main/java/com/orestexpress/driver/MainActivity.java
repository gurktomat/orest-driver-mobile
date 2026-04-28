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
 * Registers FCM notification channels at app start so the backend can pick
 * the right tone per event type via the channel_id field on each payload.
 * Channel sounds are immutable after first install on the device — the
 * channel name is what makes them distinct here.
 *
 *   orest_driver_message — message.mp3 (gentle 2-tone chime)
 *                          Used for new dispatcher messages.
 *   orest_driver_load    — load.mp3 (ascending C-E-G chord)
 *                          Used for new load assignments.
 *   orest_driver_urgent  — urgent.mp3 (3 rapid beeps)
 *                          Used for pickup reminders / time-sensitive alerts.
 *   orest_driver_default — system default sound (legacy fallback).
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

        // Legacy fallback — used when older payloads omit a channel_id.
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
}
