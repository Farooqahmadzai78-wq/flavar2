package com.islamnoor.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val a = intent.action ?: return
        if (a == Intent.ACTION_BOOT_COMPLETED ||
            a == "android.intent.action.QUICKBOOT_POWERON" ||
            a == Intent.ACTION_MY_PACKAGE_REPLACED ||
            a == Intent.ACTION_TIME_CHANGED ||
            a == Intent.ACTION_TIMEZONE_CHANGED) {
            NotificationHelper.ensureChannels(context)
            val n = AlarmStore.restoreAll(context)
            Log.i("BootReceiver", "restore apres " + a + " : " + n)
        }
    }
}
