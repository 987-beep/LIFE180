import { NextResponse } from "next/server";
import { getStore, updateStore } from "@/lib/store";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { owner, name, lat, lng, radius = 200, icon = "🏠" } = body;
  if (!owner || !name || lat === undefined || lng === undefined) {
    return NextResponse.json({ error: "owner, name, lat, lng required" }, { status: 400 });
  }

  const place = {
    id: "plc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    owner: owner.toLowerCase().trim(),
    name: name.slice(0, 40),
    lat: Number(lat),
    lng: Number(lng),
    radius: Number(radius),
    icon,
    createdAt: new Date().toISOString(),
  };

  updateStore((d) => {
    d.places = d.places || [];
    d.places.push(place);
    return d;
  });

  return NextResponse.json({ ok: true, place });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") || "").toLowerCase().trim();

  const store = getStore();
  let list = store.places || [];
  if (owner) {
    list = list.filter((p) => (p.owner || "").toLowerCase() === owner);
  }

  return NextResponse.json({ places: list });
}
