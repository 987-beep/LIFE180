import { NextResponse } from "next/server";
import { getStore, updateStore, addLog } from "@/lib/store";

// POST /api/forwarded — phone forwards incoming call or SMS metadata
// body: { deviceId, type: "SMS" | "CALL", from, body?, callType?, duration?, ts? }
export async function POST(req) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { deviceId, type, from } = data;
  if (!deviceId || !type || !from) {
    return NextResponse.json({ error: "deviceId, type, from required" }, { status: 400 });
  }

  const store = getStore();
  const owner = (store.devices || []).find((x) => x.deviceId === deviceId)?.owner || "";

  const entry = {
    id: "fwd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    deviceId,
    owner,
    type: type.toUpperCase(), // "SMS" or "CALL"
    from: String(from).slice(0, 40),
    body: (data.body || "").slice(0, 500),
    callType: data.callType || "INCOMING", // "INCOMING", "MISSED", "OFFHOOK"
    ts: new Date().toISOString(),
  };

  updateStore((d) => {
    d.forwarded = d.forwarded || [];
    d.forwarded.unshift(entry);
    d.forwarded = d.forwarded.slice(0, 500);
    return d;
  });

  const summary =
    entry.type === "SMS"
      ? `📩 Forwarded SMS from ${entry.from}: "${entry.body.slice(0, 60)}${entry.body.length > 60 ? "…" : ""}"`
      : `📞 Incoming call alert from ${entry.from} (${entry.callType})`;

  addLog({ owner, msg: summary, level: "ok" });

  return NextResponse.json({ ok: true, id: entry.id });
}

// GET /api/forwarded?owner=email&deviceId=xxx
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "").toLowerCase();
  const deviceId = searchParams.get("deviceId") || "";
  const store = getStore();

  let list = store.forwarded || [];
  if (owner) list = list.filter((x) => (x.owner || "").toLowerCase() === owner);
  if (deviceId) list = list.filter((x) => x.deviceId === deviceId);

  return NextResponse.json({ forwarded: list.slice(0, 100) });
}
