import { NextResponse } from "next/server";
import { updateStore, addLog } from "@/lib/store";

// GET /api/poll?deviceId=xxx -> Android app long-polls for pending commands
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  let pending = [];
  updateStore((d) => {
    d.commands = d.commands || [];
    pending = d.commands.filter((c) => c.deviceId === deviceId && c.status === "pending");
    // mark delivered (app confirms execution via /api/poll POST ack)
    pending.forEach((p) => { p.status = "delivered"; p.deliveredAt = new Date().toISOString(); });
    const now = new Date().toISOString();
    const dev = (d.devices || []).find((x) => x.deviceId === deviceId);
    if (dev) dev.lastSeen = now;
    return d;
  });
  return NextResponse.json({ commands: pending });
}

// POST /api/poll -> ack from Android: { commandId, deviceId, result: executed|failed, detail? }
export async function POST(req) {
  const body = await req.json();
  const { commandId, result, detail } = body;
  if (!commandId) return NextResponse.json({ error: "commandId required" }, { status: 400 });
  updateStore((d) => {
    const c = (d.commands || []).find((x) => x.id === commandId);
    if (c) {
      c.status = result === "executed" ? "executed" : "failed";
      c.resultDetail = detail || "";
      c.executedAt = new Date().toISOString();
    }
    return d;
  });
  addLog({
    owner: "",
    msg: `📱 Device ack ${commandId}: ${result}${detail ? " — " + detail : ""}`,
    level: result === "executed" ? "ok" : "err",
  });
  return NextResponse.json({ ok: true });
}
