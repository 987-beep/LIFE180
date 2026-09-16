package com.lostdeviceguard.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileInputStream

/**
 * Silently records ambient audio (e.g. 30 seconds) using the phone microphone
 * and uploads it to the website dashboard as AAC/M4A.
 */
object AudioRecorderHelper {

    fun recordAndUpload(ctx: Context, durationSec: Int = 30, note: String = "Ambient audio"): Boolean {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return false
        }

        val outputFile = File(ctx.cacheDir, "ambient_${System.currentTimeMillis()}.m4a")
        var recorder: MediaRecorder? = null
        try {
            recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(ctx)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(64000)
                setAudioSamplingRate(22050)
                setOutputFile(outputFile.absolutePath)
                prepare()
                start()
            }

            // Record for durationSec (e.g. 30 seconds)
            Thread.sleep((durationSec * 1000).toLong())

            try {
                recorder.stop()
            } catch (_: Exception) {}
            recorder.release()
            recorder = null

            if (outputFile.exists() && outputFile.length() > 0) {
                val bytes = FileInputStream(outputFile).use { it.readBytes() }
                val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                outputFile.delete()
                return Api.uploadAudio(ctx, durationSec, b64, note)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                recorder?.release()
            } catch (_: Exception) {}
            outputFile.delete()
        }
        return false
    }
}
