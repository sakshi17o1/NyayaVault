import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    adapter: "e-Forensics",
    mode: "MOCK",
    warning: "This is not a live e-Forensics integration.",
    accepted: true,
  });
}
