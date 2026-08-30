package com.islamnoor.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

class PrayerAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val type = intent.getStringExtra("type") ?: "PRAYER_AZAN"
        val eventId = intent.getStringExtra("eventId") ?: "evt"
        val mode = intent.getStringExtra("mode") ?: "both"
        val audioUrl = intent.getStringExtra("audioUrl") ?: ""
        val vibrate = intent.getBooleanExtra("vibrate", true)

        val isAdhan = type == "PRAYER_AZAN" || type == "adhan"

        val title = intent.getStringExtra("title")?.takeIf { it.isNotBlank() }
            ?: if (isAdhan) "Islam-Noor - Adhan" else "Islam-Noor - Rappel"

        val text = intent.getStringExtra("notifText")?.takeIf { it.isNotBlank() }
            ?: intent.getStringExtra("message")?.takeIf { it.isNotBlank() }
            ?: if (isAdhan) "La priere commence" else "L'heure de la priere approche"

        Log.i("PrayerAlarm", "fire type=" + type + " mode=" + mode + " id=" + eventId)

        NotificationHelper.ensureChannels(context)

        val wantAudio = (isAdhan || mode == "audio" || mode == "both") && audioUrl.isNotEmpty()

        if (wantAudio) {
            val svc = Intent(context, PrayerAudioService::class.java)
            svc.putExtra("eventId", eventId)
            svc.putExtra("isAdhan", isAdhan)
            svc.putExtra("title", title)
            svc.putExtra("notifText", text)
            svc.putExtra("audioUrl", audioUrl)
            svc.putExtra("vibrate", vibrate)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(svc)
                } else {
                    context.startService(svc)
                }
                AlarmStore.rescheduleNextDay(context, eventId)
                return
            } catch (e: Exception) {
                Log.w("PrayerAlarm", "service refuse: " + e)
            }
        }

        val channel = if (isAdhan) NotificationHelper.CHANNEL_ADHAN
                      else NotificationHelper.CHANNEL_REMINDER
        NotificationHelper.show(context, eventId.hashCode(), channel, title, text)
        if (vibrate) buzz(context)

        AlarmStore.rescheduleNextDay(context, eventId)
    }

    private fun buzz(ctx: Context) {
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)
                    as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 200, 400), -1))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(longArrayOf(0, 400, 200, 400), -1)
            }
        } catch (_: Exception) {}
    }
}
