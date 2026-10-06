package com.islamnoor.app

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.Calendar

@CapacitorPlugin(name = "PrayerScheduler")
class PrayerSchedulerPlugin : Plugin() {

    private val tag = "PrayerSched"
    private val names = listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")

    private fun meta() = Store.meta(context)

    @PluginMethod
    fun getNativePlatformStatus(call: PluginCall) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val exactAllowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.canScheduleExactAlarms()
        } else {
            true
        }
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val postNotificationsAllowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        call.resolve(
            JSObject().apply {
                put("isNativeAndroid", true)
                put("alarmManagerAvailable", true)
                put("sdkVersion", Build.VERSION.SDK_INT)
                put("canScheduleExactAlarms", exactAllowed)
                put("canPostNotifications", postNotificationsAllowed)
                put("isIgnoringBatteryOptimizations", pm.isIgnoringBatteryOptimizations(context.packageName))
            },
        )
    }

    @PluginMethod
    fun requestNativePermissions(call: PluginCall) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var exactAllowed = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            try {
                activity?.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM))
            } catch (_: Exception) {
            }
        }
        exactAllowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.canScheduleExactAlarms() else true

        var postAllowed = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            postAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            if (!postAllowed) {
                try {
                    activity?.startActivity(
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        },
                    )
                } catch (_: Exception) {
                }
            }
        }

        call.resolve(
            JSObject().apply {
                put("canScheduleExactAlarms", exactAllowed)
                put("canPostNotifications", postAllowed)
            },
        )
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val result = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            if (result != PackageManager.PERMISSION_GRANTED) {
                try {
                    activity?.startActivity(
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        },
                    )
                } catch (_: Exception) {
                }
                false
            } else {
                true
            }
        } else {
            true
        }
        call.resolve(JSObject().put("granted", granted))
    }

    @PluginMethod
    fun requestBatteryOptimizationExemption(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                i.data = Uri.parse("package:" + context.packageName)
                activity?.startActivity(i)
            } catch (_: Exception) {
            }
        }
        call.resolve(JSObject().put("requested", true))
    }

    @PluginMethod
    fun scheduleAdhan(call: PluginCall) {
        val eventId = call.getString("eventId") ?: "deprecated-adhan"
        Log.w(tag, "Deprecated scheduleAdhan invoked; use syncSchedule() instead.")
        call.resolve(
            JSObject().apply {
                put("success", false)
                put("deprecated", true)
                put("eventId", eventId)
            },
        )
    }

    @PluginMethod
    fun scheduleReminder(call: PluginCall) {
        val eventId = call.getString("eventId") ?: "deprecated-reminder"
        Log.w(tag, "Deprecated scheduleReminder invoked; use syncSchedule() instead.")
        call.resolve(
            JSObject().apply {
                put("success", false)
                put("deprecated", true)
                put("eventId", eventId)
            },
        )
    }

    @PluginMethod
    fun cancelAll(call: PluginCall) {
        val count = AlarmStore.cancelAll(context)
        call.resolve(JSObject().put("cancelled", true).put("count", count))
    }

    @PluginMethod
    fun syncSchedule(call: PluginCall) {
        val timesJson = call.getString("times") ?: return call.reject("times required")
        val notifications = call.getBoolean("notifications", true) ?: true
        val reminderMinutes = call.getInt("reminder") ?: 0
        val mode = call.getString("reminderMode") ?: call.getString("mode") ?: "notification"
        val imamId = call.getString("imamId") ?: "makkah"
        val origin = call.getString("origin") ?: ""
        val settingsJson = call.getString("settings") ?: "{}"

        val settings = try {
            JSONObject(settingsJson)
        } catch (_: Exception) {
            JSONObject()
        }

        val remSignature = listOf(
            mode,
            reminderMinutes.toString(),
            settings.optString("notifTemplate"),
            settings.optString("customNotifText"),
            settings.optString("audioReminder"),
            settings.optString("customAudioText"),
        ).joinToString("~")

        val signature = timesJson + "|" + notifications + "|" + imamId + "|" + remSignature
        meta().edit().putString("curSig", remSignature).apply()

        if (!notifications) {
            val cancelled = AlarmStore.cancelAll(context)
            meta().edit().putString("armedSig", signature).apply()
            Log.i(tag, "notifications OFF -> cancelled $cancelled alarms")
            call.resolve(JSObject().put("success", true).put("scheduledCount", 0).put("cancelled", true).put("isNativeAndroid", true))
            return
        }

        val now = System.currentTimeMillis()
        val times = try {
            JSONObject(timesJson)
        } catch (_: Exception) {
            JSONObject()
        }

        val adhanUrl = Store.adhanUrl(context, imamId)
        val reminderText = Store.remText(context, remSignature, settings)
        val reminderAudio = if (mode == "notification") "" else Store.remAudio(context, remSignature, settings, origin)
        val vibAdhan = settings.optBoolean("vibrateAdhan", true)
        val vibReminder = settings.optBoolean("vibrateNotifications", true)

        val agenda = ArrayList<JSONObject>()

        for (prayerName in names) {
            val prayerValue = times.optString(prayerName, "")
            val parts = prayerValue.split(":")
            if (parts.size != 2) continue

            val hour = parts[0].toIntOrNull() ?: continue
            val minute = parts[1].toIntOrNull() ?: continue

            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, hour)
            calendar.set(Calendar.MINUTE, minute)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)

            var adhanTs = calendar.timeInMillis
            if (adhanTs <= now + 30_000L) {
                adhanTs += 86_400_000L
            }

            val adhanPayload = JSONObject().apply {
                put("eventId", "adhan_${prayerName}")
                put("timestampMs", adhanTs)
                put("type", "PRAYER_AZAN")
                put("prayerName", prayerName)
                put("mode", "both")
                put("title", "Islam-Noor — Adhan $prayerName")
                put("notifText", Store.adhanText(context, prayerName))
                put("audioUrl", adhanUrl)
                put("vibrate", vibAdhan)
                put("repeat", true)
            }
            agenda.add(adhanPayload)

            if (reminderMinutes > 0) {
                val reminderTs = adhanTs - reminderMinutes * 60_000L
                if (reminderTs > now + 30_000L) {
                    val reminderPayload = JSONObject().apply {
                        put("eventId", "rem_${prayerName}")
                        put("timestampMs", reminderTs)
                        put("type", "REMINDER_BEFORE_PRAYER")
                        put("prayerName", prayerName)
                        put("mode", mode)
                        put("title", "Islam-Noor — Rappel de prière")
                        put("notifText", reminderText.replace("{P}", prayerName).replace("{M}", reminderMinutes.toString()))
                        put("audioUrl", reminderAudio)
                        put("vibrate", vibReminder)
                        put("repeat", true)
                    }
                    agenda.add(reminderPayload)
                }
            }
        }

        val scheduledCount = AlarmStore.armSet(context, agenda)
        meta().edit().putString("armedSig", signature).apply()
        Log.i(tag, "syncSchedule -> $scheduledCount alarms for $imamId mode=$mode reminder=$reminderMinutes")
        call.resolve(JSObject().put("success", true).put("scheduledCount", scheduledCount).put("cancelled", false).put("isNativeAndroid", true))
    }

    @PluginMethod
    fun syncAll(call: PluginCall) {
        syncSchedule(call)
    }

    @PluginMethod
    fun scheduleTestAlarm(call: PluginCall) {
        val delaySeconds = call.getInt("delaySeconds") ?: 10
        val type = call.getString("type") ?: "adhan"
        val ok = AlarmStore.schedule(context, TestBuilder.build(context, if (type == "adhan" || type == "PRAYER_AZAN") "adhan" else "reminder", delaySeconds))
        call.resolve(JSObject().put("success", ok).put("delaySeconds", delaySeconds))
    }

    @PluginMethod
    fun testNow(call: PluginCall) {
        val kind = "reminder"
        val alarm = TestBuilder.build(context, kind, 0)
        val i = Intent(context, PrayerAlarmReceiver::class.java)
        i.putExtra("type", alarm.optString("type"))
        i.putExtra("eventId", "test_now")
        i.putExtra("mode", alarm.optString("mode"))
        i.putExtra("title", alarm.optString("title"))
        i.putExtra("notifText", alarm.optString("notifText"))
        i.putExtra("audioUrl", alarm.optString("audioUrl"))
        i.putExtra("vibrate", true)
        context.sendBroadcast(i)
        call.resolve(JSObject().put("sent", true))
    }

    @PluginMethod
    fun getPendingAlarms(call: PluginCall) {
        val arr = JSONArray()
        AlarmStore.prefs(context).all.forEach { (_, value) ->
            if (value is String) {
                try {
                    arr.put(JSONObject(value))
                } catch (_: Exception) {
                }
            }
        }
        call.resolve(JSObject().put("alarmsJson", arr.toString()))
    }
}

