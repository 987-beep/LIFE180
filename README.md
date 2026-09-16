# 🛡️ LIFE180% — v1.3 Pro Edition

A complete, production-ready anti-theft defense platform for Android. If your phone is lost or stolen, control it from the modern web dashboard or directly via SMS / WhatsApp with zero internet needed.

---

## ⚡ What's New in v1.3 Pro

All requested advanced defense features are built and compiled:

1. 🎙️ **Remote Audio Recording**
   - Remotely trigger silent 30-second ambient audio recordings using the phone's microphone.
   - Streams directly in the web dashboard audio player so you can hear who is around your phone.

2. 🗺️ **Live Tracking Mode (GPS every 30s for 1 Hour)**
   - Continuous high-frequency pings report GPS coordinates every 30 seconds.
   - Calculates speed (km/h & mph) and logs route changes in real time.

3. 🚗 **Full Driving Speed & Where-Gone 30-Day History**
   - Automatic velocity detection: highlights vehicle driving (`> 15 km/h`) vs stationary/walking.
   - Peak speed recorder, waypoint count, and map links for every coordinate.
   - **30-Day Rolling Window**: Automatically retains all location points, audio clips, and alerts for 30 days. On Day 31, Day 1 data is automatically purged.

4. 🥷 **Stealth Mode**
   - Remotely hide the app icon from the Android launcher so the thief cannot see or uninstall the app.
   - Unhide anytime via web dashboard or SMS (`STEALTH OFF <pin>`).

5. 📲 **Call & SMS Forwarder**
   - Intercepts incoming phone calls and text messages on your lost phone.
   - Forwards sender numbers and SMS message bodies directly to your web dashboard.

6. 🪫 **Low-Battery & Shutdown Emergency SMS**
   - When battery drops below 15% or the phone initiates shutdown, it captures the final GPS fix and immediately texts your trusted emergency phone number with Google Maps coordinates.

7. 📵 **Power-Off Blocker**
   - When locked, LIFE180% puts an active full-screen security gate over system dialogs, blocking thieves from accessing power off / restart menus without the owner PIN.

8. 🔊 **Motion Re-Siren Alarm**
   - Arm the accelerometer sensor remotely.
   - If a thief picks up or moves the phone from a table or bag, it instantly screams a max-volume siren, triggers flashlight strobing, snaps a front intruder selfie, and raises a critical alert.

---

## 📦 Ready-to-Install APK

The APK is pre-built, signed, and tested in the workspace:

- **File**: `LostDeviceGuard-v1.3.apk` (6.3 MB)
- **Target**: Android 8.0 (API 26) through Android 14 (API 34)
- **Permissions**: Audio recording, GPS, SMS receiver/sender, Camera, Phone state, Device Admin

---

## 🚀 Quick Setup (3 Minutes)

### Step 1: Install APK on Phone
1. Transfer `LostDeviceGuard-v1.3.apk` to your phone (via USB, Google Drive, or messaging).
2. Tap the APK to install.
3. Open **LIFE180%**.
4. In Section 1️⃣, enter your Web Dashboard URL (or leave the default if using local preview).
5. Tap **Sign in with Google** (or enter your owner email).
6. Tap **Enable Device Admin**, grant permissions, set your **Emergency PIN**, and tap **🛡️ ON**.

### Step 2: Open Dashboard
1. Visit your deployed web dashboard or the live preview URL.
2. Sign in with the same Google account.
3. Select your phone from the device pad.
4. Test **Record Audio**, **Live Track**, **Lock**, or **Ring Loudly**!

---

## 💬 SMS Offline Command Cheat Sheet

Works anywhere without WiFi or mobile data turned on:

| Command | Action |
|---|---|
| `LOCK MY DEVICE 1234` | Instantly locks screen + launches PIN gate + intruder selfie |
| `LOCK MY DEVICE 1234 NEW PIN 5678` | Locks device AND changes the owner PIN to `5678` |
| `UNLOCK MY DEVICE 1234` | Clears the lost-mode PIN gate remotely |
| `RECORD AUDIO 1234` | Records 30s ambient audio and uploads on next sync |
| `START LIVE TRACK 1234` | Pings GPS every 30s for 1 hour |
| `STEALTH ON 1234` | Hides app icon from app drawer |
| `STEALTH OFF 1234` | Restores app icon |
| `ARM MOTION 1234` | Arms motion sensor (siren sounds if moved) |
| `RING MY DEVICE 1234` | Screams 5-minute loud siren + strobe |
| `LOCATE MY DEVICE 1234` | Replies with current GPS coordinates & battery % |
| `TAKE PHOTO 1234` | Takes silent front photo |

*(Replace `1234` with your configured PIN)*
