import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { generateEspSignature } from "@/lib/signature";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized access to Gateway." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { docId, toDept, reason, otp } = body;

  if (!docId || !toDept || !reason || !otp) {
    return NextResponse.json({ error: "Missing required signature parameters." }, { status: 400 });
  }

  // In a real system, the ESP would verify the Aadhaar OTP against UIDAI here.
  // For the simulation, any 6-digit OTP is accepted.
  if (otp.length !== 6) {
    return NextResponse.json({ error: "Invalid OTP format." }, { status: 400 });
  }

  try {
    // Generate the cryptographically signed JWT representing the e-Sign payload
    const jwt = await generateEspSignature(user.id, docId, "CUSTODY_TRANSFER", toDept, reason);
    
    return NextResponse.json({ success: true, jwt });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to generate e-Sign certificate." }, { status: 500 });
  }
}
