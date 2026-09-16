# 🌐 LIFE180% — Server Connection & Vercel Deployment Guide

Follow this guide to deploy your **LIFE180%** web dashboard to Vercel for free, connect it with the **LIFE180.apk** Android app, and configure unified Google Authentication.

---

## ⚡ Part 1: Deploy Web Server to Vercel (2 Minutes, Free)

Vercel is the native cloud for Next.js. Deploying requires zero server management:

### Option A: Via GitHub (Recommended)
1. Push the `/home/user/lock-my-device` folder (or just the `web` subfolder) to your **GitHub** account.
2. Go to [https://vercel.com](https://vercel.com) and log in (with GitHub).
3. Click **"Add New..."** ➔ **"Project"**.
4. Select your repository.
5. In the configuration screen:
   - If you pushed the whole repository, set **Root Directory** to `web`.
   - **Framework Preset**: Next.js (automatically detected).
6. Click **"Deploy"**.
7. In ~45 seconds, Vercel gives you your live production URL:  
   👉 `https://life180-xxxx.vercel.app`

### Option B: Via Vercel CLI (From Terminal)
If you have node & npm installed on your machine:
```bash
npm install -g vercel
cd lock-my-device/web
vercel
```

---

## 📱 Part 2: Connect the Android App to Your Vercel Server

1. Open **LIFE180%** on your Android phone.
2. In screen **1️⃣ SERVER CONNECTION**:
   - Enter your Vercel URL:  
     `https://your-app-name.vercel.app`
   - Tap **"Save server URL"**.
3. Tap **"Test connection"**.  
   - The app pings `/api/health` and `/api/devices`.
   - You will see: **`✅ Server connected successfully`**.
4. Tap **"Sign in with Google"** (or enter your owner Gmail).
5. Tap **"Enable Device Admin"**, grant permissions, and tap **"🛡️ ON"**.

*Your phone is now linked with your cloud server.*

---

## 🔐 Part 3: Combine Google Authentication (Web + Android)

To have **one single Gmail sign-in** for both your phone and website:

1. Open [Firebase Console](https://console.firebase.google.com) (100% free Google Cloud service).
2. Click **Create a project** ➔ name it `life180-guard` ➔ continue (Google Analytics not needed).
3. In the left sidebar: **Build** ➔ **Authentication** ➔ click **Get Started**.
4. Under **Sign-in method**, click **Google** ➔ toggle **Enable** ➔ choose your support email ➔ **Save**.
5. Click **Project Settings** (gear icon top-left) ➔ scroll to **Your apps** ➔ click the **Web (</>) icon**:
   - Register app nickname `LIFE180-Web`.
   - Firebase will show a config block with 3 keys:
     ```js
     apiKey: "AIzaSy..."
     authDomain: "life180-guard.firebaseapp.com"
     projectId: "life180-guard"
     ```
6. In Firebase Console: **Authentication** ➔ **Settings** ➔ **Authorized domains** ➔ click **Add domain**:
   - Paste your Vercel URL (e.g. `your-app-name.vercel.app`).
7. In your [Vercel Dashboard](https://vercel.com):
   - Project ➔ **Settings** ➔ **Environment Variables**:
     - `NEXT_PUBLIC_FIREBASE_API_KEY` = `your_api_key`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `your_auth_domain`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = `your_project_id`
   - Click **Deployments** ➔ **Redeploy**.

Now when you tap **"Sign in with Google"** on the website, it uses the identical Google Identity as your Android phone.

---

## 🧪 Part 4: Verification Checklist

1. [ ] Visit `https://your-app-name.vercel.app/api/health` ➔ returns `{"status":"ok","app":"LIFE180%","ready":true}`.
2. [ ] Open website dashboard ➔ sign in with your Gmail.
3. [ ] Open phone app ➔ tap **"Test connection"** ➔ shows green tick.
4. [ ] In web dashboard ➔ see your phone appear as **`📱 Pixel / Samsung (online)`**.
5. [ ] On web dashboard ➔ click **"Record Audio"** or **"Lock"** ➔ verify command executes on phone in <15 seconds!
