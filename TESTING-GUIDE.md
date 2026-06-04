# GradeBuddy Testing Guide

## Quick Start

I've fixed the main issue with the OTP/verification form submission. Here's how to test:

### Option 1: Test via the Web Interface

1. **Start the development server:**
   ```cmd
   npm run dev
   ```

2. **Open your browser** to: http://localhost:3000

3. **Enter your credentials:**
   - USN (e.g., 4NI23IS251)
   - Date of Birth (day, month, year)

4. **Select verification type** and enter last 4 digits:
   - Father's Phone Last 4 Digits
   - Mother's Phone Last 4 Digits
   - APAAR ID Last 4 Digits

5. **Watch the browser console** (F12 → Console tab) for any errors

### Option 2: Test via Command Line

1. **Edit `test-full-scraper.ts`** with your credentials (lines 7-12)

2. **Run the test:**
   ```cmd
   npx tsx test-full-scraper.ts
   ```

3. **Check the output** - it will save debug files:
   - `otp-page-debug.html` - The OTP verification page
   - `dashboard-debug.html` - The page after login (if successful)
   - `courses-debug.json` - Scraped course data (if found)

## What I Fixed

### Main Issue: OTP Form Structure
The portal expects the OTP form to be submitted differently than what the code was doing:

**What was wrong:**
```javascript
// OLD - Incorrect form structure
formData.append('task', 'loginOtpcheck');
formData.append('otpType', verificationType);
formData.append('otp1', digits[0]);
formData.append('otp2', digits[1]);
formData.append('otp3', digits[2]);
formData.append('otp4', digits[3]);
```

**What I fixed:**
```javascript
// NEW - Correct form structure (matching portal)
formData.append('task', 'login');
formData.append('idType', '1'); // 1=Father, 2=Mother, 5=APAAR
formData.append('enteredid', '1234'); // Combined digits
formData.append('username', usn);
formData.append('passwd', obfuscatedDOB);
```

This matches the actual form structure in the portal's HTML (see `otp-page-raw.html`).

## What to Do Next

### If Login/OTP Works ✅
Great! Now we need to check if the CIE marks are being scraped correctly.

**After a successful login:**
1. Check if courses show up in the dashboard
2. If not, share the `dashboard-debug.html` file with me
3. I'll update the scraping logic to match the actual HTML structure

### If OTP Fails ❌
If the OTP verification still fails:

1. **Check the error message** in the console/output
2. **Share these files with me:**
   - `otp-page-debug.html`
   - `otp-failed.html` (if generated)
3. **Try manually:**
   - Log in to https://parents.nie.ac.in manually
   - Compare the form structure with what we're sending

### If CIE Marks Don't Load ⚠️
The `fetchCIEMarks` function needs the actual HTML structure of the CIE page.

**To help me fix this:**
1. Log in to the portal manually
2. Navigate to the CIE/marks section
3. Right-click → "View Page Source" (or Ctrl+U)
4. Save it as `cie-page-actual.html`
5. Share it with me

## Common Issues

### Issue: "Invalid USN or Date of Birth"
- Double-check your credentials
- Make sure the DOB format is correct
- Try logging in manually to verify

### Issue: "OTP verification failed"
- Verify you're using the correct last 4 digits
- Make sure the verification type matches (father/mother/apaar)
- Check if the portal has changed its form structure

### Issue: "No courses found"
- This likely means the CIE scraping logic needs adjustment
- Share the `dashboard-debug.html` file
- I'll update the parsing to match your portal's structure

### Issue: Network errors
- Check your internet connection
- Portal might be down or under maintenance
- Try accessing https://parents.nie.ac.in manually

## Files Overview

- `src/lib/scraper.ts` - Main scraping logic (I updated this)
- `src/app/api/auth/login/route.ts` - API endpoint for login
- `src/app/api/auth/verify/route.ts` - API endpoint for OTP verification
- `src/app/api/marks/route.ts` - API endpoint for fetching marks
- `test-full-scraper.ts` - Command-line test script
- `SCRAPING-STATUS.md` - Detailed technical documentation

## Need Help?

If something doesn't work, provide:
1. The error message
2. The generated debug files (HTML files)
3. What step failed (login, OTP, or marks fetching)

I'll help you fix it!
