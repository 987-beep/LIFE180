import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "LIFE180%",
    version: "1.3.0",
    serverTime: new Date().toISOString(),
    ready: true
  });
}
