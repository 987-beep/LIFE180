import { NextResponse } from "next/server";
import { getStore, updateStore, addLog } from "@/lib/store";

// POST /api/location — phone reports GPS: { deviceId, lat, lng, accuracy, battery, speed, altitude, bearing, provider }
// Speed is in m/s (from Android Location.getSpeed()), converted to km/h and mph for driving display.
export async function POST(req) {
  const body = await req.json();
  const { deviceId, lat, lng } = body;
  if (!deviceId || lat === undefined || lng === undefined) {
    return NextResponse.json({ error: "deviceId, lat, lng required" }, { status: 400 });
  }
  const store = getStore();
  const owner = (store.devices || []).find((x) => x.deviceId === deviceId)?.owner || "";

  // speed from phone is m/s
  const speedMs = Number(body.speed || 0);
  const speedKmh = Math.max(0, Math.round(speedMs * 3.6 * 10) / 10);
  const speedMph = Math.max(0, Math.round(speedMs * 2.23694 * 10) / 10);

  const entry = {
    id: "loc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    deviceId,
    owner,
    lat: Number(lat),
    lng: Number(lng),
    accuracy: Number(body.accuracy || 0),
    battery: body.battery === undefined ? null : Number(body.battery),
    speed: speedMs, // m/s
    speedKmh,
    speedMph,
    isDriving: speedKmh >= 15, // >15 km/h classified as driving/vehicle
    altitude: body.altitude !== undefined ? Number(body.altitude) : null,
    bearing: body.bearing !== undefined ? Number(body.bearing) : null,
    provider: body.provider || "gps",
    source: body.source || "periodic", // "live_track", "periodic", "locate_cmd", "low_batt"
    ts: new Date().toISOString(),
  };

  updateStore((d) => {
    d.locations = d.locations || [];
    d.locations.unshift(entry);
    // Keep up to 2000 points (30-day purge in store.js drops older)
    d.locations = d.locations.slice(0, 2000);
    return d;
  });

  const speedLabel = entry.isDriving ? ` 🚗 ${speedKmh} km/h` : (speedKmh > 3 ? ` 🚶 ${speedKmh} km/h` : "");
  addLog({
    owner,
    msg: `📍 [${entry.source}] ${deviceId}: ${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}${speedLabel} (🔋${entry.battery ?? "?"}%)`,
    level: "ok",
  });
  return NextResponse.json({ ok: true, id: entry.id });
}

// GET /api/location?owner=email&deviceId=xxx&days=30
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "").toLowerCase();
  const deviceId = searchParams.get("deviceId") || "";
  const store = getStore();

  let all = store.locations || [];
  if (owner) all = all.filter((l) => (l.owner || "").toLowerCase() === owner);
  if (deviceId) all = all.filter((l) => l.deviceId === deviceId);

  // Latest point per device
  const latest = {};
  for (const l of [...all].reverse()) {
    latest[l.deviceId] = l;
  }

  // Driving summary stats
  const drivingPoints = all.filter((l) => l.isDriving);
  const maxSpeedKmh = all.reduce((max, l) => Math.max(max, l.speedKmh || 0), 0);

  return NextResponse.json({
    latest,
    history: all.slice(0, 300),
    totalCount: all.length,
    drivingSummary: {
      drivingPointsCount: drivingPoints.length,
      maxSpeedKmh,
      maxSpeedMph: Math.round(maxSpeedKmh * 0.621371 * 10) / 10,
    },
  });
}
