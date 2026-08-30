package com.islamnoor.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.database.ContentObserver
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.VolumeProvider
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationManagerCompat

class PrayerAudioService : Service() {

    companion object {
        const val ACTION_STOP = "com.islamnoor.app.STOP_ADHAN"
        private const val FG_ID = 424242
        private const val TAG = "PrayerAudio"
        private const val POLL_MS = 250L
        private const val GRACE_MS = 1500L
    }

    private var player: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var audioManager: AudioManager? = null
    private var volumeObserver: ContentObserver? = null
    private var session: MediaSession? = null

    private var baseline = ""
    private var armAt = 0L
    private var stopped = false

    private var curTitle = "Islam-Noor"
    private var curText = ""
    private var curChannel = NotificationHelper.CHANNEL_ADHAN

    private val handler = Handler(Looper.getMainLooper())

    private val poll = object : Runnable {
        override fun run() {
            if (stopped) return
            if (armAt > 0L && System.currentTimeMillis() >= armAt) {
                val now = volumeSnapshot()
                if (now != baseline) {
                    Log.i(TAG, "volume change detecte (poll): " + baseline + " -> " + now)
                    stopAudioKeepNotification(); return
                }
            }
            handler.postDelayed(this, POLL_MS)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        if (intent?.action == ACTION_STOP) {
            Log.i(TAG, "arret demande (bouton notification)")
            stopAudioKeepNotification()
            return START_NOT_STICKY
        }

        val isAdhan = intent?.getBooleanExtra("isAdhan", true) ?: true
        curTitle = intent?.getStringExtra("title") ?: "Islam-Noor"
        curText = intent?.getStringExtra("notifText")
            ?: if (isAdhan) "La priere commence" else "L'heure de la priere approche"
        val audioUrl = intent?.getStringExtra("audioUrl") ?: ""
        val vibrate = intent?.getBooleanExtra("vibrate", true) ?: true

        Log.i(TAG, "demarrage service isAdhan=" + isAdhan + " url=" + (audioUrl.isNotEmpty()))

        NotificationHelper.ensureChannels(this)
        curChannel = if (isAdhan) NotificationHelper.CHANNEL_ADHAN
                     else NotificationHelper.CHANNEL_REMINDER

        val notif = NotificationHelper
            .build(this, curChannel, curTitle, curText, true, audioUrl.isNotEmpty())
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(FG_ID, notif,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(FG_ID, notif)
            }
            Log.i(TAG, "foreground OK")
        } catch (e: Exception) {
            Log.w(TAG, "startForeground: " + e)
            NotificationHelper.show(this, FG_ID, curChannel, curTitle, curText)
        }

        if (vibrate) buzz()

        if (audioUrl.isEmpty()) {
            handler.postDelayed({ stopAudioKeepNotification() }, 1500L)
            return START_NOT_STICKY
        }

        acquireWake()
        startVolumeWatch()
        startVolumeKeyCapture()
        play(audioUrl)
        return START_NOT_STICKY
    }

    // ---------- lecture ----------

    private fun estTts(u: String): Boolean = u.contains("api/tts")

    private fun texteTts(u: String): String {
        return try {
            val m = Regex("[?&]text=([^&]*)").find(u) ?: return ""
            java.net.URLDecoder.decode(m.groupValues[1], "UTF-8")
        } catch (e: Exception) { "" }
    }

    private fun play(url: String) {
        if (estTts(url)) {
            val t = if (texteTts(url).isNotEmpty()) texteTts(url) else curText
            val ar = url.contains("onyx")
            Log.i(TAG, "voix native (alarme) : " + t.take(70))
            handler.postDelayed({ stopAudioKeepNotification() }, 25000L)
            Speaker.speak(this, t, ar, true) {
                handler.postDelayed({ stopAudioKeepNotification() }, 1200L)
            }
            return
        }
        playMedia(url)
    }

