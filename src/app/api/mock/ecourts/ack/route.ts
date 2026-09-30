import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    adapter: "e-Courts",
    mode: "MOCK",
    warning: "This is not a live e-Courts integration.",
    acknowledgement: {
      status: "ACCEPTED_MOCK",
      bundleId: "COURT-BUNDLE-DEMO-PENDING",
      message: "Court bundle export is implemented in Phase 5.",
    },
  });
}
