import { NextResponse } from "next/server";
import { getStore, updateStore, addLog } from "@/lib/store";

// POST /api/alert — phone raises an alert: { deviceId, type, detail, photoId? }
// types: SIM_CHANGED | WRONG_PIN | LOW_BATTERY | ...
export async function POST(req) {
  const body = await req.json();
  const { deviceId, type, detail } = body;
  if (!deviceId || !type) {
    return NextResponse.json({ error: "deviceId and type required" }, { status: 400 });
  }
  const store = getStore();
  const owner = (store.devices || []).find((x) => x.deviceId === deviceId)?.owner || "";
  const alert = {
    id: "al_" + Date.now(),
    deviceId,
    owner,
    type: String(type).toUpperCase(),
    detail: String(detail || "").slice(0, 500),
    photoId: body.photoId || "",
    ts: new Date().toISOString(),
  };
  updateStore((d) => {
    d.alerts = d.alerts || [];
    d.alerts.unshift(alert);
    d.alerts = d.alerts.slice(0, 100);
    return d;
  });
  addLog({ owner, msg: `🚨 ALERT ${alert.type} from ${deviceId}: ${alert.detail}`, level: "err" });
  return NextResponse.json({ ok: true });
}

// GET /api/alert?owner=email -> recent alerts
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "").toLowerCase();
  const store = getStore();
  const alerts = (store.alerts || []).filter((a) => !owner || a.owner === owner).slice(0, 30);
  return NextResponse.json({ alerts });
}