    private fun playMedia(url: String) {
        try {
            player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                setDataSource(url)
                setOnPreparedListener {
                    baseline = volumeSnapshot()
                    armAt = System.currentTimeMillis() + GRACE_MS
                    Log.i(TAG, "lecture demarree baseline=" + baseline)
                    it.start()
                }
                setOnCompletionListener {
                    Log.i(TAG, "lecture terminee")
                    stopAudioKeepNotification()
                }
                setOnErrorListener { _, w, e ->
                    Log.e(TAG, "MediaPlayer erreur " + w + "/" + e)
                    stopAudioKeepNotification(); true
                }
                prepareAsync()
            }
            handler.postDelayed({ stopAudioKeepNotification() }, 600000L)
        } catch (e: Exception) {
            Log.e(TAG, "MediaPlayer: " + e)
            stopAudioKeepNotification()
        }
    }

    // ---------- capture des touches volume (ecran eteint) ----------

    @Volatile private var stopTriggered = false
    private var armAtMs = 0L

    private fun triggerStop(why: String) {
        if (stopTriggered) return
        if (armAtMs != 0L && System.currentTimeMillis() < armAtMs) return
        stopTriggered = true
        Log.i(TAG, "arret demande: " + why)
        handler.post { stopAudioKeepNotification() }
    }

    private fun startVolumeKeyCapture() {
        try {
            val ms = android.media.session.MediaSession(this, "IslamNoorAdhan")
            session = ms
            ms.setFlags(
                android.media.session.MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS or
                android.media.session.MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
            )
            ms.setCallback(object : android.media.session.MediaSession.Callback() {
                override fun onMediaButtonEvent(mediaButtonIntent: android.content.Intent): Boolean {
                    val ke = mediaButtonIntent.getParcelableExtra<android.view.KeyEvent>(
                        android.content.Intent.EXTRA_KEY_EVENT)
                    if (ke != null && ke.action == android.view.KeyEvent.ACTION_DOWN &&
                        (ke.keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP ||
                         ke.keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN)) {
                        triggerStop("touche media " + ke.keyCode)
                        return true
                    }
                    return super.onMediaButtonEvent(mediaButtonIntent)
                }
                override fun onPause() { triggerStop("pause") }
                override fun onStop() { triggerStop("stop") }
            })

            val vp = object : android.media.VolumeProvider(
                android.media.VolumeProvider.VOLUME_CONTROL_RELATIVE, 20, 10) {
                override fun onAdjustVolume(direction: Int) {
                    if (direction != 0) triggerStop("volume dir=" + direction)
                }
                override fun onSetVolumeTo(volume: Int) {
                    triggerStop("volume set=" + volume)
                }
            }
            ms.setPlaybackToRemote(vp)

            ms.setPlaybackState(
                android.media.session.PlaybackState.Builder()
                    .setActions(
                        android.media.session.PlaybackState.ACTION_PLAY_PAUSE or
                        android.media.session.PlaybackState.ACTION_STOP)
                    .setState(android.media.session.PlaybackState.STATE_PLAYING, 0L, 1.0f)
                    .build()
            )
            ms.isActive = true
            armAtMs = System.currentTimeMillis() + 1200L
            Log.i(TAG, "capture volume active (mode relatif, haut + bas)")
        } catch (e: Exception) {
            Log.w(TAG, "capture volume: " + e)
        }
    }

    // ---------- surveillance de secours ----------

    private fun volumeSnapshot(): String {
        val am = audioManager ?: return ""
        return try {
            am.getStreamVolume(AudioManager.STREAM_ALARM).toString() + "/" +
            am.getStreamVolume(AudioManager.STREAM_MUSIC).toString() + "/" +
            am.getStreamVolume(AudioManager.STREAM_RING).toString() + "/" +
            am.getStreamVolume(AudioManager.STREAM_NOTIFICATION).toString()
        } catch (_: Exception) { "" }
    }

    private fun startVolumeWatch() {
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        baseline = volumeSnapshot()

        volumeObserver = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean) {
                if (stopped || armAt == 0L) return
                if (System.currentTimeMillis() < armAt) return
                if (volumeSnapshot() != baseline) {
                    Log.i(TAG, "volume change detecte (observer)")
                    stopAudioKeepNotification()
                }
            }
        }
        try {
            contentResolver.registerContentObserver(
                Settings.System.CONTENT_URI, true, volumeObserver!!)
        } catch (_: Exception) {}

        handler.postDelayed(poll, POLL_MS)
    }

    // ---------- arret : audio coupe, notification conservee ----------

    private fun stopAudioKeepNotification() {
        if (stopped) return
        stopped = true
        handler.removeCallbacksAndMessages(null)

        try { player?.let { if (it.isPlaying) it.stop(); it.release() } } catch (_: Exception) {}
        player = null

        try { session?.let { it.isActive = false; it.release() } } catch (_: Exception) {}
        session = null

        try { volumeObserver?.let { contentResolver.unregisterContentObserver(it) } } catch (_: Exception) {}
        volumeObserver = null

        try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Exception) {}
        wakeLock = null

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(Service.STOP_FOREGROUND_DETACH)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(false)
            }
        } catch (_: Exception) {}

        try {
            val n = NotificationHelper
                .build(this, curChannel, curTitle, curText, false, false)
                .setOngoing(false)
                .setAutoCancel(false)
                .build()
            NotificationManagerCompat.from(this).notify(FG_ID, n)
            Log.i(TAG, "notification conservee apres arret audio")
        } catch (e: Exception) {
            Log.w(TAG, "repost notif: " + e)
        }

        stopSelf()
    }

    // ---------- divers ----------

    private fun acquireWake() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IslamNoor:adhan")
                .also { it.acquire(600000L) }
        } catch (_: Exception) {}
    }

    private fun buzz() {
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE)
                    as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 200, 400), -1))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(longArrayOf(0, 400, 200, 400), -1)
            }
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        try { player?.release() } catch (_: Exception) {}
        player = null
        try { session?.let { it.isActive = false; it.release() } } catch (_: Exception) {}
        session = null
        try { volumeObserver?.let { contentResolver.unregisterContentObserver(it) } } catch (_: Exception) {}
        try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Exception) {}
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
