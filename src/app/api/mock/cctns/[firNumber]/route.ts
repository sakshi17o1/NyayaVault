import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ firNumber: string }> },
) {
  const { firNumber } = await context.params;
  return NextResponse.json({
    adapter: "CCTNS",
    mode: "MOCK",
    warning: "This is not a live CCTNS integration.",
    firNumber,
    payload:
      firNumber === "FIR-FN-2026-4418"
        ? {
            firNumber,
            station: "PS Fictional Nagar",
            mockCaseRef: "WS-2026-0001",
            offenceHint: "Fictional street-harassment complaint (demo)",
          }
        : { firNumber, found: false },
  });
}
