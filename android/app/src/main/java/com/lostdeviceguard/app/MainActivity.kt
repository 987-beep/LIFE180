package com.lostdeviceguard.app

import android.Manifest
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.lostdeviceguard.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var googleClient: GoogleSignInClient

    private val signInLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
            if (res.resultCode == Activity.RESULT_OK) {
                try {
                    val task = GoogleSignIn.getSignedInAccountFromIntent(res.data)
                    val account = task.getResult(ApiException::class.java)
                    val email = account?.email?.lowercase() ?: ""
                    Prefs.set(this, "owner_email", email)
                    toast("✅ Signed in as $email")
                    refreshAll()
                } catch (e: ApiException) {
                    toast("Google sign-in failed: ${e.statusCode}")
                }
            }
        }

    private val adminLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            refreshAll()
            if (CommandExecutor.isAdmin(this)) toast("✅ Device Admin ON — lock/wipe armed")
            else toast("⚠️ Device Admin still OFF — remote lock won't work")
        }

    private val permLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            refreshAll()
            runCheckup()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        googleClient = GoogleSignIn.getClient(
            this,
            GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .build()
        )
        GoogleSignIn.getLastSignedInAccount(this)?.email?.let {
            if (Prefs.owner(this).isEmpty()) Prefs.set(this, "owner_email", it.lowercase())
        }

        // ---- checkup ----
        binding.btnCheckup.setOnClickListener { runCheckup() }

        // ---- server ----
        binding.etServer.setText(Prefs.serverUrl(this))
        binding.btnSaveServer.setOnClickListener {
            val u = binding.etServer.text.toString().trim().trimEnd('/')
            if (u.startsWith("http://") || u.startsWith("https://")) {
                Prefs.set(this, "server_url", u)
                toast("Saved server: $u")
                runCheckup()
            } else {
                toast("URL must start with https:// or http://")
            }
        }
        binding.btnTestServer.setOnClickListener {
            toast("Testing connection…")
            Thread {
                val ok = try {
                    Api.register(this)
                    true
                } catch (_: Exception) { false }
                runOnUiThread {
                    toast(if (ok) "✅ Server connected successfully" else "❌ Cannot reach server")
                    runCheckup()
                }
            }.start()
        }

        // ---- account ----
        binding.btnGoogle.setOnClickListener {
            signInLauncher.launch(googleClient.signInIntent)
        }
        binding.btnSignOut.setOnClickListener {
            googleClient.signOut().addOnCompleteListener {
                Prefs.set(this, "owner_email", "")
                toast("Signed out")
                refreshAll()
            }
        }

        // ---- device admin ----
        binding.btnAdmin.setOnClickListener {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, CommandExecutor.adminComponent(this@MainActivity))
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "LIFE180% needs Device Admin to remotely LOCK your screen, enforce owner PIN, and factory-reset as a last resort if stolen."
                )
            }
            adminLauncher.launch(intent)
        }

        // ---- permissions ----
        binding.btnPermSms.setOnClickListener {
            permLauncher.launch(arrayOf(
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.SEND_SMS
            ))
        }
        binding.btnPermNotif.setOnClickListener {
            if (Build.VERSION.SDK_INT >= 33) {
                permLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
            } else {
                toast("Notifications already allowed on this Android version")
            }
        }
        binding.btnPermCamera.setOnClickListener {
            permLauncher.launch(arrayOf(Manifest.permission.CAMERA))
        }
        binding.btnPermLocation.setOnClickListener {
            permLauncher.launch(arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ))
        }
        binding.btnNotifAccess.setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            } catch (e: Exception) {
                toast("Could not open settings: ${e.message}")
            }
        }
        binding.btnSimSave.setOnClickListener {
            val fp = BootReceiver.simFingerprint(this)
            if (fp.isNotEmpty()) {
                Prefs.set(this, "sim_baseline", fp)
                toast("💾 SIM fingerprint saved: $fp")
            } else {
                toast("No SIM detected or permission needed")
            }
            runCheckup()
        }
        binding.btnBattery.setOnClickListener {
            try {
                if (Build.VERSION.SDK_INT >= 23) {
                    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    startActivity(intent)
                }
            } catch (e: Exception) {
                toast("Could not open battery settings: ${e.message}")
            }
        }

        // ---- security settings (PIN + trusted number + lock msg) ----
        binding.etPin.setText(Prefs.pin(this))
        binding.etTrusted.setText(Prefs.trustedNumber(this))
        binding.etLockMsg.setText(Prefs.lockMessage(this))
        binding.btnSaveSecurity.setOnClickListener {
            val p = binding.etPin.text.toString().trim()
            val t = binding.etTrusted.text.toString().trim()
            val m = binding.etLockMsg.text.toString().trim()
            if (p.isNotEmpty()) Prefs.set(this, "pin", p)
            Prefs.set(this, "trusted_number", t)
            if (m.isNotEmpty()) Prefs.set(this, "lock_message", m)
            toast("✅ Security settings saved")
        }

        // ---- protection start/stop ----
        binding.btnProtectOn.setOnClickListener {
            if (Prefs.get(this, "sim_baseline", "").isEmpty()) {
                val fp = BootReceiver.simFingerprint(this)
                if (fp.isNotEmpty()) Prefs.set(this, "sim_baseline", fp)
            }
            GuardService.start(this)
            toast("🛡️ Protection service started")
            refreshAll()
        }
        binding.btnProtectOff.setOnClickListener {
            GuardService.stop(this)
            toast("Protection stopped")
            refreshAll()
        }

        // ---- quick test buttons ----
        binding.btnTestLock.setOnClickListener {
            toast("Testing lock…")
            Thread {
                val res = CommandExecutor.handle(this, "LOCK", source = "manual test")
                runOnUiThread { toast(res) }
            }.start()
        }
        binding.btnTestRing.setOnClickListener {
            RingActivity.show(this)
        }
        binding.btnTestPhoto.setOnClickListener {
            toast("Snapping test photo…")
            Thread {
                val id = SpyCamera.snapAndUpload(this, front = true, "manual test photo")
                runOnUiThread {
                    if (id != null) toast("Photo uploaded: $id") else toast("Photo failed")
                }
            }.start()
        }
        binding.btnPollNow.setOnClickListener {
            toast("Polling server…")
            Thread {
                try {
                    val cmds = Api.poll(this)
                    runOnUiThread { toast("Got ${cmds.size} command(s)") }
                    for (c in cmds) {
                        val res = CommandExecutor.handle(this, c.type, c.message, "web", c.newPin)
                        Api.ack(this, c.id, true, res)
                    }
                } catch (e: Exception) {
                    runOnUiThread { toast("Poll failed: ${e.message}") }
                }
            }.start()
        }

        refreshAll()
        runCheckup()
    }

    override fun onResume() {
        super.onResume()
        refreshAll()
    }

    private fun refreshAll() {
        binding.tvDeviceId.text = "Device ID: ${Api.deviceId(this)}"

        val owner = Prefs.owner(this)
        if (owner.isNotEmpty()) {
            binding.tvAccount.text = "Signed in: $owner"
            binding.btnGoogle.isEnabled = false
            binding.btnSignOut.isEnabled = true
        } else {
            binding.tvAccount.text = "❌ Not signed in (tap Google sign in below)"
            binding.btnGoogle.isEnabled = true
            binding.btnSignOut.isEnabled = false
        }

        val admin = CommandExecutor.isAdmin(this)
        binding.tvAdminStatus.text = if (admin) "✅ Device Admin is ACTIVE" else "❌ Device Admin is INACTIVE"
        binding.btnAdmin.isEnabled = !admin

        val protOn = Prefs.getBool(this, "protection_on", false)
        binding.tvProtectStatus.text = if (protOn) "🟢 Protection is RUNNING" else "⚪ Protection is STOPPED"
    }

    private fun runCheckup() {
        binding.tvBannerTitle.text = "Checking protections…"
        binding.checkupContainer.removeAllViews()

        Thread {
            val items = Checkup.run(this)
            val okCount = items.count { it.ok }
            val total = items.size
            runOnUiThread {
                binding.tvBannerTitle.text = if (okCount == total) "🛡️ Fully Guarded!" else "⚠️ Needs Attention"
                binding.tvBannerScore.text = "$okCount / $total protections active"
                binding.tvCheckupScore.text = "$okCount / $total protections active"
                binding.tvBannerSub.text = if (okCount == total)
                    "Your phone is ready for remote lock, audio recording, 30-day driving tracker & spy camera."
                else
                    "Fix items marked with ❌ below for full theft protection."

                for (it in items) {
                    val row = LinearLayout(this).apply {
                        orientation = LinearLayout.HORIZONTAL
                        setPadding(0, 8, 0, 8)
                    }
                    val icon = TextView(this).apply {
                        text = if (it.ok) "✅" else "❌"
                        textSize = 14f
                        setPadding(0, 0, 16, 0)
                    }
                    val textLayout = LinearLayout(this).apply {
                        orientation = LinearLayout.VERTICAL
                    }
                    val title = TextView(this).apply {
                        text = it.label
                        textSize = 14f
                        setTypeface(null, Typeface.BOLD)
                    }
                    val hint = TextView(this).apply {
                        text = it.hint
                        textSize = 12f
                        setTextColor(if (it.ok) 0xFF4ADE80.toInt() else 0xFFF87171.toInt())
                    }
                    textLayout.addView(title)
                    textLayout.addView(hint)
                    row.addView(icon)
                    row.addView(textLayout)
                    binding.checkupContainer.addView(row)
                }
            }
        }.start()
    }

    private fun toast(s: String) {
        Toast.makeText(this, s, Toast.LENGTH_SHORT).show()
    }
}
