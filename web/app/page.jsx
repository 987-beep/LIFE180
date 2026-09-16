"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("checking"); // checking | google | demo
  const [gUser, setGUser] = useState(null);

  useEffect(() => {
    // ♾️ Infinite session: already logged in on this browser? Go straight in.
    const saved = localStorage.getItem("ldg_email");
    if (saved) { router.push("/dashboard"); return; }

    let unsub = null;
    (async () => {
      const fb = await getFirebaseAuth();
      if (fb.auth) {
        setMode("google");
        unsub = fb.onAuthStateChanged((u) => {
          if (u?.email) {
            setGUser(u);
            localStorage.setItem("ldg_email", u.email.toLowerCase());
            localStorage.setItem("ldg_auth", "google");
            router.push("/dashboard");
          }
        });
      } else {
        setMode("demo");
      }
    })();
    return () => { try { unsub && unsub(); } catch {} };
  }, [router]);

  function demoSignIn(e) {
    e?.preventDefault();
    if (!email || !email.includes("@")) {
      alert("Please enter your Google / Gmail address — the SAME one you use in the Android app.");
      return;
    }
    setLoading(true);
    localStorage.setItem("ldg_email", email.trim().toLowerCase());
    localStorage.setItem("ldg_auth", "demo");
    setTimeout(() => router.push("/dashboard"), 600);
  }

  async function googleSignIn() {
    const fb = await getFirebaseAuth();
    if (!fb.auth) {
      const demo = prompt("Enter your Gmail (must match the login inside the Android app):", email || "you@gmail.com");
      if (demo && demo.includes("@")) {
        localStorage.setItem("ldg_email", demo.trim().toLowerCase());
        localStorage.setItem("ldg_auth", "demo");
        router.push("/dashboard");
      }
      return;
    }
    setLoading(true);
    try {
      const res = await fb.signIn();
      const mail = res.user?.email?.toLowerCase() || "";
      if (!mail) throw new Error("No email returned");
      localStorage.setItem("ldg_email", mail);
      localStorage.setItem("ldg_auth", "google");
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      alert("Google sign-in failed: " + (e.message || e));
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="nav">
        <div className="brand">
          <img src="/logo-thumb.png" alt="LIFE180%" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", marginRight: 8, verticalAlign: "middle" }} />
          <span className="grad-text">LIFE180%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Download APK Primary Navbar Button */}
          <a
            href="/LIFE180.apk"
            download="LIFE180.apk"
            className="btn btn-primary"
            style={{
              padding: "7px 14px",
              fontSize: 13,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "linear-gradient(135deg, #0284c7, #2563eb)",
              boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
            }}
          >
            <span>📥</span>
            <b>Download APK</b>
            <span style={{ fontSize: 11, opacity: 0.8 }}>(v1.3 Pro)</span>
          </a>
          <div className="user">
            {mode === "google" && <span className="pill online">🔐 Secured by Google</span>}
            {mode === "demo" && <span className="pill offline">demo login</span>}
            {mode === "checking" && <span className="muted">…</span>}
          </div>
        </div>
      </div>

      <div className="hero">
        <div>
          <h1>Lock, Ring, Spy-Cam, Audio Record or Shutdown your lost Android phone.</h1>
          <p className="muted" style={{ margin: "12px 0 20px", lineHeight: 1.6 }}>
            Sign in with the <b>same Google account</b> as your phone app, pick your device,
            and send a remote command — including a <b>brand-new lock PIN</b>, 30s ambient audio recording,
            live GPS tracking, and driving speed detection. No internet on the phone? Send an <b>SMS</b> instead —
            the app obeys instantly and reports back here.
          </p>

          {/* Download Banner Card */}
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              border: "1px solid #38bdf844",
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src="/logo-thumb.png" alt="LIFE180% Icon" style={{ width: 44, height: 44, borderRadius: 10 }} />
              <div>
                <div style={{ fontWeight: "bold", fontSize: 15, color: "#f8fafc" }}>
                  Get LIFE180% Android App
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  v1.3.0 Pro • 6.3 MB • Android 8.0 - 14 • Signed & Ready
                </div>
              </div>
            </div>
            <a
              href="/LIFE180.apk"
              download="LIFE180.apk"
              className="btn btn-primary"
              style={{
                padding: "9px 18px",
                fontSize: 14,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>📲</span>
              <span>Download APK</span>
            </a>
          </div>

          <form onSubmit={demoSignIn} className="card">
            <h2>🔐 Sign in</h2>
            {mode === "google" ? (
              <>
                <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
                  Real Google authentication is <b style={{ color: "#4ade80" }}>ON</b>. One tap below —
                  and you stay logged in <b>♾️ forever</b> on this browser.
                </p>
                <button className="btn btn-google" type="button" onClick={googleSignIn} disabled={loading}>
                  <span style={{ fontWeight: 900 }}>G</span> {loading ? "Opening Google…" : "Sign in with Google"}
                </button>
              </>
            ) : (
              <>
                <label className="lbl">GOOGLE / GMAIL ADDRESS (same as in the app)</label>
                <input className="input" type="email" placeholder="you@gmail.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-google" type="button" onClick={googleSignIn}>
                    <span style={{ fontWeight: 900 }}>G</span> Sign in with Google
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? "Signing in…" : "Continue →"}
                  </button>
                </div>
                <div className="kbd-note">
                  ⚠️ <b>Demo login</b> (works instantly, session remembered ♾️). To switch on{" "}
                  <b>real Google OAuth</b>: create a free Firebase project → enable Google sign-in →
                  paste 3 keys into Vercel env — full steps in <span className="code">CONNECT_SERVER_GUIDE.md</span>.
                </div>
              </>
            )}
          </form>
        </div>

        <div className="grid">
          <div className="card">
            <h2>📱 1. Install the Android app</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
              Tap <b>Download APK</b> above, install on your phone, sign in with this same Gmail, grant <b>Device Admin + SMS +
              Camera + Mic + Location</b>. Run the 🩺 checkup → aim for 14/14.
            </p>
          </div>
          <div className="card">
            <h2>💬 2. SMS / WhatsApp fallback</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
              From any phone, to your lost number:<br />
              <span className="code">LOCK MY DEVICE 1234</span><br />
              <span className="code">RECORD AUDIO 1234</span> → 30s mic clip 🎙️<br />
              <span className="code">LOCK MY DEVICE 1234 NEW PIN 5678</span> → new PIN!<br />
              <span className="muted">The phone executes + confirms back here & by SMS reply.</span>
            </p>
          </div>
          <div className="card">
            <h2>🌐 3. Command from here</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
              Lock with a <b>new PIN</b>, 30-day driving speed history, live tracking, ambient audio,
              spy selfies, motion alarm, call intercept. Internet commands arrive in seconds; SMS works even with mobile data OFF.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
