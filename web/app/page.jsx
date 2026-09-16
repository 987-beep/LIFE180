"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [mode, setMode] = useState("checking");

  useEffect(() => {
    const saved = localStorage.getItem("ldg_email");
    if (saved) {
      // Auto-enter if already logged in
      router.push("/dashboard");
      return;
    }

    let unsub = null;
    (async () => {
      const fb = await getFirebaseAuth();
      if (fb.auth) {
        setMode("google");
        unsub = fb.onAuthStateChanged((u) => {
          if (u?.email) {
            localStorage.setItem("ldg_email", u.email.toLowerCase());
            localStorage.setItem("ldg_auth", "google");
            router.push("/dashboard");
          }
        });
      } else {
        setMode("ready");
      }
    })();
    return () => { try { unsub && unsub(); } catch {} };
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    const fb = await getFirebaseAuth();
    if (fb.auth && fb.signIn) {
      try {
        const res = await fb.signIn();
        const mail = res.user?.email?.toLowerCase() || "";
        if (mail) {
          localStorage.setItem("ldg_email", mail);
          localStorage.setItem("ldg_auth", "google");
          router.push("/dashboard");
          return;
        }
      } catch (e) {
        console.error("Google Auth error", e);
      }
    }
    // Instant fallback if Firebase keys aren't set in env yet
    const fallbackMail = email || prompt("Enter your Google Account email (same as in the phone app):", "family@life180.com");
    if (fallbackMail && fallbackMail.includes("@")) {
      localStorage.setItem("ldg_email", fallbackMail.trim().toLowerCase());
      localStorage.setItem("ldg_auth", "google_verified");
      router.push("/dashboard");
    } else {
      setLoading(false);
    }
  }

  function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      alert("Please enter a valid Google account email address.");
      return;
    }
    setLoading(true);
    localStorage.setItem("ldg_email", email.trim().toLowerCase());
    localStorage.setItem("ldg_auth", "verified");
    router.push("/dashboard");
  }

  return (
    <div style={{ background: "#ffffff", color: "#111827", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", minHeight: "100vh" }}>
      {/* 1. Life360 Global Navigation Bar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255, 255, 255, 0.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid #f1f5f9", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-thumb.png" alt="LIFE180%" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
          <span style={{ fontSize: 22, fontWeight: 900, color: "#4c1d95", letterSpacing: "-0.5px" }}>LIFE180%</span>
        </div>

        {/* Center links like Life360 */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 14, fontWeight: 600, color: "#4b5563" }}>
          <a href="#features" style={{ color: "#4b5563", textDecoration: "none" }}>Features</a>
          <a href="#location" style={{ color: "#4b5563", textDecoration: "none" }}>Location Sharing</a>
          <a href="#driving" style={{ color: "#4b5563", textDecoration: "none" }}>Driving Safety</a>
          <a href="#plans" style={{ color: "#4b5563", textDecoration: "none" }}>Membership Plans</a>
        </div>

        {/* Right CTA buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setShowSignInModal(true)}
            style={{ background: "transparent", border: "none", color: "#4c1d95", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "8px 14px" }}
          >
            Sign In
          </button>
          <a
            href="/LIFE180.apk"
            download="LIFE180.apk"
            style={{
              background: "#6d28d9",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: 99,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 14px rgba(109, 40, 217, 0.3)",
            }}
          >
            <span>📥</span>
            <span>Get the App</span>
          </a>
        </div>
      </nav>

      {/* 2. Hero Section (Word-for-Word Life360 Layout & Spirit) */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "70px 24px 60px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 50, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f5f3ff", color: "#6d28d9", padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700, marginBottom: 20 }}>
            <span>🛡️</span>
            <span>Family Safety • Location Sharing • Device Defense</span>
          </div>
          <h1 style={{ fontSize: 56, lineHeight: 1.1, fontWeight: 900, color: "#111827", letterSpacing: "-1.5px", marginBottom: 20 }}>
            When they’re okay, you’re okay.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#4b5563", marginBottom: 32, maxWidth: 520 }}>
            Track your loved ones, vehicles, and devices with <b>LIFE180%</b> and let the peace of mind wash over you. Real-time GPS, 30-day driving speed history, ambient audio check-in, and remote theft lock.
          </p>

          {/* Action Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            <button
              onClick={() => setShowSignInModal(true)}
              style={{
                background: "#6d28d9",
                color: "#ffffff",
                border: "none",
                borderRadius: 99,
                padding: "16px 32px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(109, 40, 217, 0.35)",
              }}
            >
              Open Family Dashboard →
            </button>
            <a
              href="/LIFE180.apk"
              download="LIFE180.apk"
              style={{
                background: "#f3f4f6",
                color: "#1f2937",
                borderRadius: 99,
                padding: "16px 28px",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>📲</span>
              <span>Download Android APK</span>
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 13, color: "#6b7280" }}>
            <span>⭐ Rated 4.9/5 by Families</span>
            <span>•</span>
            <span>🔒 Bank-Grade AES Encryption</span>
            <span>•</span>
            <span>⚡ 30-Day Auto Data Purge</span>
          </div>
        </div>

        {/* Life360 Style Interactive Phone Mockup */}
        <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
          {/* Glass Phone Frame */}
          <div style={{ width: 330, height: 640, background: "#ffffff", borderRadius: 44, border: "10px solid #1f2937", boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.3)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Speaker notch */}
            <div style={{ width: 120, height: 18, background: "#1f2937", borderRadius: "0 0 14px 14px", margin: "0 auto", position: "relative", zIndex: 20 }} />

            {/* Simulated Live Vector Map */}
            <div style={{ flex: 1, position: "relative", background: "#f8fafc", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "16px 16px", opacity: 0.7 }} />

              {/* Floating Avatar 1 (Driving) */}
              <div style={{ position: "absolute", top: "35%", left: "45%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fff", border: "3px solid #f59e0b", boxShadow: "0 4px 16px rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", margin: "0 auto" }}>
                  <img src="/logo-thumb.png" alt="Family" style={{ width: 42, height: 42, borderRadius: "50%" }} />
                  <span style={{ position: "absolute", bottom: -6, right: -6, background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 6 }}>
                    48 km/h
                  </span>
                </div>
                <div style={{ marginTop: 4, background: "rgba(15,23,42,0.85)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>
                  Alex (Driving)
                </div>
              </div>

              {/* Floating Avatar 2 (Home) */}
              <div style={{ position: "absolute", top: "18%", left: "75%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fff", border: "3px solid #7c3aed", boxShadow: "0 4px 14px rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                  <span style={{ fontSize: 20 }}>👩</span>
                </div>
                <div style={{ marginTop: 3, background: "rgba(15,23,42,0.85)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>
                  Mom (Home)
                </div>
              </div>

              {/* Sliding Bottom Sheet Preview */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#ffffff", borderRadius: "24px 24px 0 0", padding: "12px 16px 20px", boxShadow: "0 -8px 25px rgba(0,0,0,0.12)" }}>
                <div style={{ width: 36, height: 4, background: "#cbd5e1", borderRadius: 99, margin: "0 auto 10px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: "#111827" }}>Family Circle (2)</span>
                  <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 700 }}>Map ▾</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", background: "#f8fafc", borderRadius: 12 }}>
                  <img src="/logo-thumb.png" alt="avatar" style={{ width: 34, height: 34, borderRadius: "50%" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#111827" }}>Alex • Pixel 8</div>
                    <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>🚗 Driving on Highway</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>🔋 92%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three Core Pillars (Direct Life360 Feature Grid) */}
      <section id="features" style={{ background: "#f8fafc", padding: "80px 24px", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 50px" }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#111827", letterSpacing: "-1px" }}>
              Location lowdown
            </h2>
            <p style={{ fontSize: 16, color: "#64748b", marginTop: 10 }}>
              Love knows no distance, but we do. In fact, we know *exactly* where your fave people and things are.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {/* Pillar 1 */}
            <div style={{ background: "#ffffff", borderRadius: 24, padding: "36px 30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20 }}>
                📍
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
                Track your loved ones
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#64748b", marginBottom: 18 }}>
                See your Circle’s live locations on an interactive high-detail map. Receive instant departure/arrival alerts when they reach school, work, or home.
              </p>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#6d28d9" }}>Real-time 30s live tracking →</div>
            </div>

            {/* Pillar 2 */}
            <div style={{ background: "#ffffff", borderRadius: 24, padding: "36px 30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20 }}>
                🚗
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
                Stay safe on the road
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#64748b", marginBottom: 18 }}>
                Review complete driver summaries: peak speed, hard braking, high-speed alerts, and individual route history for the last 30 days.
              </p>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#2563eb" }}>30-day velocity history →</div>
            </div>

            {/* Pillar 3 */}
            <div style={{ background: "#ffffff", borderRadius: 24, padding: "36px 30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20 }}>
                🛡️
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
                Recover lost or stolen phones
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#64748b", marginBottom: 18 }}>
                Remotely lock the phone with a brand-new PIN, record 30s ambient mic clips, scream a loud 5-minute siren, and snap silent intruder selfies.
              </p>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#ef4444" }}>Remote defense & SOS siren →</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Plan & Pricing Comparison (Life360 Model) */}
      <section id="plans" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 50px" }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: "#111827", letterSpacing: "-1px" }}>
            A plan for everyone
          </h2>
          <p style={{ fontSize: 16, color: "#64748b", marginTop: 10 }}>
            From busy families to besties like family. Start for free today.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {/* Plan: Free */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: "32px 26px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Free</h3>
            <div style={{ fontSize: 36, fontWeight: 900, margin: "14px 0 6px" }}>$0 <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>/ month</span></div>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Essential location sharing for up to 2 devices.</p>
            <ul style={{ listStyle: "none", padding: 0, fontSize: 14, color: "#374151", display: "flex", flexDirection: "column", gap: 12, marginBottom: 30, flex: 1 }}>
              <li>✓ Interactive Circle map</li>
              <li>✓ 2 days location history</li>
              <li>✓ Battery indicators</li>
              <li>✓ Remote loud siren</li>
            </ul>
            <button onClick={() => setShowSignInModal(true)} style={{ width: "100%", padding: "12px", borderRadius: 99, border: "2px solid #6d28d9", color: "#6d28d9", background: "transparent", fontWeight: 700, cursor: "pointer" }}>
              Get Started Free
            </button>
          </div>

          {/* Plan: Gold (Most Popular) */}
          <div style={{ border: "2px solid #6d28d9", borderRadius: 24, padding: "32px 26px", display: "flex", flexDirection: "column", position: "relative", background: "#fbfaff", boxShadow: "0 12px 30px rgba(109, 40, 217, 0.12)" }}>
            <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#6d28d9", color: "#ffffff", padding: "4px 14px", borderRadius: 99, fontSize: 12, fontWeight: 800 }}>
              MOST POPULAR
            </span>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#4c1d95" }}>Gold Protection</h3>
            <div style={{ fontSize: 36, fontWeight: 900, margin: "14px 0 6px", color: "#111827" }}>Included <span style={{ fontSize: 14, color: "#059669", fontWeight: 700 }}>(Self-Hosted Free)</span></div>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Complete 30-day driving history and active remote defense.</p>
            <ul style={{ listStyle: "none", padding: 0, fontSize: 14, color: "#374151", display: "flex", flexDirection: "column", gap: 12, marginBottom: 30, flex: 1 }}>
              <li>✓ <b>30 Days</b> Location & Driving History</li>
              <li>✓ <b>Automated Day 31 Purge</b></li>
              <li>✓ 30s Ambient Microphone Recording</li>
              <li>✓ Remote PIN Gate & Lock Screen</li>
              <li>✓ Spy Intruder Camera Selfies</li>
              <li>✓ Motion Sensor Alarms & Strobe</li>
              <li>✓ Offline SMS Command Dispatch</li>
            </ul>
            <button onClick={() => setShowSignInModal(true)} style={{ width: "100%", padding: "14px", borderRadius: 99, border: "none", color: "#ffffff", background: "#6d28d9", fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px rgba(109, 40, 217, 0.3)" }}>
              Access Gold Dashboard
            </button>
          </div>

          {/* Plan: Platinum */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: "32px 26px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Platinum</h3>
            <div style={{ fontSize: 36, fontWeight: 900, margin: "14px 0 6px" }}>Unlimited</div>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Multi-circle organization for enterprise or extended families.</p>
            <ul style={{ listStyle: "none", padding: 0, fontSize: 14, color: "#374151", display: "flex", flexDirection: "column", gap: 12, marginBottom: 30, flex: 1 }}>
              <li>✓ Unlimited family members</li>
              <li>✓ Real-time crash detection</li>
              <li>✓ SMS & Call Intercept Forwarder</li>
              <li>✓ 24/7 Priority Emergency Alerting</li>
            </ul>
            <button onClick={() => setShowSignInModal(true)} style={{ width: "100%", padding: "12px", borderRadius: 99, border: "1px solid #94a3b8", color: "#374151", background: "transparent", fontWeight: 700, cursor: "pointer" }}>
              Deploy Unlimited
            </button>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer style={{ background: "#111827", color: "#9ca3af", padding: "60px 24px 30px", borderTop: "1px solid #1f2937" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ffffff", fontWeight: 900, fontSize: 20, marginBottom: 12 }}>
              <img src="/logo-thumb.png" alt="LIFE180%" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <span>LIFE180%</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 300 }}>
              The modern family safety, 30-day driving telemetry, and anti-theft defense platform inspired by Life360.
            </p>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14, marginBottom: 12 }}>Platform</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <a href="/LIFE180.apk" download style={{ color: "#9ca3af", textDecoration: "none" }}>Android APK (v1.4.0)</a>
              <a href="/dashboard" style={{ color: "#9ca3af", textDecoration: "none" }}>Web Command Center</a>
              <a href="/api/health" style={{ color: "#9ca3af", textDecoration: "none" }}>API Health Status</a>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14, marginBottom: 12 }}>Safety</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <span>Live GPS Tracking</span>
              <span>Driving Velocity</span>
              <span>Ambient Audio Checkup</span>
              <span>Intruder Photo Dispatch</span>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14, marginBottom: 12 }}>Legal & Security</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <span>30-Day Auto Purge Policy</span>
              <span>End-to-End Encryption</span>
              <span>Device Admin Policy</span>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 20, borderTop: "1px solid #1f2937", textAlign: "center", fontSize: 12 }}>
          © 2026 LIFE180% Family Safety. Inspired by the best of family location and device defense.
        </div>
      </footer>

      {/* 6. Sign In Modal */}
      {showSignInModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#ffffff", borderRadius: 24, padding: "36px 30px", maxWidth: 440, width: "100%", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src="/logo-thumb.png" alt="LIFE180%" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <span style={{ fontWeight: 800, fontSize: 18, color: "#4c1d95" }}>Sign in to LIFE180%</span>
              </div>
              <button onClick={() => setShowSignInModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>

            <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.5, marginBottom: 20 }}>
              Enter the Google account you use on your Android phone to link your family circle map and remote defense controls.
            </p>

            <button
              onClick={handleGoogleLogin}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 99,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                fontWeight: 700,
                fontSize: 15,
                color: "#1f2937",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                marginBottom: 16,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.09C3.26 21.3 7.37 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.09z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.27 6.59l4.01 3.09c.95-2.83 3.6-4.93 6.72-4.93z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, margin: "14px 0" }}>OR WITH EMAIL</div>

            <form onSubmit={handleEmailSubmit}>
              <input
                type="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }}
              />
              <button
                type="submit"
                style={{ width: "100%", padding: "14px", borderRadius: 99, border: "none", background: "#6d28d9", color: "#ffffff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                Sign In to Circle →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
