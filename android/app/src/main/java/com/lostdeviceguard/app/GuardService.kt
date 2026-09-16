package com.lostdeviceguard.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service:
 * 1. Polls website for commands every 15s.
 * 2. Manages live tracking mode (GPS pings every 30s with speed & driving calculation).
 * 3. Manages motion alarm sensor.
 */
class GuardService : Service() {

    companion object {
        const val CH = "guard"
        const val NOTIF_ID = 1001
        const val POLL_MS = 15_000L
        const val LIVE_TRACK_INTERVAL_MS = 30_000L
        const val HEARTBEAT_EVERY = 4 // register every 4th poll (~60s)

        private var instance: GuardService? = null
        private var motionGuard: MotionGuard? = null

        fun start(ctx: Context) {
            val i = Intent(ctx, GuardService::class.java)
            try {
                ctx.startForegroundService(i)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, GuardService::class.java))
        }

        fun startLiveTracking(ctx: Context, durationMs: Long = 3600_000L) {
            Prefs.set(ctx, "live_track_until", (System.currentTimeMillis() + durationMs).toString())
            start(ctx)
        }

        fun stopLiveTracking(ctx: Context) {
            Prefs.set(ctx, "live_track_until", "0")
        }

        fun armMotion(ctx: Context) {
            start(ctx)
            motionGuard?.arm() ?: run {
                val mg = MotionGuard(ctx.applicationContext)
                mg.arm()
                motionGuard = mg
            }
        }

        fun disarmMotion(ctx: Context) {
            motionGuard?.disarm()
            Prefs.setBool(ctx, "motion_armed", false)
        }
    }

    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private var tick = 0
    private var lastLiveTrackMs = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        Prefs.setBool(this, "protection_on", true)
        createChannel()
        startForeground(NOTIF_ID, buildNotif("LIFE180% active — phone protected"))

        // Initialize motion guard if it was saved as armed
        if (motionGuard == null) {
            motionGuard = MotionGuard(applicationContext)
        }
        if (Prefs.getBool(this, "motion_armed", false)) {
            motionGuard?.arm()
        }

        thread = HandlerThread("GuardLoop").apply {
            start()
            handler = Handler(looper)
            handler?.post(loopRunnable)
        }
    }

    private val loopRunnable = object : Runnable {
        override fun run() {
            try {
                workTick()
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                handler?.postDelayed(this, POLL_MS)
            }
        }
    }

    private fun workTick() {
        val app = applicationContext
        tick++

        // 1. Live Tracking Mode Check: GPS every 30s
        val trackUntil = Prefs.get(app, "live_track_until", "0").toLongOrNull() ?: 0L
        val now = System.currentTimeMillis()
        if (now < trackUntil && (now - lastLiveTrackMs >= LIVE_TRACK_INTERVAL_MS)) {
            lastLiveTrackMs = now
            try {
                LocationTracker.getFreshLocation(app, "live_track")
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 2. Heartbeat registration
        if (tick % HEARTBEAT_EVERY == 1) {
            try {
                val pending = Api.register(app)
                execCommands(pending)
            } catch (_: Exception) {}
        }

        // 3. Poll for queued web commands
        try {
            val cmds = Api.poll(app)
            execCommands(cmds)
        } catch (_: Exception) {}
    }

    private fun execCommands(cmds: List<RemoteCommand>) {
        val app = applicationContext
        for (cmd in cmds) {
            val res = CommandExecutor.handle(app, cmd.type, cmd.message, "web", cmd.newPin)
            Api.ack(app, cmd.id, true, res)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        motionGuard?.disarm()
        thread?.quitSafely()
        thread = null
        handler = null
        instance = null
        Prefs.setBool(this, "protection_on", false)
    }

    private fun createChannel() {
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        val ch = NotificationChannel(
            CH,
            "LIFE180% Protection",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Runs quietly in background to protect your device"
            setShowBadge(false)
        }
        mgr.createNotificationChannel(ch)
    }

    private fun buildNotif(text: String): Notification {
        val pi = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CH)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle("LIFE180%")
            .setContentText(text)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }
}
