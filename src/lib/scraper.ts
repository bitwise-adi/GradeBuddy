import * as cheerio from 'cheerio';
import { Course, StudentProfile, CIEComponent } from './types';

// ==============================
// Portal Scraper for Contineo
// ==============================

const BASE_URL = 'https://parents.nie.ac.in';
const LOGIN_URL = `${BASE_URL}/index.php`;

/**
 * Generate random alphanumeric characters.
 */
function randomAlphaNum(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Obfuscate the DOB password using the portal's algorithm.
 * The portal's submitLogin() function:
 * 1. Takes DOB as YYYY-MM-DD
 * 2. After each character, inserts 2 random alphanumeric chars
 * 3. Base64-encodes the result
 */
function obfuscatePassword(dob: string): string {
  let obfuscated = '';
  for (const char of dob) {
    obfuscated += char + randomAlphaNum(2);
  }
  return Buffer.from(obfuscated).toString('base64');
}

/**
 * Extract the Joomla CSRF token from HTML.
 * It's a hidden input with a 32-char hex name and value "1".
 */
function extractCSRFToken(html: string): string | null {
  const $ = cheerio.load(html);
  const token = $('input[type="hidden"]').filter(function () {
    const name = $(this).attr('name') || '';
    const value = $(this).attr('value') || '';
    return /^[a-f0-9]{32}$/.test(name) && value === '1';
  });

  if (token.length > 0) {
    return token.first().attr('name') || null;
  }
  return null;
}

/**
 * Extract cookies from Set-Cookie headers.
 */
function extractCookies(headers: Headers): string[] {
  const cookies: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      // Extract just the cookie name=value part
      const cookiePart = value.split(';')[0];
      cookies.push(cookiePart);
    }
  });
  return cookies;
}

/**
 * Merge cookies - new cookies override old ones with the same name.
 */
function mergeCookies(existing: string[], newCookies: string[]): string[] {
  const cookieMap = new Map<string, string>();
  for (const cookie of existing) {
    const [name] = cookie.split('=');
    cookieMap.set(name, cookie);
  }
  for (const cookie of newCookies) {
    const [name] = cookie.split('=');
    cookieMap.set(name, cookie);
  }
  return Array.from(cookieMap.values());
}

// ==============================
// Session Manager
// ==============================

interface ScraperSession {
  cookies: string[];
}

/**
 * Step 1: Login with USN + DOB.
 * Returns session cookies and whether OTP is required.
 */
