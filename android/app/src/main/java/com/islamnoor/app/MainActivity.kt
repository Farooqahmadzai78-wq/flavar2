package com.islamnoor.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    private val handler = Handler(Looper.getMainLooper())

    private val tick = object : Runnable {
        override fun run() {
            try { bridge?.webView?.evaluateJavascript(NurTts.SCRIPT, null) } catch (_: Exception) {}
            try { bridge?.webView?.evaluateJavascript(WebGuard.SCRIPT, null) } catch (_: Exception) {}
            handler.postDelayed(this, 3000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(PrayerSchedulerPlugin::class.java)
        registerPlugin(NurSpeakPlugin::class.java)
        super.onCreate(savedInstanceState)
        NotificationHelper.ensureChannels(this)
        Speaker.init(this)
        maybeTest(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        maybeTest(intent)
    }

    private fun maybeTest(i: Intent?) {
        if (i == null || !i.getBooleanExtra("nurtest", false)) return
        i.removeExtra("nurtest")
        val d = i.getIntExtra("nurdelay", 30)
        val kind = i.getStringExtra("nurkind") ?: "rappel"
        handler.postDelayed({
            AlarmStore.schedule(this, TestBuilder.build(this, kind, d))
            android.util.Log.i("NurTest", "alarme reelle " + kind + " dans " + d + "s")
        }, 1500L)
    }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(tick)
        handler.post(tick)
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(tick)
    }
}
