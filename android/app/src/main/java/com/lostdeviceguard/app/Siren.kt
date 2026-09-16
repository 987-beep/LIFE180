package com.lostdeviceguard.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.ContextCompat
import kotlin.math.sin

/**
 * 🚨 Maximum-attention alarm: piercing two-tone siren (synthesized in code,
 * no audio file needed) + strong vibration + flashlight strobe.
 * Designed so you can hear/find the phone from far away.
 */
object Siren {

    @Volatile private var running = false
    private var audioThread: Thread? = null
    private var track: AudioTrack? = null
    private var strobeThread: HandlerThread? = null
    private var strobeHandler: Handler? = null
    private var savedVolume = -1

    fun start(ctx: Context) {
        stop(ctx) // reset any previous
        running = true
        val app = ctx.applicationContext

        // 1) Force alarm stream to MAX volume
        try {
            val am = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            savedVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
        } catch (_: Exception) {}

        // 2) Piercing siren on a dedicated thread
        audioThread = Thread({ sirenLoop(app) }, "siren").apply { start() }

        // 3) Strong vibration pattern
        try {
            vibrator(app)?.vibrate(
                VibrationEffect.createWaveform(longArrayOf(0, 400, 150, 400, 150, 900), 0)
            )
        } catch (_: Exception) {}

        // 4) Flashlight strobe (needs CAMERA permission + a flash unit)
        try {
            if (ContextCompat.checkSelfPermission(app, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
            ) {
                val cm = app.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val flashId = cm.cameraIdList.firstOrNull { id ->
                    try {
                        cm.getCameraCharacteristics(id)
                            .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                    } catch (_: Exception) { false }
                }
                if (flashId != null) {
                    strobeThread = HandlerThread("strobe").apply { start() }
                    strobeHandler = Handler(strobeThread!!.looper)
                    strobeHandler!!.post(StrobeRunnable(app, flashId, strobeHandler!!))
                }
            }
        } catch (_: Exception) {}
    }

    fun stop(ctx: Context) {
        running = false
        try { audioThread?.join(800) } catch (_: Exception) {}
        audioThread = null
        try { track?.stop(); track?.release() } catch (_: Exception) {}
        track = null
        try { strobeHandler?.removeCallbacksAndMessages(null) } catch (_: Exception) {}
        try { strobeThread?.quitSafely() } catch (_: Exception) {}
        strobeThread = null
        strobeHandler = null
        // flashlight OFF + vibration OFF
        try {
            val cm = ctx.applicationContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            for (id in cm.cameraIdList) {
                try { cm.setTorchMode(id, false) } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
        try { vibrator(ctx.applicationContext)?.cancel() } catch (_: Exception) {}
        // restore volume
        try {
            if (savedVolume >= 0) {
                val am = ctx.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                am.setStreamVolume(AudioManager.STREAM_ALARM, savedVolume, 0)
                savedVolume = -1
            }
        } catch (_: Exception) {}
    }

    private fun vibrator(ctx: Context): Vibrator? {
        return try {
            if (Build.VERSION.SDK_INT >= 31) {
                (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
        } catch (_: Exception) { null }
    }

    /** Alternating 660Hz / 950Hz harsh siren, full amplitude. */
    private fun sirenLoop(ctx: Context) {
        val rate = 22050
        val chunkMs = 380
        val n = rate * chunkMs / 1000
        val low = makeTone(n, rate, 660.0)
        val high = makeTone(n, rate, 950.0)
        try {
            val t = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(rate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(n * 4)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()
            track = t
            t.play()
            var flip = false
            while (running) {
                flip = !flip
                t.write(if (flip) high else low, 0, n)
            }
        } catch (_: Exception) {
        }
    }

    /** Harsh siren tone: fundamental + harmonics (cuts through noise). */
    private fun makeTone(n: Int, rate: Int, freq: Double): ShortArray {
        val out = ShortArray(n)
        for (i in 0 until n) {
            val t = i.toDouble() / rate
            val s = sin(2 * Math.PI * freq * t) * 0.7 +
                    sin(2 * Math.PI * freq * 2 * t) * 0.2 +
                    sin(2 * Math.PI * freq * 3 * t) * 0.1
            // slight square-ish clip for harshness
            val clipped = s.coerceIn(-0.95, 0.95)
            out[i] = (clipped * Short.MAX_VALUE).toInt().toShort()
        }
        return out
    }

    private class StrobeRunnable(val ctx: Context, val camId: String, val handler: Handler) : Runnable {
        var on = false
        override fun run() {
            if (!running) return
            on = !on
            try {
                (ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager).setTorchMode(camId, on)
            } catch (_: Exception) {}
            try {
                handler.postDelayed(this, 450)
            } catch (_: Exception) {}
        }
    }
}
