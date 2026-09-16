import { NextResponse } from "next/server";
import { getStore, updateStore, addLog } from "@/lib/store";
import fs from "fs";
import path from "path";

const MAX_B64 = 8_000_000; // ~6MB max (30-60s AAC is ~300KB)

function audioDir() {
  let d;
  try {
    fs.accessSync("/tmp", fs.constants.W_OK);
    d = "/tmp/ldg-audio";
  } catch {
    d = path.join(process.cwd(), ".ldg-audio");
  }
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function ownerOf(deviceId) {
  const store = getStore();
  return (store.devices || []).find((x) => x.deviceId === deviceId)?.owner || "";
}

// POST /api/audio — phone uploads an ambient audio recording (base64 m4a/aac/mp4/3gp)
// body: { deviceId, durationSeconds, audio: base64, note? }
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { deviceId, durationSeconds, audio, note } = body;
  if (!deviceId || !audio) {
    return NextResponse.json({ error: "deviceId and audio required" }, { status: 400 });
  }
  if (String(audio).length > MAX_B64) {
    return NextResponse.json({ error: "audio too large (6MB max)" }, { status: 413 });
  }

  const id = "aud_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  try {
    const buf = Buffer.from(audio, "base64");
    fs.writeFileSync(path.join(audioDir(), id + ".m4a"), buf);

    const meta = {
      id,
      deviceId,
      owner: ownerOf(deviceId),
      durationSeconds: Number(durationSeconds || 15),
      note: (note || "Remote ambient audio").slice(0, 120),
      size: buf.length,
      ts: new Date().toISOString(),
    };

    updateStore((d) => {
      d.audioRecordings = d.audioRecordings || [];
      d.audioRecordings.unshift(meta);
      d.audioRecordings = d.audioRecordings.slice(0, 100);
      return d;
    });

    addLog({
      owner: meta.owner,
      msg: `🎙️ Audio recording (${meta.durationSeconds}s) received from ${deviceId}`,
      level: "ok",
    });

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: "upload failed: " + e.message }, { status: 500 });
  }
}

// GET /api/audio?id=aud_xxx      -> audio/mp4 stream
// GET /api/audio?deviceId=xxx     -> list metadata
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const f = path.join(audioDir(), id.replace(/[^a-zA-Z0-9_]/g, "") + ".m4a");
    if (!fs.existsSync(f)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const buf = fs.readFileSync(f);
    return new Response(buf, {
      headers: {
        "Content-Type": "audio/mp4",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const deviceId = searchParams.get("deviceId") || "";
  const owner = (searchParams.get("owner") || "").toLowerCase();
  const store = getStore();
  let list = store.audioRecordings || [];
  if (deviceId) list = list.filter((a) => a.deviceId === deviceId);
  if (owner) list = list.filter((a) => (a.owner || "").toLowerCase() === owner);

  return NextResponse.json({ recordings: list.slice(0, 50) });
}
