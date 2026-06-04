import { NextRequest, NextResponse } from 'next/server';
import { fetchCIEMarks, parseStudentProfile } from '@/lib/scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionData, dashboardHtml } = body;

    if (!sessionData) {
      return NextResponse.json(
        { success: false, message: 'No session data provided.' },
        { status: 400 }
      );
    }

    // Decode session
    const session = JSON.parse(Buffer.from(sessionData, 'base64').toString());
    const decodedDashboardHtml = dashboardHtml
      ? Buffer.from(dashboardHtml, 'base64').toString()
      : undefined;

    // Parse student profile from dashboard HTML
    const profile = decodedDashboardHtml
      ? parseStudentProfile(decodedDashboardHtml)
      : null;

    // Fetch CIE marks
    const courses = await fetchCIEMarks(session, decodedDashboardHtml);

    return NextResponse.json({
      success: true,
      message: 'Marks fetched successfully.',
      profile,
      courses,
    });
  } catch (error) {
    console.error('Marks fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error while fetching marks.' },
      { status: 500 }
    );
  }
}
