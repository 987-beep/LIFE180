package com.lostdeviceguard.app

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.lostdeviceguard.app.databinding.ActivityLockBinding

/**
 * Owner-PIN gate: covers the screen after a LOCK command.
 * Nobody can use the phone until the OWNER's PIN is entered.
 * 😠 After 3 wrong PINs, silently photographs the intruder and
 * uploads it to the website + raises a WRONG_PIN alert.
 */
class LockActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLockBinding
    private var wrongCount = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLockBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true); setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        if (intent.getBooleanExtra("shutdown_mode", false)) {
            binding.tvLockTitle.text = "⏻ DEVICE DISABLED BY OWNER"
        }
        binding.tvLockMsg.text = Prefs.lockMessage(this)
        binding.tvLockOwner.text = "Owner: ${Prefs.owner(this)}"

        binding.btnUnlock.setOnClickListener {
            if (binding.etPin.text.toString() == Prefs.pin(this)) {
                Prefs.setLostMode(this, false)
                finish()
            } else {
                wrongCount++
                binding.etPin.error = "Wrong PIN — only the owner can unlock"
                binding.etPin.text?.clear()
                binding.tvAttempts.text = "⚠️ Wrong attempt $wrongCount/3 — smile, you're on camera 📷"
                if (wrongCount >= 3) {
                    wrongCount = 0
                    trapIntruder()
                }
            }
        }
    }

    private fun trapIntruder() {
        binding.tvAttempts.text = "📷 Intruder photo captured + sent to owner!"
        Thread {
            try {
                val photoId = SpyCamera.snapAndUpload(
                    applicationContext, true, "wrong-PIN trap (3 failed attempts)"
                )
                Api.alert(
                    applicationContext, "WRONG_PIN",
                    "Someone entered 3 wrong PINs on the lock gate.", photoId ?: ""
                )
            } catch (_: Exception) {}
        }.start()
    }

    override fun onBackPressed() { /* blocked — owner PIN required */ }
}
