package com.lostdeviceguard.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream

/** Downscale photos before upload so they send fast even on 2G/3G. */
object PhotoUtil {

    fun shrink(jpeg: ByteArray, maxDim: Int = 960, quality: Int = 70): ByteArray {
        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, bounds)
            var sample = 1
            val maxSide = maxOf(bounds.outWidth, bounds.outHeight)
            while (maxSide / (sample * 2) > maxDim) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            var bmp = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, opts) ?: return jpeg
            val scale = maxDim.toFloat() / maxOf(bmp.width, bmp.height).toFloat()
            if (scale < 1f) {
                val w = (bmp.width * scale).toInt()
                val h = (bmp.height * scale).toInt()
                val scaled = Bitmap.createScaledBitmap(bmp, w, h, true)
                if (scaled != bmp) bmp.recycle()
                bmp = scaled
            }
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, out)
            bmp.recycle()
            out.toByteArray()
        } catch (_: Exception) {
            jpeg
        }
    }
}
