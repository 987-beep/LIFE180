import { NextResponse } from "next/server";
import { updateStore, addLog } from "@/lib/store";

// POST /api/command -> queue a remote command from the website
// body: { owner, deviceId, type, message?, pin?, newPin? }
// newPin: LOCK/UNLOCK with a fresh owner PIN (4-8 digits recommended).
// The phone changes its gate PIN immediately and tries the system PIN too.
const TYPES = ["LOCK", "RING", "SHUTDOWN", "LOCATE", "WIPE", "UNLOCK", "STOP_RING", "FRONT_PHOTO", "BACK_PHOTO", "CHECK_STATUS"];

export async function POST(req) {
  const body = await req.json();
  const { owner, deviceId, type } = body;
  if (!owner || !deviceId || !type) {
    return NextResponse.json({ error: "owner, deviceId, type required" }, { status: 400 });
  }
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "unknown command type" }, { status: 400 });
  }
  const cmd = {
    id: "cmd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    owner: String(owner).toLowerCase(),
    deviceId,
    type,
    message: body.message || "",
    pin: body.pin || "",
    newPin: String(body.newPin || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 16),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  updateStore((d) => {
    d.commands = d.commands || [];
    d.commands.unshift(cmd);
    d.commands = d.commands.slice(0, 200);
    return d;
  });
  addLog({ owner: cmd.owner, msg: `🌐 Web → ${deviceId}: ${type}`, level: "info" });

  // TODO (production): also push via FCM using server key for instant delivery.
  // The Android app polls /api/poll every ~15s as a reliable fallback, so this
  // already works end-to-end without FCM. See README "Enable instant push".

  return NextResponse.json({ ok: true, command: cmd });
}

// GET /api/command?owner=email -> recent command history
export async function GET(req) {
  const { getStore } = await import("@/lib/store");
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "").toLowerCase();
  const store = getStore();
  const commands = (store.commands || []).filter((c) => !owner || c.owner === owner).slice(0, 30);
  const log = (store.log || []).slice(0, 50);
  return NextResponse.json({ commands, log });
}
