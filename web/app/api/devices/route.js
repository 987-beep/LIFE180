import { NextResponse } from "next/server";
import { getStore, updateStore } from "@/lib/store";

// GET /api/devices?owner=email -> list my devices
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "").toLowerCase();
  const store = getStore();
  const devices = (store.devices || []).filter((d) => !owner || d.owner === owner);
  return NextResponse.json({ devices });
}

// POST /api/devices -> register / heartbeat from Android app
// body: { deviceId, owner, model, phoneNumber, fcmToken, pin }
// The Android app calls this on login + every 60s (also used for polling fallback).
export async function POST(req) {
  const body = await req.json();
  const { deviceId, owner } = body;
  if (!deviceId || !owner) {
    return NextResponse.json({ error: "deviceId and owner required" }, { status: 400 });
  }
  const norm = {
    deviceId,
    owner: String(owner).toLowerCase(),
    model: body.model || "Android",
    phoneNumber: body.phoneNumber || "",
    fcmToken: body.fcmToken || "",
    lastSeen: new Date().toISOString(),
  };
  const store = updateStore((d) => {
    d.devices = d.devices || [];
    const i = d.devices.findIndex((x) => x.deviceId === deviceId);
    if (i >= 0) d.devices[i] = { ...d.devices[i], ...norm };
    else d.devices.push(norm);
    return d;
  });
  // Also return any pending command for this device (polling delivery)
  const pending = (store.commands || []).filter(
    (c) => c.deviceId === deviceId && c.status === "pending"
  );
  return NextResponse.json({ ok: true, pending });
}
