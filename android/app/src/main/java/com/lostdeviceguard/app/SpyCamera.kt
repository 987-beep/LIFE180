package com.lostdeviceguard.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import androidx.core.content.ContextCompat
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Silent camera capture (front/back) with NO preview and NO flash.
 * Used for remote FRONT_PHOTO / BACK_PHOTO commands, intruder selfies on LOCK,
 * and wrong-PIN photo traps. Call only from a background thread.
 */
object SpyCamera {

    @SuppressLint("MissingPermission")
    fun captureBlocking(ctx: Context, front: Boolean, timeoutMs: Long = 20_000): ByteArray? {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED
        ) return null

        var result: ByteArray? = null
        val done = CountDownLatch(1)
        val thread = HandlerThread("spy-cam").apply { start() }
        val handler = Handler(thread.looper)
        var camera: CameraDevice? = null
        var session: CameraCaptureSession? = null
        var reader: ImageReader? = null

        fun cleanup() {
            try { session?.close() } catch (_: Exception) {}
            try { camera?.close() } catch (_: Exception) {}
            try { reader?.close() } catch (_: Exception) {}
            thread.quitSafely()
        }

        try {
            val cm = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val want = if (front) CameraCharacteristics.LENS_FACING_FRONT
            else CameraCharacteristics.LENS_FACING_BACK
            val id = cm.cameraIdList.firstOrNull { cid ->
                try {
                    cm.getCameraCharacteristics(cid).get(CameraCharacteristics.LENS_FACING) == want
                } catch (_: Exception) { false }
            } ?: run { cleanup(); return null }

            val sizes = cm.getCameraCharacteristics(id)
                .get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?.getOutputSizes(ImageFormat.JPEG) ?: run { cleanup(); return null }
            val size = sizes.sortedBy { kotlin.math.abs(it.width - 1280) }.firstOrNull()
                ?: run { cleanup(); return null }

            reader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 2)
            reader!!.setOnImageAvailableListener({ r ->
                try {
                    val img = r.acquireLatestImage()
                    if (img != null) {
                        val buf = img.planes[0].buffer
                        val bytes = ByteArray(buf.remaining())
                        buf.get(bytes)
                        img.close()
                        result = bytes
                    }
                } catch (_: Exception) {
                } finally {
                    done.countDown()
                }
            }, handler)

            cm.openCamera(id, object : CameraDevice.StateCallback() {
                override fun onOpened(c: CameraDevice) {
                    camera = c
                    try {
                        c.createCaptureSession(
                            listOf(reader!!.surface),
                            object : CameraCaptureSession.StateCallback() {
                                override fun onConfigured(s: CameraCaptureSession) {
                                    session = s
                                    try {
                                        val req = c.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
                                        req.addTarget(reader!!.surface)
                                        req.set(
                                            CaptureRequest.CONTROL_AF_MODE,
                                            CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE
                                        )
                                        req.set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_OFF)
                                        s.capture(req.build(), null, handler)
                                    } catch (_: Exception) { done.countDown() }
                                }

                                override fun onConfigureFailed(s: CameraCaptureSession) { done.countDown() }
                            },
                            handler
                        )
                    } catch (_: Exception) { done.countDown() }
                }

                override fun onDisconnected(c: CameraDevice) { done.countDown() }
                override fun onError(c: CameraDevice, error: Int) { done.countDown() }
            }, handler)

            done.await(timeoutMs, TimeUnit.MILLISECONDS)
        } catch (_: Exception) {
        } finally {
            cleanup()
        }
        return result
    }

    /** Convenience: capture, shrink, upload — returns photo id or null. */
    fun snapAndUpload(ctx: Context, front: Boolean, note: String): String? {
        val raw = captureBlocking(ctx.applicationContext, front) ?: return null
        val small = PhotoUtil.shrink(raw)
        return Api.uploadPhoto(
            ctx.applicationContext,
            if (front) "front" else "back",
            small,
            note
        )
    }
}
