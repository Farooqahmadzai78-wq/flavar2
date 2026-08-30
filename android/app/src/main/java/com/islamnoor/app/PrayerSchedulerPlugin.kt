package com.islamnoor.app

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
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

    private val names = listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
    private val TAG = "PrayerSched"

    private fun meta() = Store.meta(context)

    // ---------------- statut ----------------

    @PluginMethod
    fun getNativePlatformStatus(call: PluginCall) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            am.canScheduleExactAlarms() else true
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        call.resolve(JSObject().apply {
            put("isNativeAndroid", true)
            put("alarmManagerAvailable", true)
            put("sdkVersion", Build.VERSION.SDK_INT)
            put("canScheduleExactAlarms", canExact)
            put("isIgnoringBatteryOptimizations",
                pm.isIgnoringBatteryOptimizations(context.packageName))
        })
    }

    @PluginMethod
    fun requestNativePermissions(call: PluginCall) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var ok = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!am.canScheduleExactAlarms()) {
                try { activity.startActivity(
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)) } catch (_: Exception) {}
            }
            ok = am.canScheduleExactAlarms()
        }
        call.resolve(JSObject().put("canScheduleExactAlarms", ok))
    }

    @PluginMethod
    fun requestBatteryOptimizationExemption(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                i.data = Uri.parse("package:" + context.packageName)
                activity.startActivity(i)
            } catch (_: Exception) {}
        }
        call.resolve(JSObject().put("requested", true))
    }

    // ---------------- CAPTURE de ce que le site envoie ----------------

    @PluginMethod
    fun scheduleAdhan(call: PluginCall) {
        val imamId = call.getString("imamId") ?: ""
        val url = call.getString("audioUrl") ?: ""
        val prayer = call.getString("prayerName") ?: ""
        val msg = call.getString("message") ?: ""

        val e = meta().edit()
        if (url.startsWith("http")) {
            if (imamId.isNotEmpty()) e.putString("imam_" + imamId, url)
            e.putString("lastAdhanUrl", url)
        }
        if (imamId.isNotEmpty()) e.putString("lastImamId", imamId)
        if (msg.isNotEmpty()) e.putString("adhanTpl", Store.tpl(msg, prayer))
        e.putBoolean("vibA", call.getBoolean("vibrate", true) ?: true)
        e.apply()

        Log.i(TAG, "CAPTURE adhan imam=" + imamId + " url=" + url.takeLast(30))
        call.resolve(JSObject().put("success", true)
            .put("eventId", call.getString("eventId") ?: ""))
    }

    @PluginMethod
    fun scheduleReminder(call: PluginCall) {
        val prayer = call.getString("prayerName") ?: ""
        val notif = call.getString("notifText") ?: ""
        val aTxt = call.getString("audioText") ?: ""
        val aUrl = call.getString("audioUrl") ?: ""

        val e = meta().edit()
        if (notif.isNotEmpty()) e.putString("remTpl", Store.tpl(notif, prayer))
        if (aTxt.isNotEmpty()) e.putString("remAudioText", aTxt)
        if (aUrl.startsWith("http")) {
            e.putString("remAudioUrl", aUrl)
            if (aUrl.contains("text="))
                e.putString("ttsBase", aUrl.substringBefore("text=") + "text=")
        }
        e.putString("remMode", call.getString("mode") ?: "notification")
        e.putBoolean("vibN", call.getBoolean("vibrate", true) ?: true)
        e.putString("capSig", meta().getString("curSig", "") ?: "")
        e.apply()

        Log.i(TAG, "CAPTURE rappel texte=\"" + notif + "\"")
        call.resolve(JSObject().put("success", true)
            .put("eventId", call.getString("eventId") ?: ""))
    }

    @PluginMethod
    fun cancelAll(call: PluginCall) {
        call.resolve(JSObject().put("cancelled", true))
    }

    // ---------------- diagnostic ----------------

    @PluginMethod
    fun dumpSettings(call: PluginCall) {
        Log.i("NurSettings", call.getString("settings") ?: "{}")
        call.resolve(JSObject().put("ok", true))
    }

    // ---------------- coeur ----------------

    @PluginMethod
    fun syncAll(call: PluginCall) {
        val timesJson = call.getString("times") ?: return call.reject("times required")
        val notifications = call.getBoolean("notifications", true) ?: true
        val reminder = call.getInt("reminder") ?: 0
        val mode = call.getString("mode") ?: "notification"
        val imamId = call.getString("imamId") ?: ""
        val origin = call.getString("origin") ?: ""
        val st = try { JSONObject(call.getString("settings") ?: "{}") }
                 catch (_: Exception) { JSONObject() }

        val remSig = listOf(mode, reminder.toString(),
            st.optString("notifTemplate"), st.optString("customNotifText"),
            st.optString("audioReminder"), st.optString("customAudioText")
        ).joinToString("~")

        val sig = timesJson + "|" + notifications + "|" + imamId + "|" + remSig
        meta().edit().putString("curSig", remSig).apply()

        if (meta().getString("armedSig", "") == sig && AlarmStore.count(context) > 0) {
            call.resolve(JSObject().put("changed", false)); return
        }

        if (!notifications) {
            AlarmStore.cancelAll(context)
            meta().edit().putString("armedSig", sig).apply()
            Log.i(TAG, "notifications OFF -> tout annule")
            call.resolve(JSObject().put("changed", true).put("armed", 0)); return
        }

        val adhanUrl = Store.adhanUrl(context, imamId)
        val remText0 = Store.remText(context, remSig, st)
        val remAudio = if (mode == "notification") ""
                       else Store.remAudio(context, remSig, st, origin)
        val vibA = meta().getBoolean("vibA", true)
        val vibN = meta().getBoolean("vibN", true)

        val t = JSONObject(timesJson)
        val now = System.currentTimeMillis()
        val list = ArrayList<JSONObject>()

        for (n in names) {
            val p = t.optString(n).split(":")
            if (p.size != 2) continue
            val h = p[0].toIntOrNull() ?: continue
            val mi = p[1].toIntOrNull() ?: continue

            val c = Calendar.getInstance()
            c.set(Calendar.HOUR_OF_DAY, h); c.set(Calendar.MINUTE, mi)
            c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0)
            var ts = c.timeInMillis
            if (ts <= now + 30000L) ts += 86400000L

            val a = JSONObject()
            a.put("eventId", "adhan_" + n)
            a.put("timestampMs", ts)
            a.put("type", "PRAYER_AZAN")
            a.put("prayerName", n)
            a.put("mode", "both")
            a.put("title", "Islam-Noor \u2014 Adhan " + n)
            a.put("notifText", Store.adhanText(context, n))
            a.put("audioUrl", adhanUrl)
            a.put("vibrate", vibA)
            a.put("repeat", true)
            list.add(a)

            if (reminder > 0) {
                val rts = ts - reminder * 60000L
                if (rts > now + 30000L) {
                    val r = JSONObject()
                    r.put("eventId", "rem_" + n)
                    r.put("timestampMs", rts)
                    r.put("type", "REMINDER_BEFORE_PRAYER")
                    r.put("prayerName", n)
                    r.put("mode", mode)
                    r.put("title", "Islam-Noor \u2014 Rappel de pri\u00e8re")
                    r.put("notifText", remText0.replace("{P}", n)
                        .replace("{M}", reminder.toString()))
                    r.put("audioUrl", remAudio)
                    r.put("vibrate", vibN)
                    r.put("repeat", true)
                    list.add(r)
                }
            }
        }

        val armed = AlarmStore.armSet(context, list)
        meta().edit().putString("armedSig", sig).apply()
        Log.i(TAG, "syncAll -> " + armed + " alarmes | imam=" + imamId +
            " mode=" + mode + " rappel=" + reminder)
        Log.i(TAG, "  texte rappel : " + remText0)
        Log.i(TAG, "  audio adhan  : " + adhanUrl.takeLast(40))
        call.resolve(JSObject().put("changed", true).put("armed", armed))
    }

    // ---------------- tests ----------------

    @PluginMethod
    fun scheduleTestAlarm(call: PluginCall) {
        val delay = call.getInt("delaySeconds") ?: 10
        val type = call.getString("type") ?: "adhan"
        val kind = if (type == "adhan" || type == "PRAYER_AZAN") "adhan" else "rappel"
        val ok = AlarmStore.schedule(context, TestBuilder.build(context, kind, delay))
        call.resolve(JSObject().put("success", ok).put("delaySeconds", delay))
    }

    @PluginMethod
    fun testNow(call: PluginCall) {
        val o = TestBuilder.build(context, "rappel", 0)
        val i = Intent(context, PrayerAlarmReceiver::class.java)
        i.putExtra("type", o.optString("type"))
        i.putExtra("eventId", "test_now")
        i.putExtra("mode", o.optString("mode"))
        i.putExtra("title", o.optString("title"))
        i.putExtra("notifText", o.optString("notifText"))
        i.putExtra("audioUrl", o.optString("audioUrl"))
        i.putExtra("vibrate", true)
        context.sendBroadcast(i)
        call.resolve(JSObject().put("sent", true))
    }

    @PluginMethod
    fun getPendingAlarms(call: PluginCall) {
        val arr = JSONArray()
        AlarmStore.prefs(context).all.forEach { (_, v) ->
            if (v is String) { try { arr.put(JSONObject(v)) } catch (_: Exception) {} }
        }
        call.resolve(JSObject().put("alarmsJson", arr.toString()))
    }
}

