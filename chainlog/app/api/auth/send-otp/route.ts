import { NextRequest, NextResponse } from "next/server";
import * as nodemailer from "nodemailer";
import { readLedger, writeLedger } from "@/lib/ledger";
import { createUser } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "name, email, and password are required" },
      { status: 400 }
    );
  }

  try {
    await createUser(name, email, password);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (!msg.includes("already exists")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const ledger = await readLedger();
  ledger.otpStore[email] = { otp, expiresAt, name, password };
  await writeLedger(ledger);

  const smtpConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (smtpConfigured) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ??
        `"ChainLog" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your ChainLog verification code",
      html: `<h2>Your OTP: ${otp}</h2><p>Valid for 10 minutes</p>`,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true, otp });
}