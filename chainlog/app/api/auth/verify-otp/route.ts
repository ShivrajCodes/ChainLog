import { NextRequest, NextResponse } from "next/server";
import { readLedger, writeLedger } from "@/lib/ledger";
import { verifyAndActivateUser } from "@/app/api/auth/[...nextauth]/route";

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 *
 * Validates the OTP against the store, checks expiry,
 * marks the user account as verified so they can sign in.
 */
export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();

  if (!email || !otp) {
    return NextResponse.json({ error: "email and otp are required" }, { status: 400 });
  }

  const ledger = await readLedger();
  const stored = ledger.otpStore?.[email];

  if (!stored) {
    return NextResponse.json({ error: "No OTP found for this email. Request a new code." }, { status: 400 });
  }

  if (Date.now() > stored.expiresAt) {
    // Clean up expired OTP
    delete ledger.otpStore[email];
    await writeLedger(ledger);
    return NextResponse.json({ error: "OTP has expired. Please request a new code." }, { status: 400 });
  }

  if (stored.otp !== otp.trim()) {
    return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
  }

  // Activate user
  await verifyAndActivateUser(email);

  // Clean up used OTP
  delete ledger.otpStore[email];
  await writeLedger(ledger);

  return NextResponse.json({ success: true, email, password: stored.password });
}