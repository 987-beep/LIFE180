package com.lostdeviceguard.app

import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import com.lostdeviceguard.app.databinding.ActivityRingBinding

/**
 * Full-screen LOUD alarm: piercing siren + vibration + flashlight strobe,
 * at max volume for up to 5 minutes, even if the phone was on silent.
 * Owner stops it with the PIN (or STOP_RING from web/SMS).
 */
class RingActivity : AppCompatActivity() {

    companion object {
        private var wakeLock: PowerManager.WakeLock? = null
        private var stopTimer: Handler? = null
        const val RING_MINUTES = 5L

        /** Show the ringing UI via a full-screen notification (works from background). */
        fun show(ctx: Context) {
            try {
                ctx.startActivity(Intent(ctx, RingActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                })
                return
            } catch (_: Exception) { /* fall through to full-screen intent */ }

            try {
                val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.createNotificationChannel(
                    NotificationChannel("ring", "Lost-phone alarm", NotificationManager.IMPORTANCE_HIGH)
                )
                val full = PendingIntent.getActivity(
                    ctx, 1, Intent(ctx, RingActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                val n = NotificationCompat.Builder(ctx, "ring")
                    .setContentTitle("🔔 Lost phone ringing!")
                    .setContentText("Tap to stop with owner PIN")
                    .setSmallIcon(android.R.drawable.ic_lock_lock)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setFullScreenIntent(full, true)
                    .setAutoCancel(true)
                    .build()
                nm.notify(2001, n)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun stop(ctx: Context) {
            Siren.stop(ctx.applicationContext)
            try { wakeLock?.release() } catch (_: Exception) {}
            wakeLock = null
            stopTimer?.removeCallbacksAndMessages(null)
            stopTimer = null
            try {
                (ctx.applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                    .cancel(2001)
            } catch (_: Exception) {}
        }
    }

    private lateinit var binding: ActivityRingBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true); setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        try {
            (getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager)
                .requestDismissKeyguard(this, null)
        } catch (_: Exception) {}

        startAlarm()
        binding.tvRingMsg.text = "If found, please contact the owner.\n\n${Prefs.lockMessage(this)}"
        binding.btnStop.setOnClickListener {
            if (binding.etPin.text.toString() == Prefs.pin(this)) {
                stop(this)
                finish()
            } else {
                binding.etPin.error = "Wrong PIN"
            }
        }
    }

    private fun startAlarm() {
        stop(this) // reset any previous
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "ldg:ring"
            ).apply { acquire(RING_MINUTES * 60 * 1000L) }
        } catch (_: Exception) {}

        // 🚨 Siren + vibration + flashlight strobe at MAX volume
        Siren.start(this)

        // auto-stop after N minutes
        stopTimer = Handler(Looper.getMainLooper())
        stopTimer?.postDelayed({
            stop(this@RingActivity)
            try { finish() } catch (_: Exception) {}
        }, RING_MINUTES * 60 * 1000L)
    }

    override fun onBackPressed() { /* blocked — PIN required */ }

    override fun onDestroy() {
        // Keep ringing if user somehow leaves (stop only via PIN / STOP_RING / timer)
        super.onDestroy()
    }
}
