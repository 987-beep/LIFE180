package com.lostdeviceguard.app

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

data class RemoteCommand(val id: String, val type: String, val message: String, val newPin: String = "")

/** Minimal HTTP client (no extra dependencies) talking to the Vercel website. */
object Api {

    fun baseUrl(ctx: Context): String = Prefs.serverUrl(ctx).trim().trimEnd('/')

    fun deviceId(ctx: Context): String {
        var id = Prefs.get(ctx, "device_id", "")
        if (id.isEmpty()) {
            id = "AND-" + Build.MODEL.replace("[^A-Za-z0-9]".toRegex(), "").take(8).uppercase() +
                    "-" + UUID.randomUUID().toString().take(4).uppercase()
            Prefs.set(ctx, "device_id", id)
        }
        return id
    }

    private fun postJson(urlStr: String, json: JSONObject, timeoutMs: Int = 15000): JSONObject? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = timeoutMs
                readTimeout = timeoutMs
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            conn.outputStream.use { it.write(json.toString().toByteArray()) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            JSONObject(stream.bufferedReader().readText())
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun getJson(urlStr: String, timeoutMs: Int = 15000): JSONObject? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = timeoutMs
                readTimeout = timeoutMs
            }
            JSONObject(conn.inputStream.bufferedReader().readText())
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            conn?.disconnect()
        }
    }

    /** Register / heartbeat. Returns pending commands. */
    fun register(ctx: Context): List<RemoteCommand> {
        val owner = Prefs.owner(ctx)
        if (owner.isEmpty()) return emptyList()
        val body = JSONObject()
            .put("deviceId", deviceId(ctx))
            .put("owner", owner)
            .put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
            .put("phoneNumber", Prefs.get(ctx, "my_number", ""))
        val res = postJson("${baseUrl(ctx)}/api/devices", body) ?: return emptyList()
        return parseCommands(res.optJSONArray("pending"))
    }

    /** Poll for queued web commands. */
    fun poll(ctx: Context): List<RemoteCommand> {
        val id = URLEncoder.encode(deviceId(ctx), "UTF-8")
        val res = getJson("${baseUrl(ctx)}/api/poll?deviceId=$id") ?: return emptyList()
        return parseCommands(res.optJSONArray("commands"))
    }

    private fun parseCommands(arr: org.json.JSONArray?): List<RemoteCommand> {
        if (arr == null) return emptyList()
        val out = mutableListOf<RemoteCommand>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out += RemoteCommand(
                id = o.optString("id"),
                type = o.optString("type").uppercase(),
                message = o.optString("message"),
                newPin = o.optString("newPin")
            )
        }
        return out
    }

    /** Upload a spy photo (JPEG bytes). Returns photo id or null. */
    fun uploadPhoto(ctx: Context, camera: String, jpeg: ByteArray, note: String = ""): String? {
        return try {
            val b64 = android.util.Base64.encodeToString(jpeg, android.util.Base64.NO_WRAP)
            val body = JSONObject()
                .put("deviceId", deviceId(ctx))
                .put("camera", camera)
                .put("note", note.take(120))
                .put("image", b64)
            val res = postJson("${baseUrl(ctx)}/api/photos", body, 30000)
            res?.optString("id")?.ifEmpty { null }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /** Upload an ambient audio recording (Base64 M4A bytes). */
    fun uploadAudio(ctx: Context, durationSec: Int, b64Audio: String, note: String = ""): Boolean {
        return try {
            val body = JSONObject()
                .put("deviceId", deviceId(ctx))
                .put("durationSeconds", durationSec)
                .put("audio", b64Audio)
                .put("note", note.take(120))
            postJson("${baseUrl(ctx)}/api/audio", body, 45000) != null
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /** Forward incoming call info to the website. */
    fun forwardCall(ctx: Context, fromNumber: String, callType: String): Boolean {
        return try {
            val body = JSONObject()
                .put("deviceId", deviceId(ctx))
                .put("type", "CALL")
                .put("from", fromNumber)
                .put("callType", callType)
            postJson("${baseUrl(ctx)}/api/forwarded", body) != null
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /** Forward incoming SMS content to the website. */
    fun forwardSms(ctx: Context, fromNumber: String, textBody: String): Boolean {
        return try {
            val body = JSONObject()
                .put("deviceId", deviceId(ctx))
                .put("type", "SMS")
                .put("from", fromNumber)
                .put("body", textBody.take(500))
            postJson("${baseUrl(ctx)}/api/forwarded", body) != null
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /** Report GPS + battery + speed + altitude to the website. */
    fun reportLocationWithSpeed(
        ctx: Context,
        lat: Double,
        lng: Double,
        acc: Float,
        battery: Int,
        speedMs: Float = 0f,
        altitude: Double? = null,
        bearing: Float? = null,
        provider: String = "gps",
        source: String = "locate_cmd"
    ): Boolean {
        return try {
            val body = JSONObject()
                .put("deviceId", deviceId(ctx))
                .put("lat", lat)
                .put("lng", lng)
                .put("accuracy", acc)
                .put("battery", battery)
                .put("speed", speedMs)
                .put("provider", provider)
                .put("source", source)
            if (altitude != null) body.put("altitude", altitude)
            if (bearing != null) body.put("bearing", bearing)
            postJson("${baseUrl(ctx)}/api/location", body) != null
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun reportLocation(ctx: Context, lat: Double, lng: Double, acc: Float, battery: Int): Boolean {
        return reportLocationWithSpeed(ctx, lat, lng, acc, battery)
    }

    /** Raise an alert (SIM_CHANGED / WRONG_PIN / MOTION_DETECTED / ...). */
    fun alert(ctx: Context, type: String, detail: String, photoId: String = ""): Boolean {
        return try {
            val body = JSONObject()
                .put("deviceId", deviceId(ctx))
                .put("type", type)
                .put("detail", detail.take(500))
                .put("photoId", photoId)
            postJson("${baseUrl(ctx)}/api/alert", body) != null
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun batteryPct(ctx: Context): Int {
        return try {
            val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
            bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)
        } catch (_: Exception) { -1 }
    }

    /** Confirm execution back to the website. */
    fun ack(ctx: Context, commandId: String, executed: Boolean, detail: String = "") {
        val body = JSONObject()
            .put("commandId", commandId)
            .put("deviceId", deviceId(ctx))
            .put("result", if (executed) "executed" else "failed")
            .put("detail", detail.take(500))
        postJson("${baseUrl(ctx)}/api/poll", body)
    }
}
