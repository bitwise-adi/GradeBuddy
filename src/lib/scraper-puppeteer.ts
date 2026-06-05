import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { Course, StudentProfile, CIEComponent } from './types';

// ==============================
// Puppeteer-based Portal Scraper
// ==============================

const BASE_URL = 'https://parents.nie.ac.in';
const LOGIN_URL = `${BASE_URL}/index.php`;

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Complete login + marks fetch flow using Puppeteer.
 * Puppeteer is required because the OTP page uses reCAPTCHA v3
 * which needs a real browser to generate tokens.
 */
export async function loginAndFetchMarks(
  usn: string,
  dobDay: string,
  dobMonth: string,
  dobYear: string,
  verificationType: string,
  digits: string[]
): Promise<{ success: boolean; message: string; profile?: StudentProfile; courses?: Course[] }> {
  let page: Page | null = null;

  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // ========== STEP 1: LOGIN ==========
    console.log('[Scraper] Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // Fill USN
    const usnInput = await page.$('input[name="username"]');
    if (!usnInput) throw new Error('Could not find USN input field');
    await usnInput.evaluate((el: HTMLInputElement, v: string) => { el.value = v; }, usn.toUpperCase());

    // Fill DOB
    await page.select('select[name="dd"]', dobDay.padStart(2, '0'));
    await page.select('select[name="mm"]', dobMonth.padStart(2, '0'));
    await page.select('select[name="yyyy"]', dobYear);

    // Submit login (calls the portal's own submitLogin() which handles password obfuscation)
    console.log('[Scraper] Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (window as any).submitLogin === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).submitLogin();
        } else {
          (document.getElementById('login-form') as HTMLFormElement)?.submit();
        }
      }),
    ]);

    // Check if we landed on OTP page
    const pageContent = await page.content();
    if (pageContent.includes('Login Failed') || pageContent.includes('invalid username')) {
      return { success: false, message: 'Invalid USN or Date of Birth.' };
    }

    if (!pageContent.includes('combineDigits') && !pageContent.includes('Select Verification Type')) {
      return { success: false, message: 'Unexpected page after login. Could not reach OTP verification.' };
    }

    // ========== STEP 2: OTP VERIFICATION ==========
    console.log('[Scraper] On OTP page, filling verification...');

    // Map verification type to numeric ID
    const idTypeMap: Record<string, string> = {
      'father': '1',
      'mother': '2',
      'guardian': '5',
      'apaar': '5',
    };
    const idType = idTypeMap[verificationType] || '1';

    await page.select('select[name="idType"]', idType);

    // Fill digit inputs
    const digitInputs = await page.$$('.digit-input');
    if (digitInputs.length < 4) {
      return { success: false, message: 'Could not find digit input fields on OTP page.' };
    }

    for (let i = 0; i < 4 && i < digitInputs.length; i++) {
      await digitInputs[i].click();
      await digitInputs[i].type(digits[i]);
    }

    // Wait for reCAPTCHA v3 token to be generated (runs automatically on page load)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Call combineDigits() to populate the hidden enteredid field
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (window as any).combineDigits === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).combineDigits();
      }
    });

    // Submit OTP form
    console.log('[Scraper] Submitting OTP form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.click('input[type="submit"]'),
    ]);

    // Check if login succeeded
    const currentUrl = page.url();
    const dashHtml = await page.content();

    if (!currentUrl.includes('dashboard') || dashHtml.includes('Login to Your Account')) {
      return { success: false, message: 'OTP verification failed. Please check your verification digits.' };
    }

    console.log('[Scraper] Successfully logged in!');

    // ========== STEP 3: EXTRACT DASHBOARD DATA ==========
    const $ = cheerio.load(dashHtml);

    // Extract course list from the dashboard table
    const courseEntries: Array<{ code: string; name: string; cieHref: string }> = [];

    $('table tr').each(function () {
      const cells = $(this).find('td');
      if (cells.length >= 3) {
        const code = $(cells.eq(0)).text().trim();
        const name = $(cells.eq(1)).text().trim();

        if (code && /^[A-Z0-9]/.test(code) && code.length > 3) {
          // Find CIE link in this row
          const cieLink = $(this).find('a').filter(function () {
            return $(this).attr('href')?.includes('ciedetails') || false;
          }).attr('href');

          courseEntries.push({
            code,
            name,
            cieHref: cieLink || '',
          });
        }
      }
    });

    console.log(`[Scraper] Found ${courseEntries.length} courses on dashboard`);

    // ========== STEP 4: FETCH REGISTRATION DETAILS (for credits) ==========
    const creditsMap = new Map<string, { credits: number; nature: string }>();

    try {
      console.log('[Scraper] Fetching registration details...');

      // Click the Registration Details link
      const regClicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const regLink = links.find(a =>
          a.textContent?.includes('Registration Details') ||
          a.href?.includes('getcoursedetails') ||
          a.href?.includes('showreg')
        );
        if (regLink) {
          regLink.click();
          return true;
        }
        return false;
      });

      if (regClicked) {
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));

        const regHtml = await page.content();
        if (!regHtml.includes('Login to Your Account')) {
          const reg$ = cheerio.load(regHtml);
          reg$('table tr').each(function () {
            const cells = reg$(this).find('td');
            if (cells.length >= 4) {
              const courseCode = reg$(cells.eq(0)).text().trim();
              const credits = parseFloat(reg$(cells.eq(2)).text().trim()) || 0;
              const nature = reg$(cells.eq(3)).text().trim();

              if (courseCode && /^[A-Z]/.test(courseCode)) {
                creditsMap.set(courseCode, { credits, nature });
              }
            }
          });
          console.log(`[Scraper] Found credits for ${creditsMap.size} courses`);
        }

        // Navigate back to dashboard
        await page.goBack({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
      }
    } catch (err) {
      console.log('[Scraper] Could not fetch registration details:', err instanceof Error ? err.message : err);
    }

    // ========== STEP 5: FETCH CIE MARKS FOR EACH COURSE ==========
    const courses: Course[] = [];

    for (let i = 0; i < courseEntries.length; i++) {
      const entry = courseEntries[i];

      if (!entry.cieHref) {
        // No CIE link — add course with 0 marks
        const regInfo = creditsMap.get(entry.code);
        courses.push({
          courseCode: entry.code,
          courseName: entry.name,
          credits: regInfo?.credits ?? 0,
          nature: regInfo?.nature ?? 'Core',
          cieMarks: 0,
          cieMax: 100,
          components: [],
          attendance: null,
          hasSEE: (regInfo?.credits ?? 0) > 0,
        });
        continue;
      }

      console.log(`[Scraper] Fetching CIE ${i + 1}/${courseEntries.length}: ${entry.code}...`);

      // Retry logic for navigation timeouts
      let success = false;
      for (let attempt = 0; attempt < 2 && !success; attempt++) {
        try {
          const fullHref = entry.cieHref.startsWith('http')
            ? entry.cieHref
            : `${BASE_URL}/${entry.cieHref}`;

          // Click the CIE link within the page context
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
            page.evaluate((linkHref) => {
              const link = document.querySelector(`a[href="${linkHref}"]`) ||
                Array.from(document.querySelectorAll('a')).find(a => a.href === linkHref);
              if (link) {
                (link as HTMLAnchorElement).click();
              } else {
                window.location.href = linkHref;
              }
            }, attempt === 0 ? entry.cieHref : fullHref),
          ]);

          const cieHtml = await page.content();

          if (cieHtml.includes('Login to Your Account')) {
            console.log(`  [${entry.code}] Session expired`);
            break;
          }

          // Parse CIE data from the page
          const cieData = parseCIEPage(cieHtml, entry.code, entry.name, creditsMap);
          courses.push(cieData);
          success = true;

          console.log(`  [${entry.code}] CIE: ${cieData.cieMarks}/${cieData.cieMax}, Attendance: ${cieData.attendance}%`);

          // Navigate back to dashboard for the next course
          await page.goBack({ waitUntil: 'networkidle0', timeout: 10000 }).catch(async () => {
            // If goBack fails, try navigating to dashboard directly
            if (page) {
              await page.goto(
                `${LOGIN_URL}?option=com_studentdashboard&controller=studentdashboard&task=dashboard`,
                { waitUntil: 'networkidle0', timeout: 10000 }
              ).catch(() => {});
            }
          });

        } catch (err) {
          console.log(`  [${entry.code}] Attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err);

          if (attempt === 1) {
            // After retries, add course with 0 marks
            const regInfo = creditsMap.get(entry.code);
            courses.push({
              courseCode: entry.code,
              courseName: entry.name,
              credits: regInfo?.credits ?? 0,
              nature: regInfo?.nature ?? 'Core',
              cieMarks: 0,
              cieMax: 100,
              components: [],
              attendance: null,
              hasSEE: (regInfo?.credits ?? 0) > 0,
            });
          }
        }
      }
    }

    // Build profile
    const profile: StudentProfile = {
      name: '', // Portal shows proctor name, not student name
      usn: usn.toUpperCase(),
      branch: '',
      semester: '',
      section: '',
    };

    // Try to extract semester info from dashboard
    const bodyText = $('body').text();
    const semMatch = bodyText.match(/SEM\s*(\d+)/i) || bodyText.match(/Semester\s*:\s*(\d+)/i);
    if (semMatch) profile.semester = `SEM ${semMatch[1]}`;

    console.log(`[Scraper] Successfully fetched ${courses.length} courses`);

    return {
      success: true,
      message: `Fetched ${courses.length} courses successfully.`,
      profile,
      courses,
    };

  } catch (error) {
    console.error('[Scraper] Error:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Parse a CIE details page to extract marks, attendance, and components.
 *
 * The CIE page has tables in this format:
 *   Table 0 (marks): "T1 : - | T2 : - | Q1 : - | Q2 : - | IL1 : - | Current CIE : 85/100 | ATTENDANCE : 86%"
 *   Table 1 (chart): course name repeated
 *   Table 2 (chart): course name repeated
 */
function parseCIEPage(
  html: string,
  courseCode: string,
  courseName: string,
  creditsMap: Map<string, { credits: number; nature: string }>
): Course {
  const $ = cheerio.load(html);
  const pageText = $('body').text();

  // Extract CIE marks: "Current CIE : XX" or "Current CIE : XX/YY"
  const cieMatch = pageText.match(/Current\s+CIE\s*:\s*(\d+)(?:\s*\/\s*(\d+))?/i);
  const cieMarks = cieMatch ? parseInt(cieMatch[1]) : 0;
  const cieMax = cieMatch && cieMatch[2] ? parseInt(cieMatch[2]) : 100;

  // Extract attendance: "ATTENDANCE : XX%"
  const attMatch = pageText.match(/ATTENDANCE\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
  const attendance = attMatch ? parseFloat(attMatch[1]) : null;

  // Extract component breakdown from the marks table (Table 0)
  const components: CIEComponent[] = [];
  const componentPattern = /([A-Za-z]+\d*)\s*:\s*(\d+|Abscent|-)/g;
  let match;

  // Only parse from the first table's text to avoid duplicates
  const firstTable = $('table').first();
  const tableText = firstTable.text();

  while ((match = componentPattern.exec(tableText)) !== null) {
    const name = match[1];
    const value = match[2];

    // Skip "Current CIE" and "ATTENDANCE" — those aren't components
    if (name.toLowerCase().includes('current') || name.toLowerCase().includes('attendance')) continue;

    components.push({
      name: name.toUpperCase(),
      marksObtained: value === '-' || value === 'Abscent' ? null : parseInt(value),
      maxMarks: null,
    });
  }

  // Get credits from registration data
  const regInfo = creditsMap.get(courseCode);
  const credits = regInfo?.credits ?? 0;

  return {
    courseCode,
    courseName,
    credits,
    nature: regInfo?.nature ?? 'Core',
    cieMarks,
    cieMax,
    components,
    attendance,
    hasSEE: credits > 0,
  };
}