object Store {
    fun meta(ctx: Context) = ctx.getSharedPreferences("prayer_meta", Context.MODE_PRIVATE)

    fun tpl(text: String, prayer: String): String =
        if (prayer.isNotEmpty() && text.contains(prayer)) text.replace(prayer, "{P}") else text

    fun adhanUrl(ctx: Context, imamId: String): String {
        val meta = meta(ctx)
        val exact = meta.getString("imam_" + imamId, "") ?: ""
        if (exact.startsWith("http")) return exact
        val last = meta.getString("lastAdhanUrl", "") ?: ""
        if (last.startsWith("http")) return last
        return "https://cdn.jsdelivr.net/gh/Kiwifu/adhan-mp3@main/Ali_Ibn_Ahmad_Mala_HQ.mp3"
    }

    fun adhanText(ctx: Context, prayer: String): String {
        val text = meta(ctx).getString("adhanTpl", "") ?: ""
        return if (text.isNotEmpty()) text.replace("{P}", prayer) else "La prière de $prayer commence."
    }

    private fun isCustom(value: String): Boolean {
        val lowered = value.lowercase()
        return lowered.contains("custom") || lowered.contains("perso") || lowered.contains("own")
    }

    fun remText(ctx: Context, remSig: String, settings: JSONObject): String {
        val custom = settings.optString("customNotifText", "").trim()
        val meta = meta(ctx)
        val cap = meta.getString("remTpl", "") ?: ""
        val fresh = meta.getString("capSig", "") == remSig

        if (custom.isNotEmpty() && isCustom(settings.optString("notifTemplate"))) return custom
        if (fresh && cap.isNotEmpty()) return cap
        if (cap.isNotEmpty()) return cap
        if (custom.isNotEmpty()) return custom
        return "L'adhan de {P} commence dans {M} minutes."
    }