// =================== resolution centralisee ===================

object Store {

    fun meta(ctx: Context) = ctx.getSharedPreferences("prayer_meta", Context.MODE_PRIVATE)

    fun tpl(text: String, prayer: String): String =
        if (prayer.isNotEmpty() && text.contains(prayer)) text.replace(prayer, "{P}") else text

    fun adhanUrl(ctx: Context, imamId: String): String {
        val m = meta(ctx)
        val exact = m.getString("imam_" + imamId, "") ?: ""
        if (exact.startsWith("http")) return exact
        val last = m.getString("lastAdhanUrl", "") ?: ""
        if (last.startsWith("http")) return last
        return "https://cdn.jsdelivr.net/gh/Kiwifu/adhan-mp3@main/Ali_Ibn_Ahmad_Mala_HQ.mp3"
    }

    fun adhanText(ctx: Context, prayer: String): String {
        val t = meta(ctx).getString("adhanTpl", "") ?: ""
        return if (t.isNotEmpty()) t.replace("{P}", prayer)
               else "La pri\u00e8re de " + prayer + " commence."
    }

    private fun isCustom(v: String): Boolean {
        val s = v.lowercase()
        return s.contains("custom") || s.contains("perso") || s.contains("own")
    }

    fun remText(ctx: Context, remSig: String, st: JSONObject): String {
        val m = meta(ctx)
        val custom = st.optString("customNotifText", "").trim()
        val fresh = m.getString("capSig", "") == remSig
        val cap = m.getString("remTpl", "") ?: ""

        if (custom.isNotEmpty() && isCustom(st.optString("notifTemplate"))) return custom
        if (fresh && cap.isNotEmpty()) return cap
        if (cap.isNotEmpty()) return cap
        if (custom.isNotEmpty()) return custom
        return "L'adhan de {P} commence dans {M} minutes."
    }

