import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    adapter: "e-Prosecution",
    mode: "MOCK",
    warning: "This is not a live e-Prosecution integration.",
    accepted: true,
  });
}
