package com.lostdeviceguard.app

import android.content.Context

/** Simple SharedPreferences store for account + security settings. */
object Prefs {
    private const val FILE = "ldg_prefs"

    fun get(ctx: Context, key: String, def: String = ""): String =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(key, def) ?: def

    fun set(ctx: Context, key: String, value: String) =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(key, value).apply()

    fun getBool(ctx: Context, key: String, def: Boolean = false): Boolean =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(key, def)

    fun setBool(ctx: Context, key: String, value: Boolean) =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(key, value).apply()

    fun serverUrl(ctx: Context): String {
        val saved = get(ctx, "server_url", "")
        return if (saved.isNotBlank()) saved else BuildConfig.SERVER_URL
    }

    fun owner(ctx: Context): String = get(ctx, "owner_email", "")
    fun pin(ctx: Context): String = get(ctx, "pin", "1234")
    fun trustedNumber(ctx: Context): String = get(ctx, "trusted_number", "")
    fun lockMessage(ctx: Context): String =
        get(ctx, "lock_message", "This phone is lost. Please return it — owner will reward you!")
    fun isLostMode(ctx: Context): Boolean = getBool(ctx, "lost_mode", false)
    fun setLostMode(ctx: Context, on: Boolean) = setBool(ctx, "lost_mode", on)
}