export async function loginStep1(
  usn: string,
  dobDay: string,
  dobMonth: string,
  dobYear: string
): Promise<{ success: boolean; session: ScraperSession; message: string; html?: string }> {
  try {
    // 1. GET the login page to extract CSRF token
    const loginPageRes = await fetch(LOGIN_URL, {
      redirect: 'manual',
    });
    const loginPageHTML = await loginPageRes.text();
    let cookies = extractCookies(loginPageRes.headers);

    const csrfToken = extractCSRFToken(loginPageHTML);
    if (!csrfToken) {
      return { success: false, session: { cookies: [] }, message: 'Could not extract CSRF token from portal.' };
    }

    // 2. Format DOB and obfuscate
    const mm = dobMonth.padStart(2, '0');
    const dd = dobDay.padStart(2, '0');
    const dob = `${dobYear}-${mm}-${dd}`;
    const obfuscatedPasswd = obfuscatePassword(dob);

    // 3. Build form data
    const formData = new URLSearchParams();
    formData.append('username', usn);
    formData.append('passwd', obfuscatedPasswd);
    formData.append('dd', dd);
    formData.append('mm', mm);
    formData.append('yyyy', dobYear);
    formData.append('option', 'com_user');
    formData.append('task', 'loginOtp');
    formData.append('remember', 'No');
    formData.append('return', 'aW5kZXgucGhw');
    formData.append(csrfToken, '1');

    // 4. POST login
    const loginRes = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Referer': LOGIN_URL,
        'Origin': BASE_URL,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    const newCookies = extractCookies(loginRes.headers);
    cookies = mergeCookies(cookies, newCookies);

    // Follow redirect if any
    const redirectUrl = loginRes.headers.get('location');
    let responseHTML: string;

    if (redirectUrl) {
      const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${BASE_URL}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`;
      const redirectRes = await fetch(fullUrl, {
        headers: { 'Cookie': cookies.join('; ') },
        redirect: 'manual',
      });
      const moreCookies = extractCookies(redirectRes.headers);
      cookies = mergeCookies(cookies, moreCookies);
      responseHTML = await redirectRes.text();
    } else {
      responseHTML = await loginRes.text();
    }

    // Check if we landed on the OTP page
    if (responseHTML.includes('Select Verification Type') || responseHTML.includes('Enter Last 4 Digits')) {
      return {
        success: true,
        session: { cookies },
        message: 'Login successful. OTP verification required.',
        html: responseHTML,
      };
    }

    // Check for login failure
    if (responseHTML.includes('Login Failed') || responseHTML.includes('invalid username or password')) {
      return { success: false, session: { cookies: [] }, message: 'Invalid USN or Date of Birth.' };
    }

    // Might have logged in directly (rare)
    return {
      success: true,
      session: { cookies },
      message: 'Login successful.',
      html: responseHTML,
    };
  } catch (error) {
    return {
      success: false,
      session: { cookies: [] },
      message: `Login error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Step 2: Submit OTP/verification code.
 */
export async function loginStep2(
  session: ScraperSession,
  verificationType: string,
  digits: string[],
  otpPageHtml?: string
): Promise<{ success: boolean; session: ScraperSession; message: string; html?: string }> {
  try {
    // Extract CSRF token and hidden fields from the OTP page
    let csrfToken: string | null = null;
    let username = '';
    let passwd = '';
    
    if (otpPageHtml) {
      csrfToken = extractCSRFToken(otpPageHtml);
      const $ = cheerio.load(otpPageHtml);
      username = $('input[name="username"]').val() as string || '';
      passwd = $('input[name="passwd"]').val() as string || '';
    }

    // If we couldn't get it from the OTP page, fetch it again
    if (!csrfToken) {
      const pageRes = await fetch(LOGIN_URL, {
        headers: { 'Cookie': session.cookies.join('; ') },
      });
      const pageHTML = await pageRes.text();
      csrfToken = extractCSRFToken(pageHTML);
      const $ = cheerio.load(pageHTML);
      username = $('input[name="username"]').val() as string || '';
      passwd = $('input[name="passwd"]').val() as string || '';
    }

    // Map verification type to numeric ID
    const idTypeMap: Record<string, string> = {
      'father': '1',
      'mother': '2',
      'apaar': '5',
    };
    const idType = idTypeMap[verificationType] || '1';

    // Combine digits into single string
    const enteredId = digits.join('');

    // Build form data by extracting all hidden fields from the form
    const formData = new URLSearchParams();
    const $ = cheerio.load(otpPageHtml || '');
    
    // Default form data in case otpPageHtml is missing/empty
    if (!otpPageHtml) {
      formData.append('remember', 'No');
      formData.append('option', 'com_user');
      formData.append('task', 'login');
      formData.append('username', username);
      formData.append('passwd', passwd);
      formData.append('action', 'result_form');
      if (csrfToken) formData.append(csrfToken, '1');
    } else {
      $('form input[type="hidden"]').each(function() {
        const name = $(this).attr('name');
        const value = $(this).attr('value') || '';
        if (name) {
          formData.append(name, value);
        }
      });
    }

    // Set/Overwrite the OTP specific fields
    formData.set('idType', idType);
    formData.set('enteredid', enteredId);
    // Let it submit the parsed hidden inputs naturally

    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': session.cookies.join('; '),
        'Referer': LOGIN_URL,
        'Origin': BASE_URL,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    const newCookies = extractCookies(res.headers);
    const updatedCookies = mergeCookies(session.cookies, newCookies);

    const redirectUrl = res.headers.get('location');
    let responseHTML: string;

    if (redirectUrl) {
      const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${BASE_URL}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`;
      
      // Follow first redirect
      const redirectRes = await fetch(fullUrl, {
        headers: { 'Cookie': updatedCookies.join('; ') },
        redirect: 'manual',
      });
      const moreCookies = extractCookies(redirectRes.headers);
      let finalCookies = mergeCookies(updatedCookies, moreCookies);
      responseHTML = await redirectRes.text();
      
      // Check for additional redirects (portal might chain redirects)
      const secondRedirect = redirectRes.headers.get('location');
      if (secondRedirect) {
        const secondUrl = secondRedirect.startsWith('http') ? secondRedirect : `${BASE_URL}${secondRedirect.startsWith('/') ? '' : '/'}${secondRedirect}`;
        const secondRes = await fetch(secondUrl, {
          headers: { 'Cookie': finalCookies.join('; ') },
          redirect: 'manual',
        });
        const thirdCookies = extractCookies(secondRes.headers);
        finalCookies = mergeCookies(finalCookies, thirdCookies);
        responseHTML = await secondRes.text();
      }
      
      // Check if we're still on login page (session failed)
      if (responseHTML.includes('Login to Your Account') || responseHTML.includes('submitLogin')) {
        return {
          success: false,
          session: { cookies: finalCookies },
          message: 'Session authentication failed. You may have entered incorrect verification digits.',
        };
      }

      // Check for successful login indicators
      if (responseHTML.includes('Logout') || responseHTML.includes('com_studentdashboard')) {
        return {
          success: true,
          session: { cookies: finalCookies },
          message: 'OTP verified successfully.',
          html: responseHTML,
        };
      }
    } else {
      responseHTML = await res.text();
    }

    // Check if verification failed
    if (responseHTML.includes('Select Verification Type') || responseHTML.includes('Invalid') || responseHTML.includes('Login Failed')) {
      return {
        success: false,
        session: { cookies: updatedCookies },
        message: 'OTP verification failed. Please check your verification code.',
      };
    }
    
    // Check if we're on login page (not logged in)
    if (responseHTML.includes('Login to Your Account') || responseHTML.includes('submitLogin')) {
      return {
        success: false,
        session: { cookies: updatedCookies },
        message: 'Authentication failed. Session not established.',
      };
    }

    return {
      success: true,
      session: { cookies: updatedCookies },
      message: 'OTP verified successfully.',
      html: responseHTML,
    };
  } catch (error) {
    return {
      success: false,
      session: { cookies: session.cookies },
      message: `OTP verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Fetch student profile from the dashboard HTML.
 */
export function parseStudentProfile(html: string): StudentProfile | null {
  const $ = cheerio.load(html);

  // Try extracting profile info from various selectors
  const name = $('h4, .student-name, [class*="name"]').first().text().trim() ||
    $('body').text().match(/([A-Z][A-Z\s]+)\s+(?:B\.?E|M\.?Tech)/)?.[1]?.trim() || '';

  // Look for USN pattern (e.g., 4NI23IS251)
  const usnMatch = $('body').text().match(/(\d[A-Z]{2}\d{2}[A-Z]{2}\d{3})/);
  const usn = usnMatch ? usnMatch[1] : '';

  // Look for branch, semester, section
  const infoText = $('body').text();
  const branchMatch = infoText.match(/B\.?E[-\s]?(\w+)/);
  const semMatch = infoText.match(/SEM\s*(\d+)/i);
  const secMatch = infoText.match(/SEC\s*([A-Z])/i);

  return {
    name: name || 'Student',
    usn,
    branch: branchMatch ? `B.E-${branchMatch[1]}` : '',
    semester: semMatch ? `SEM ${semMatch[1]}` : '',
    section: secMatch ? `SEC ${secMatch[1]}` : '',
  };
}

/**
 * Fetch and parse the Student Registration page to get course credits.
 */
export async function fetchCourseRegistration(
  session: ScraperSession
): Promise<Map<string, { credits: number; nature: string }>> {
  const creditsMap = new Map<string, { credits: number; nature: string }>();

  try {
    // Navigate to Student Registration page
    const regUrl = `${LOGIN_URL}?option=com_studentdashboard&controller=studentdashboard&task=showreg`;
    const res = await fetch(regUrl, {
      headers: { 'Cookie': session.cookies.join('; ') },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // Parse the registration table
    $('table tr, .table tr, [class*="table"] tr').each(function () {
      const cells = $(this).find('td');
      if (cells.length >= 4) {
        const courseCode = $(cells[0]).text().trim();
        const credits = parseFloat($(cells[2]).text().trim()) || 0;
        const nature = $(cells[3]).text().trim();

        if (courseCode && /^[A-Z]/.test(courseCode)) {
          creditsMap.set(courseCode, { credits, nature });
        }
      }
    });
  } catch (error) {
    console.error('Error fetching course registration:', error);
  }

  return creditsMap;
}

/**
 * Fetch CIE marks for all courses.
 * The portal shows CIE data in a tabbed view accessible from the dashboard.
 */
export async function fetchCIEMarks(
  session: ScraperSession,
  dashboardHtml?: string
): Promise<Course[]> {
  const courses: Course[] = [];

  try {
    // First, get the dashboard if we don't have it
    let html = dashboardHtml;
    if (!html) {
      const res = await fetch(LOGIN_URL, {
        headers: { 'Cookie': session.cookies.join('; ') },
      });
      html = await res.text();
    }

    const $ = cheerio.load(html);
    const creditsMap = await fetchCourseRegistration(session);

    // Navigate to CIE page
    // The CIE button/link in the course table may use JavaScript
    // Try to find the CIE page URL pattern
    const cieUrl = `${LOGIN_URL}?option=com_studentdashboard&controller=studentdashboard&task=showcie`;
    const cieRes = await fetch(cieUrl, {
      headers: { 'Cookie': session.cookies.join('; ') },
    });
    const cieHtml = await cieRes.text();
    
    // Save CIE HTML for debugging (only in Node.js environment)
    const cie$ = cheerio.load(cieHtml);

    // Parse course tabs and CIE data
    // The CIE page has tabs with course codes
    const courseTabs = cie$('[role="tab"], .nav-tabs a, .nav-tabs li a, [data-toggle="tab"], [data-bs-toggle="tab"]');
    const tabPanels = cie$('[role="tabpanel"], .tab-pane');

    // If tabs are found, parse each
    if (courseTabs.length > 0) {
      courseTabs.each(function (index) {
        const courseCode = cie$(this).text().trim();
        if (!courseCode || !/^[A-Z]/.test(courseCode)) return;

        const panel = tabPanels.eq(index);
        const panelText = panel.text();

        // Extract CIE marks - look for "FINAL CIE MARKS OBTAINED: XX" or "Current CIE : XX/YY"
        const cieMatch = panelText.match(/(?:FINAL\s+CIE\s+MARKS?\s+OBTAINED|Current\s+CIE)\s*[:=]\s*(\d+)(?:\s*\/\s*(\d+))?/i);
        const cieMarks = cieMatch ? parseInt(cieMatch[1]) : 0;
        const cieMax = cieMatch && cieMatch[2] ? parseInt(cieMatch[2]) : 100;

        // Extract attendance
        const attMatch = panelText.match(/ATTENDANCE\s*[:=]\s*(\d+(?:\.\d+)?)\s*%/i);
        const attendance = attMatch ? parseFloat(attMatch[1]) : null;

        // Extract component breakdown
        const components: CIEComponent[] = [];
        const componentPattern = /(T\d|Q\d|IL\d|EL\d|CIE\d)\s*[:=]\s*(\d+|-)\s*(?:\/\s*(\d+))?/gi;
        let match;
        while ((match = componentPattern.exec(panelText)) !== null) {
          components.push({
            name: match[1],
            marksObtained: match[2] === '-' ? null : parseInt(match[2]),
            maxMarks: match[3] ? parseInt(match[3]) : null,
          });
        }

        const regInfo = creditsMap.get(courseCode);
        const credits = regInfo?.credits ?? 0;

        courses.push({
          courseCode,
          courseName: '', // Will try to get from course table
          credits,
          nature: regInfo?.nature ?? 'Core',
          cieMarks,
          cieMax,
          components,
          attendance,
          hasSEE: credits > 0,
        });
      });
    } else {
      // Try alternative: Look for course tables directly
      cie$('table tr').each(function () {
        const cells = cie$(this).find('td');
        if (cells.length >= 3) {
          const code = cie$(cells[0]).text().trim();
          if (code && /^[A-Z]/.test(code)) {
            const name = cie$(cells[1]).text().trim();
            const cieText = cie$(cells[2]).text().trim();
            const cieMatch = cieText.match(/(\d+)(?:\/(\d+))?/);
            
            if (cieMatch) {
              const regInfo = creditsMap.get(code);
              courses.push({
                courseCode: code,
                courseName: name,
                credits: regInfo?.credits ?? 0,
                nature: regInfo?.nature ?? 'Core',
                cieMarks: parseInt(cieMatch[1]),
                cieMax: cieMatch[2] ? parseInt(cieMatch[2]) : 100,
                components: [],
                attendance: null,
                hasSEE: (regInfo?.credits ?? 0) > 0,
              });
            }
          }
        }
      });
    }

    // Also try to get course names from the course list table
    cie$('table tr, .course-row').each(function () {
      const cells = cie$(this).find('td');
      if (cells.length >= 2) {
        const code = cie$(cells[0]).text().trim();
        const name = cie$(cells[1]).text().trim();
        const course = courses.find(c => c.courseCode === code);
        if (course && name) {
          course.courseName = name;
        }
      }
    });

    // If we still don't have course names, try from the dashboard course table
    $('table tr').each(function () {
      const cells = $(this).find('td');
      if (cells.length >= 2) {
        const code = $(cells[0]).text().trim();
        const name = $(cells[1]).text().trim();
        const course = courses.find(c => c.courseCode === code);
        if (course && name) {
          course.courseName = name;
        }
      }
    });

  } catch (error) {
    console.error('Error fetching CIE marks:', error);
  }

  return courses;
}
