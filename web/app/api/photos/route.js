import { NextResponse } from "next/server";
import { getStore, updateStore, addLog } from "@/lib/store";
import fs from "fs";
import path from "path";

const MAX_B64 = 2_800_000; // ~2MB jpeg max

function photoDir() {
  let d;
  try {
    fs.accessSync("/tmp", fs.constants.W_OK);
    d = "/tmp/ldg-photos";
  } catch {
    d = path.join(process.cwd(), ".ldg-photos");
  }
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function ownerOf(deviceId) {
  const store = getStore();
  return (store.devices || []).find((x) => x.deviceId === deviceId)?.owner || "";
}

// POST /api/photos — phone uploads a captured photo
// body: { deviceId, camera: front|back, image: base64-jpeg, note? }
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { deviceId, camera, image, note } = body;
  if (!deviceId || !image) {
    return NextResponse.json({ error: "deviceId and image required" }, { status: 400 });
  }
  if (String(image).length > MAX_B64) {
    return NextResponse.json({ error: "photo too large (2MB max)" }, { status: 413 });
  }
  const id = "ph_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  try {
    const buf = Buffer.from(image, "base64");
    fs.writeFileSync(path.join(photoDir(), id + ".jpg"), buf);
    const meta = {
      id,
      deviceId,
      owner: ownerOf(deviceId),
      camera: camera === "back" ? "back" : "front",
      note: (note || "").slice(0, 120),
      ts: new Date().toISOString(),
      size: buf.length,
    };
    updateStore((d) => {
      d.photos = d.photos || [];
      d.photos.unshift(meta);
      d.photos = d.photos.slice(0, 100);
      return d;
    });
    addLog({ owner: meta.owner, msg: `📷 Photo from ${deviceId} (${meta.camera})${note ? " — " + note : ""}`, level: "ok" });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: "upload failed: " + e.message }, { status: 500 });
  }
}

// GET /api/photos?deviceId=xxx -> list metadata (newest first)
// GET /api/photos?id=ph_xxx      -> raw JPEG bytes
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const f = path.join(photoDir(), id.replace(/[^a-zA-Z0-9_]/g, "") + ".jpg");
    if (!fs.existsSync(f)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const buf = fs.readFileSync(f);
    return new Response(buf, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  }
  const deviceId = searchParams.get("deviceId") || "";
  const owner = (searchParams.get("owner") || "").toLowerCase();
  const store = getStore();
  let photos = store.photos || [];
  if (deviceId) photos = photos.filter((p) => p.deviceId === deviceId);
  if (owner) photos = photos.filter((p) => p.owner === owner);
  return NextResponse.json({ photos: photos.slice(0, 40) });
}
