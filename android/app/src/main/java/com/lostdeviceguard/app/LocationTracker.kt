package com.lostdeviceguard.app

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper

/**
 * High-accuracy GPS & speed tracker:
 * - Computes speed in m/s (from Location.speed or distance/time delta)
 * - Identifies driving vs stationary
 * - Supports one-shot locate, periodic updates, and 30-day history recording
 */
object LocationTracker {

    private var lastLocation: Location? = null
    private var lastTimeMs: Long = 0L

    @SuppressLint("MissingPermission")
    fun getFreshLocation(ctx: Context, source: String = "locate_cmd"): Location? {
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        var best: Location? = null

        // Try GPS, Network, and Passive providers
        for (provider in lm.getProviders(true)) {
            try {
                val loc = lm.getLastKnownLocation(provider) ?: continue
                if (best == null || loc.time > best.time || (loc.hasAccuracy() && loc.accuracy < (best.accuracy ?: 999f))) {
                    best = loc
                }
            } catch (_: SecurityException) {}
        }

        if (best != null) {
            report(ctx, best, source)
        }
        return best
    }

    /**
     * Reports GPS point + speed + battery to the backend API.
     */
    fun report(ctx: Context, loc: Location, source: String) {
        val now = System.currentTimeMillis()
        var speedMs = if (loc.hasSpeed()) loc.speed else 0f

        // Fallback speed calculation if sensor didn't report speed
        val prev = lastLocation
        val prevTime = lastTimeMs
        if (speedMs <= 0f && prev != null && prevTime > 0 && now > prevTime) {
            val dtSec = (now - prevTime) / 1000f
            if (dtSec in 2f..300f) {
                val distMeters = loc.distanceTo(prev)
                speedMs = distMeters / dtSec
            }
        }

        lastLocation = loc
        lastTimeMs = now

        val batt = Api.batteryPct(ctx)
        val alt = if (loc.hasAltitude()) loc.altitude else null
        val bearing = if (loc.hasBearing()) loc.bearing else null

        Api.reportLocationWithSpeed(
            ctx = ctx,
            lat = loc.latitude,
            lng = loc.longitude,
            acc = if (loc.hasAccuracy()) loc.accuracy else 0f,
            battery = batt,
            speedMs = speedMs,
            altitude = alt,
            bearing = bearing,
            provider = loc.provider ?: "gps",
            source = source
        )
    }
}
