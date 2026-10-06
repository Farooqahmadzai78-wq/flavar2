package com.islamnoor.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONObject

object AlarmStore {

    private const val PREFS = "prayer_alarms"
    private const val DAY_MS = 86_400_000L
    private const val TAG = "AlarmStore"

    fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun am(ctx: Context): AlarmManager =
        ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun buildIntent(ctx: Context, o: JSONObject): Intent {
        val i = Intent(ctx, PrayerAlarmReceiver::class.java)
        i.action = "com.islamnoor.app.ALARM." + o.optString("eventId")
        i.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES or Intent.FLAG_RECEIVER_FOREGROUND)
        i.putExtra("eventId", o.optString("eventId"))
        i.putExtra("type", o.optString("type"))
        i.putExtra("prayerName", o.optString("prayerName"))
        i.putExtra("mode", o.optString("mode"))
        i.putExtra("title", o.optString("title"))
        i.putExtra("notifText", o.optString("notifText"))
        i.putExtra("message", o.optString("notifText"))
        i.putExtra("audioUrl", o.optString("audioUrl"))
        i.putExtra("vibrate", o.optBoolean("vibrate", true))
        return i
    }

    private fun cancelOne(ctx: Context, eventId: String) {
        try {
            val pi = PendingIntent.getBroadcast(
                ctx,
                eventId.hashCode(),
                Intent(ctx, PrayerAlarmReceiver::class.java).apply {
                    action = "com.islamnoor.app.ALARM.$eventId"
                    putExtra("eventId", eventId)
                },
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
            if (pi != null) {
                am(ctx).cancel(pi)
                pi.cancel()
            }
        } catch (_: Exception) {
        }
    }

    fun schedule(ctx: Context, o: JSONObject): Boolean {
        val eventId = o.optString("eventId", "")
        if (eventId.isEmpty()) return false

        var ts = o.optLong("timestampMs", 0L)
        if (ts <= 0L) return false

        val repeat = o.optBoolean("repeat", true)
        val now = System.currentTimeMillis()
        if (ts <= now + 1_000L) {
            if (!repeat) {
                prefs(ctx).edit().remove(eventId).apply()
                return false
            }
            while (ts <= now + 1_000L) {
                ts += DAY_MS
            }
        }
        o.put("timestampMs", ts)

        val pi = PendingIntent.getBroadcast(
            ctx,
            eventId.hashCode(),
            buildIntent(ctx, o),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        try {
            val alarm = am(ctx)
            val canScheduleExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarm.canScheduleExactAlarms()
            } else {
                true
            }

            if (canScheduleExact) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ts, pi)
                } else {
                    alarm.setExact(AlarmManager.RTC_WAKEUP, ts, pi)
                }
            } else {
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ts, pi)
            }
        } catch (e: Exception) {
            Log.w(TAG, "schedule err: $e")
            return false
        }

        prefs(ctx).edit().putString(eventId, o.toString()).apply()
        Log.i(TAG, "armed $eventId @ $ts")
        return true
    }

    fun armSet(ctx: Context, items: List<JSONObject>): Int {
        cancelAll(ctx)
        var scheduled = 0
        for (item in items) {
            if (schedule(ctx, item)) {
                scheduled += 1
            }
        }
        Log.i(TAG, "armSet -> $scheduled alarms")
        return scheduled
    }

    fun rescheduleNextDay(ctx: Context, eventId: String) {
        val raw = prefs(ctx).getString(eventId, null) ?: return
        try {
            val o = JSONObject(raw)
            if (!o.optBoolean("repeat", true)) {
                prefs(ctx).edit().remove(eventId).apply()
                return
            }
            o.put("timestampMs", o.optLong("timestampMs") + DAY_MS)
            schedule(ctx, o)
        } catch (e: Exception) {
            Log.w(TAG, "reschedule err: $e")
        }
    }

    fun restoreAll(ctx: Context): Int {
        var restored = 0
        val entries = HashMap(prefs(ctx).all)
        entries.forEach { (_, value) ->
            if (value is String) {
                try {
                    if (schedule(ctx, JSONObject(value))) {
                        restored += 1
                    }
                } catch (_: Exception) {
                }
            }
        }
        Log.i(TAG, "restore $restored alarms")
        return restored
    }

    fun cancelAll(ctx: Context): Int {
        var count = 0
        val entries = HashMap(prefs(ctx).all)
        entries.forEach { (key, _) ->
            count += 1
            cancelOne(ctx, key)
        }
        prefs(ctx).edit().clear().apply()
        Log.i(TAG, "cancelAll -> $count alarms")
        return count
    }

    fun count(ctx: Context): Int = prefs(ctx).all.size
}
