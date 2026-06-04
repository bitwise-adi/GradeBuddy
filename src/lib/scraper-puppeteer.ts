import puppeteer, { Browser, Page } from 'puppeteer';
import { Course, StudentProfile, CIEComponent } from './types';

const BASE_URL = 'https://parents.nie.ac.in/parentsodd';
const LOGIN_URL = `${BASE_URL}/index.php`;

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
 * Complete login flow using Puppeteer (handles reCAPTCHA)
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
    const browser = await getBrowser();
    page = await browser.newPage();

    // Navigate to login page
    console.log('[Puppeteer] Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle0' });

    // Wait for form to load
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in USN - try multiple possible selectors
    const usnFilled = await page.evaluate((usn) => {
      const selectors = [
        'input[name="username"]',
        'input[placeholder="USN"]',
        'input#username',
        'input.uk-input[type="text"]'
      ];
      
      for (const selector of selectors) {
        const input = document.querySelector(selector);
        if (input && input instanceof HTMLInputElement) {
          input.value = usn;
          return true;
        }
      }
      return false;
    }, usn);

    if (!usnFilled) {
      throw new Error('Could not find USN input field');
    }

    // Fill in DOB - select elements
    await page.select('select[name="dd"]', dobDay.padStart(2, '0'));
    await page.select('select[name="mm"]', dobMonth.padStart(2, '0'));
    await page.select('select[name="yyyy"]', dobYear);

    // Submit login form (this will trigger reCAPTCHA and redirect to OTP page)
    console.log('[Puppeteer] Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('input[type="submit"]'),
    ]);

    // Check if we're on OTP page
    const pageContent = await page.content();
    if (!pageContent.includes('Select Verification Type')) {
      return {
        success: false,
        message: 'Login failed. Could not reach OTP page.',
      };
    }

    console.log('[Puppeteer] On OTP page, filling verification form...');

    // Map verification type
    const idTypeMap: Record<string, string> = {
      'father': '1',
      'mother': '2',
      'apaar': '5',
    };
    const idType = idTypeMap[verificationType] || '1';

    // Select verification type
    await page.select('select[name="idType"]', idType);

    // Fill in the 4 digits
    const digitInputs = await page.$$('.digit-input');
    for (let i = 0; i < 4 && i < digitInputs.length; i++) {
      await digitInputs[i].type(digits[i]);
    }

    // Submit OTP form
    console.log('[Puppeteer] Submitting OTP form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
      page.click('input[type="submit"]'),
    ]);

    // Check if login was successful by looking for the actual dashboard elements
    const dashboardContent = await page.content();
    
    // Look for logout button or navigation menu which appears after successful login
    const isLoggedIn = dashboardContent.includes('LOGOUT') || 
                       dashboardContent.includes('HOME') && dashboardContent.includes('PROCTORSHIP') ||
                       dashboardContent.includes('Last Updated On');
    
    if (!isLoggedIn || dashboardContent.includes('Login to Your Account') || dashboardContent.includes('Login Failed')) {
      // Save the failed page for debugging
      if (typeof process !== 'undefined') {
        const fs = await import('fs');
        fs.writeFileSync('puppeteer-login-failed.html', dashboardContent);
      }
      
      return {
        success: false,
        message: 'OTP verification failed. Please check your verification digits.',
      };
    }

    console.log('[Puppeteer] Successfully logged in! Dashboard loaded.');

    // Extract and log cookies to ensure session is maintained
    const cookies = await page.cookies();
    console.log('[Puppeteer] Session has', cookies.length, 'cookies');

    // Wait a bit for any JavaScript to finish
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Navigate to Student Registration to get credits
    console.log('[Puppeteer] Fetching course registration...');
    
    // Try clicking the REGISTRATION menu link instead of direct navigation
    const registrationClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const regLink = links.find(a => a.textContent?.includes('REGISTRATION') || a.href?.includes('showreg'));
      if (regLink) {
        regLink.click();
        return true;
      }
      return false;
    });

    if (registrationClicked) {
      console.log('[Puppeteer] Clicked REGISTRATION link');
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      // Fallback to direct navigation
      console.log('[Puppeteer] REGISTRATION link not found, navigating directly');
      const regUrl = `${LOGIN_URL}?option=com_studentdashboard&controller=studentdashboard&task=showreg`;
      await page.goto(regUrl, { waitUntil: 'networkidle0' });
    }

    const creditsMap = new Map<string, { credits: number; nature: string }>();
    const regHtml = await page.content();
    
    // Save for debugging
    if (typeof process !== 'undefined') {
      const fs = await import('fs');
      fs.writeFileSync('puppeteer-registration.html', regHtml);
      console.log('[Puppeteer] Saved registration page for debugging');
    }
    
    // Parse registration data (simplified - would need actual selectors)
    // For now, we'll extract from tables
    const registrationData = await page.$$eval('table tr', rows => {
      return rows.slice(1).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          return {
            code: cells[0]?.textContent?.trim() || '',
            credits: parseFloat(cells[2]?.textContent?.trim() || '0'),
            nature: cells[3]?.textContent?.trim() || 'Core',
          };
        }
        return null;
      }).filter(Boolean);
    });

    registrationData.forEach((data: any) => {
      if (data && data.code) {
        creditsMap.set(data.code, { credits: data.credits, nature: data.nature });
      }
    });

    console.log('[Puppeteer] Found', creditsMap.size, 'courses in registration');

    // Navigate to CIE page
    console.log('[Puppeteer] Fetching CIE marks...');
    const cieUrl = `${LOGIN_URL}?option=com_studentdashboard&controller=studentdashboard&task=showcie`;
    await page.goto(cieUrl, { waitUntil: 'networkidle0' });

    // Save for debugging
    const cieHtml = await page.content();
    if (typeof process !== 'undefined') {
      const fs = await import('fs');
      fs.writeFileSync('puppeteer-cie-page.html', cieHtml);
      console.log('[Puppeteer] Saved CIE page for debugging');
    }

    // Wait for course tabs to load
    await page.waitForSelector('[role="tab"], .nav-tabs a, a[href^="#"]', { timeout: 5000 }).catch(() => null);

    const courses: Course[] = [];

    // Get all course tabs
    const courseTabs = await page.$$('[role="tab"], .nav-tabs a, a[href^="#course"]');
    console.log('[Puppeteer] Found', courseTabs.length, 'course tabs');

    for (const tab of courseTabs) {
      // Click the tab
      await tab.click();
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for content to load

      // Get course code from tab
      const courseCode = await tab.evaluate(el => el.textContent?.trim() || '');
      if (!courseCode || !/^[A-Z]/.test(courseCode)) continue;

      console.log('[Puppeteer] Processing course:', courseCode);

      // Get the active tab panel content
      const panelContent = await page.$eval('[role="tabpanel"].active, .tab-pane.active', el => el.textContent || '').catch(() => '');

      // Extract CIE marks
      const cieMatch = panelContent.match(/(?:FINAL\s+CIE\s+MARKS?\s+OBTAINED|Current\s+CIE)\s*[:=]\s*(\d+)(?:\s*\/\s*(\d+))?/i);
      const cieMarks = cieMatch ? parseInt(cieMatch[1]) : 0;
      const cieMax = cieMatch && cieMatch[2] ? parseInt(cieMatch[2]) : 100;

      // Extract attendance
      const attMatch = panelContent.match(/ATTENDANCE\s*[:=]\s*(\d+(?:\.\d+)?)\s*%/i);
      const attendance = attMatch ? parseFloat(attMatch[1]) : null;

      // Extract component breakdown
      const components: CIEComponent[] = [];
      const componentPattern = /(T\d|Q\d|IL\d|EL\d|CIE\d)\s*[:=]\s*(\d+|-)\s*(?:\/\s*(\d+))?/gi;
      let match;
      while ((match = componentPattern.exec(panelContent)) !== null) {
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
        courseName: '', // Will get from table
        credits,
        nature: regInfo?.nature ?? 'Core',
        cieMarks,
        cieMax,
        components,
        attendance,
        hasSEE: credits > 0,
      });
    }

    // Try to get course names from the main table
    try {
      const courseNames = await page.$$eval('table tr', rows => {
        return rows.slice(1).map(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            return {
              code: cells[0]?.textContent?.trim() || '',
              name: cells[1]?.textContent?.trim() || '',
            };
          }
          return null;
        }).filter(Boolean);
      });

      courseNames.forEach((data: any) => {
        const course = courses.find(c => c.courseCode === data.code);
        if (course && data.name) {
          course.courseName = data.name;
        }
      });
    } catch (e) {
      console.log('[Puppeteer] Could not extract course names');
    }

    // Extract student profile
    const profile: StudentProfile = {
      name: 'Student',
      usn,
      branch: '',
      semester: '',
      section: '',
    };

    // Try to get profile info from page
    try {
      const profileText = await page.$eval('body', el => el.textContent || '');
      const nameMatch = profileText.match(/([A-Z][A-Z\s]+)\s+(?:B\.?E|M\.?Tech)/);
      if (nameMatch) profile.name = nameMatch[1].trim();

      const semMatch = profileText.match(/SEM\s*(\d+)/i);
      if (semMatch) profile.semester = `SEM ${semMatch[1]}`;
    } catch (e) {
      console.log('[Puppeteer] Could not extract profile');
    }

    console.log('[Puppeteer] Successfully fetched', courses.length, 'courses');

    return {
      success: true,
      message: 'Marks fetched successfully.',
      profile,
      courses,
    };
  } catch (error) {
    console.error('[Puppeteer] Error:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    if (page) {
      await page.close();
    }
  }
}