    fun remAudio(ctx: Context, remSig: String, st: JSONObject, origin: String): String {
        val m = meta(ctx)
        val custom = st.optString("customAudioText", "").trim()
        val fresh = m.getString("capSig", "") == remSig
        val capUrl = m.getString("remAudioUrl", "") ?: ""

        if (custom.isNotEmpty() && isCustom(st.optString("audioReminder"))) {
            var base = m.getString("ttsBase", "") ?: ""
            if (base.isEmpty()) {
                val o = if (origin.startsWith("http")) origin
                        else "https://fortuite-424120936603.europe-west2.run.app"
                base = o + "/api/tts?voice=alloy&text="
            }
            return base + URLEncoder.encode(custom, "UTF-8").replace("+", "%20")
        }
        if (capUrl.startsWith("http")) return capUrl
        val o = if (origin.startsWith("http")) origin
                else "https://fortuite-424120936603.europe-west2.run.app"
        return o + "/api/tts?voice=alloy&text=" +
            URLEncoder.encode("Il est temps de se pr\u00e9parer pour la pri\u00e8re.", "UTF-8")
                .replace("+", "%20")
    }
}

object TestBuilder {
    fun build(ctx: Context, kind: String, delay: Int): JSONObject {
        val adhan = kind == "adhan"
        val m = Store.meta(ctx)
        val mode = if (adhan) "both" else (m.getString("remMode", "notification") ?: "notification")
        val o = JSONObject()
        o.put("eventId", "realtest_" + kind)
        o.put("timestampMs", System.currentTimeMillis() + delay * 1000L)
        o.put("type", if (adhan) "PRAYER_AZAN" else "REMINDER_BEFORE_PRAYER")
        o.put("prayerName", "Fajr")
        o.put("mode", mode)
        o.put("title", if (adhan) "Islam-Noor \u2014 Adhan Fajr"
                       else "Islam-Noor \u2014 Rappel de pri\u00e8re")
        o.put("notifText", if (adhan) Store.adhanText(ctx, "Fajr")
            else (m.getString("remTpl", "") ?: "").ifEmpty {
                "L'adhan de {P} commence dans {M} minutes." }
                .replace("{P}", "Fajr").replace("{M}", "30"))
        o.put("audioUrl", when {
            adhan -> Store.adhanUrl(ctx, m.getString("lastImamId", "") ?: "")
            mode == "notification" -> ""
            else -> m.getString("remAudioUrl", "") ?: ""
        })
        o.put("vibrate", true)
        o.put("repeat", false)
        return o
    }
}
