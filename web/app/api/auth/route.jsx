import { NextResponse } from "next/server";
import { getStore, updateStore } from "@/lib/store";
import crypto from "crypto";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, provider = "google", deviceId } = body;
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  const sessionToken = "ses_" + crypto.randomBytes(24).toString("hex");

  const session = {
    token: sessionToken,
    email: cleanEmail,
    provider,
    deviceId: deviceId || "",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  updateStore((d) => {
    d.sessions = d.sessions || [];
    d.sessions.unshift(session);
    d.sessions = d.sessions.slice(0, 100);
    return d;
  });

  return NextResponse.json({
    ok: true,
    user: {
      email: cleanEmail,
      provider,
      sessionToken,
    },
    message: "Authenticated successfully with LIFE180% cloud server",
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const store = getStore();
  const session = (store.sessions || []).find((s) => s.token === token);

  if (!session) {
    return NextResponse.json({ authenticated: false, error: "Session expired or invalid" }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      provider: session.provider,
    },
  });
}
