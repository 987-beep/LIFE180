package com.lostdeviceguard.app

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

/**
 * Accelerometer motion monitor:
 * When armed (e.g. thief picked up the table-sitting phone), triggers
 * instant loud siren + flash strobe + sends MOTION_DETECTED alert + intruder selfie.
 */
class MotionGuard(private val ctx: Context) : SensorEventListener {

    private val sensorManager = ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private var armed = false
    private var lastTriggerTime = 0L
    private val threshold = 3.5f // Delta acceleration in m/s^2 above normal gravity

    private var lastX = 0f
    private var lastY = 0f
    private var lastZ = 9.8f
    private var initialized = false

    fun arm() {
        if (armed) return
        armed = true
        Prefs.setBool(ctx, "motion_armed", true)
        accelerometer?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    fun disarm() {
        armed = false
        Prefs.setBool(ctx, "motion_armed", false)
        sensorManager?.unregisterListener(this)
    }

    fun isArmed(): Boolean = armed

    override fun onSensorChanged(event: SensorEvent?) {
        if (!armed || event == null) return
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        if (!initialized) {
            lastX = x
            lastY = y
            lastZ = z
            initialized = true
            return
        }

        val dx = x - lastX
        val dy = y - lastY
        val dz = z - lastZ
        val delta = sqrt(dx * dx + dy * dy + dz * dz)

        lastX = x
        lastY = y
        lastZ = z

        val now = System.currentTimeMillis()
        if (delta > threshold && (now - lastTriggerTime > 15_000L)) {
            lastTriggerTime = now
            onMotionDetected()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun onMotionDetected() {
        // 1. Ring siren loudly
        RingActivity.show(ctx)

        // 2. Snap intruder photo + raise alert on website
        val app = ctx.applicationContext
        Thread {
            try {
                val photoId = SpyCamera.snapAndUpload(app, true, "Motion detected! Someone moved phone.")
                Api.alert(
                    app,
                    "MOTION_DETECTED",
                    "🔊 Motion sensor triggered! Phone was moved or picked up.",
                    photoId ?: ""
                )
            } catch (_: Exception) {}
        }.start()
    }
}
