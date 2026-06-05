import { NextRequest, NextResponse } from 'next/server';
import { loginAndFetchMarks, closeBrowser } from '@/lib/scraper-puppeteer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usn, dobDay, dobMonth, dobYear, verificationType, digits } = body;

    if (!usn || !dobDay || !dobMonth || !dobYear || !verificationType || !digits || digits.length !== 4) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[API /login-full] Starting Puppeteer login for USN:', usn);

    const result = await loginAndFetchMarks(
      usn,
      dobDay,
      dobMonth,
      dobYear,
      verificationType,
      digits
    );

    console.log('[API /login-full] Result:', { success: result.success, coursesCount: result.courses?.length || 0 });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        profile: result.profile,
        courses: result.courses,
      });
    }

    return NextResponse.json(
      { success: false, message: result.message },
      { status: 401 }
    );
  } catch (error) {
    console.error('[API /login-full] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Cleanup on server shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await closeBrowser();
  });
  process.on('SIGINT', async () => {
    await closeBrowser();
  });
}
