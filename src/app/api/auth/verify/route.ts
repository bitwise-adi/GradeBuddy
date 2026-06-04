import { NextRequest, NextResponse } from 'next/server';
import { loginStep2 } from '@/lib/scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionData, verificationType, digits, otpPageHtml } = body;

    if (!sessionData || !verificationType || !digits || digits.length !== 4) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields.' },
        { status: 400 }
      );
    }

    // Decode session
    const session = JSON.parse(Buffer.from(sessionData, 'base64').toString());
    const decodedOtpHtml = otpPageHtml
      ? Buffer.from(otpPageHtml, 'base64').toString()
      : undefined;

    const result = await loginStep2(session, verificationType, digits, decodedOtpHtml);

    console.log('[API /verify] OTP verification result:', {
      success: result.success,
      message: result.message,
      htmlLength: result.html?.length || 0,
      cookiesCount: result.session.cookies.length,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        sessionData: Buffer.from(JSON.stringify(result.session)).toString('base64'),
        dashboardHtml: result.html ? Buffer.from(result.html).toString('base64') : undefined,
      });
    }

    return NextResponse.json(
      { success: false, message: result.message },
      { status: 401 }
    );
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during verification.' },
      { status: 500 }
    );
  }
}