    fun remAudio(ctx: Context, remSig: String, settings: JSONObject, origin: String): String {
        val meta = meta(ctx)
        val custom = settings.optString("customAudioText", "").trim()
        val capUrl = meta.getString("remAudioUrl", "") ?: ""
        val fresh = meta.getString("capSig", "") == remSig

        if (custom.isNotEmpty() && isCustom(settings.optString("audioReminder"))) {
            var base = meta.getString("ttsBase", "") ?: ""
            if (base.isEmpty()) {
                val fallback = if (origin.startsWith("http")) origin else "https://fortuite-424120936603.europe-west2.run.app"
                base = fallback + "/api/tts?voice=alloy&text="
            }
            return base + URLEncoder.encode(custom, "UTF-8").replace("+", "%20")
        }
        if (fresh && capUrl.startsWith("http")) return capUrl
        if (capUrl.startsWith("http")) return capUrl
        val base = if (origin.startsWith("http")) origin else "https://fortuite-424120936603.europe-west2.run.app"
        return base + "/api/tts?voice=alloy&text=" + URLEncoder.encode("Il est temps de se préparer pour la prière.", "UTF-8").replace("+", "%20")
    }
}

object TestBuilder {
    fun build(ctx: Context, kind: String, delaySeconds: Int): JSONObject {
        val isAdhan = kind == "adhan"
        val meta = Store.meta(ctx)
        val mode = if (isAdhan) "both" else (meta.getString("remMode", "notification") ?: "notification")
        val obj = JSONObject()
        obj.put("eventId", "realtest_${kind}")
        obj.put("timestampMs", System.currentTimeMillis() + delaySeconds * 1000L)
        obj.put("type", if (isAdhan) "PRAYER_AZAN" else "REMINDER_BEFORE_PRAYER")
        obj.put("prayerName", "Fajr")
        obj.put("mode", mode)
        obj.put("title", if (isAdhan) "Islam-Noor — Adhan Fajr" else "Islam-Noor — Rappel de prière")
        obj.put("notifText", if (isAdhan) Store.adhanText(ctx, "Fajr") else (meta.getString("remTpl", "") ?: "").ifEmpty { "L'adhan de {P} commence dans {M} minutes." }.replace("{P}", "Fajr").replace("{M}", "30"))
        obj.put("audioUrl", when {
            isAdhan -> Store.adhanUrl(ctx, meta.getString("lastImamId", "") ?: "")
            mode == "notification" -> ""
            else -> meta.getString("remAudioUrl", "") ?: ""
        })
        obj.put("vibrate", true)
        obj.put("repeat", false)
        return obj
    }
}
