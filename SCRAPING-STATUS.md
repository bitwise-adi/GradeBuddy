# Scraping Status & Testing Guide

## What I Fixed

### 1. **OTP Submission Form** (Step 2 Login)
The main issue was that the OTP form structure didn't match the portal's expectations:

**Before:**
- Used `task=loginOtpcheck`
- Sent individual fields: `otp1`, `otp2`, `otp3`, `otp4`
- Used `otpType` field

**After (Fixed):**
- Uses `task=login` (matching portal's form)
- Combines digits into single `enteredid` field
- Uses `idType` with numeric values (1=Father, 2=Mother, 5=Guardian/APAAR)
- Includes username and passwd from OTP page as hidden fields

### 2. **Form Field Mapping**
```javascript
// Verification type mapping
'father' → idType = '1'
'mother' → idType = '2' 
'apaar'  → idType = '5'
```

### 3. **Better Success Detection**
Added checks for successful login indicators:
- "Logout" button
- "Dashboard" text
- "Welcome" message

## How to Test

### Manual Testing Steps

1. **Start the dev server:**
   ```cmd
   npm run dev
   ```

2. **Open browser**: Go to http://localhost:3000

3. **Enter credentials**:
   - USN: Your college USN (e.g., 4NI23IS251)
   - DOB: Your date of birth

4. **Select verification type**:
   - Father's Phone Last 4 Digits
   - Mother's Phone Last 4 Digits  
   - APAAR ID Last 4 Digits

5. **Enter the last 4 digits**

6. **Check browser console** (F12) for any errors

7. **Check the dashboard** - Should show your courses and CIE marks

### What Might Still Need Work

#### 1. **CIE Data Scraping** (`fetchCIEMarks` function)
The current implementation tries to scrape from:
```
index.php?option=com_studentdashboard&controller=studentdashboard&task=showcie
```

**You need to:**
- Log in successfully
- Save the actual CIE page HTML to a file
- Share it with me so I can update the parsing logic
- The portal might use:
  - Tabbed interface
  - JavaScript-loaded content
  - AJAX requests
  - Different URL structure

**To capture the CIE page HTML:**
1. Log in to the portal manually
2. Navigate to the CIE/marks page
3. Right-click → "View Page Source" or Ctrl+U
4. Save as `cie-data-actual.html` in the project root
5. Share with me

#### 2. **Course Names & Credits**
The scraper tries to fetch from:
```
index.php?option=com_studentdashboard&controller=studentdashboard&task=showreg
```

If this doesn't work, we need the actual Student Registration page HTML.

#### 3. **Session Management**
If the portal expires sessions quickly or requires:
- Session refresh
- Anti-CSRF tokens on every request
- Cookies with specific attributes

We may need to add session keepalive logic.

## Test Script

To test just the scraper logic without the full UI, update `test-full-scraper.ts`:

```typescript
import { loginStep1, loginStep2, fetchCIEMarks } from './src/lib/scraper.js';
import * as fs from 'fs';

async function main() {
  console.log("Testing Contineo scraper...\n");

  // Replace with your credentials
  const usn = "YOUR_USN";
  const dobDay = "DD";
  const dobMonth = "MM";
  const dobYear = "YYYY";
  const verificationType = "father"; // or "mother" or "apaar"
  const digits = ["1", "2", "3", "4"]; // Replace with actual last 4 digits

  // Step 1: Login
  console.log("Step 1: Logging in with USN and DOB...");
  const step1 = await loginStep1(usn, dobDay, dobMonth, dobYear);
  console.log("Step 1 Result:", step1.message);
  
  if (!step1.success) {
    console.error("Login failed!");
    return;
  }

  // Save OTP page for debugging
  if (step1.html) {
    fs.writeFileSync('otp-page-debug.html', step1.html);
    console.log("Saved OTP page to otp-page-debug.html");
  }

  // Step 2: OTP verification
  console.log("\nStep 2: Submitting OTP...");
  const step2 = await loginStep2(step1.session, verificationType, digits, step1.html);
  console.log("Step 2 Result:", step2.message);

  if (!step2.success) {
    console.error("OTP verification failed!");
    return;
  }

  // Save dashboard for debugging
  if (step2.html) {
    fs.writeFileSync('dashboard-debug.html', step2.html);
    console.log("Saved dashboard to dashboard-debug.html");
  }

  // Step 3: Fetch marks
  console.log("\nStep 3: Fetching CIE marks...");
  const courses = await fetchCIEMarks(step2.session, step2.html);
  console.log("Courses found:", courses.length);
  console.log(JSON.stringify(courses, null, 2));
}

main().catch(console.error);
```

Run with:
```cmd
npx tsx test-full-scraper.ts
```

## Debugging Tips

1. **Check the HTML files** saved during testing:
   - `otp-page-debug.html` - OTP form structure
   - `dashboard-debug.html` - Post-login page
   - Compare with actual portal

2. **Browser DevTools**:
   - Network tab → See actual requests
   - Headers → Check cookies, CSRF tokens
   - Response → See server responses

3. **Common Issues**:
   - Wrong verification type/digits → Login fails at step 2
   - Session expired → Need to re-login
   - CORS issues → Should not happen (server-side fetch)
   - Rate limiting → Wait between attempts

## Next Steps After Testing

1. **If OTP works but marks don't load**:
   - Share the `dashboard-debug.html` with me
   - I'll update the `fetchCIEMarks` function

2. **If OTP fails**:
   - Check the `otp-page-debug.html` structure
   - Verify the form fields match

3. **If everything works**:
   - Test with multiple students
   - Add error handling for edge cases
   - Add loading states in UI
