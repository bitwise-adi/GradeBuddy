import { NextRequest, NextResponse } from 'next/server';
import { loginStep1 } from '@/lib/scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usn, dobDay, dobMonth, dobYear } = body;

    if (!usn || !dobDay || !dobMonth || !dobYear) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: usn, dobDay, dobMonth, dobYear' },
        { status: 400 }
      );
    }

    const result = await loginStep1(usn, dobDay, dobMonth, dobYear);

    if (result.success) {
      // Store session in a cookie or return it
      return NextResponse.json({
        success: true,
        message: result.message,
        requiresOTP: true,
        // Send session data back (encrypted in production)
        sessionData: Buffer.from(JSON.stringify(result.session)).toString('base64'),
        otpPageHtml: result.html ? Buffer.from(result.html).toString('base64') : undefined,
      });
    }

    return NextResponse.json(
      { success: false, message: result.message },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during login.' },
      { status: 500 }
    );
  }
}
