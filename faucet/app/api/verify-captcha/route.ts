import { NextRequest, NextResponse } from 'next/server';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export async function POST(request: NextRequest) {
  try {
    if (!RECAPTCHA_SECRET_KEY) {
      return NextResponse.json(
        { success: true, message: 'reCAPTCHA not configured, skipping verification' },
        { status: 200 }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing reCAPTCHA token' },
        { status: 400 }
      );
    }

    const verifyResponse = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    const data: RecaptchaResponse = await verifyResponse.json();

    if (!data.success) {
      console.error('reCAPTCHA verification failed:', data['error-codes']);
      return NextResponse.json(
        { success: false, error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }

    if (data.score !== undefined && data.score < MIN_SCORE) {
      console.warn(`Low reCAPTCHA score: ${data.score}`);
      return NextResponse.json(
        { success: false, error: 'Suspicious activity detected' },
        { status: 403 }
      );
    }

    if (data.action && data.action !== 'claim_tokens') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      score: data.score,
      action: data.action,
    });
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
