import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  return NextResponse.json({
    adapter: "ICJS",
    mode: "MOCK",
    warning: "This is not a live ICJS integration.",
    caseId,
    payload: {
      icjsRef: `ICJS-MOCK-${caseId.slice(0, 8)}`,
      pillars: ["police", "forensics", "prosecution", "courts"],
    },
  });
}
