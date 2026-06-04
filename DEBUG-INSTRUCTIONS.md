# Debugging "Loading your courses..." Issue

You're stuck at "Loading your courses..." which means:
- ✅ Login Step 1 worked (USN + DOB)
- ✅ OTP verification worked
- ❌ Course fetching returned empty array

## Quick Debug Steps

### 1. Open Browser Console
Press **F12** to open Developer Tools, then click the **Console** tab.

Look for these messages:
```
✓ Marks data received: {...}
  Courses: 0
  Profile: {...}
```

If you see `Courses: 0`, it means the scraping didn't find any course data.

### 2. Check Network Tab
In Developer Tools, click the **Network** tab:
1. Look for the `/api/marks` request
2. Click on it
3. Look at the **Response** tab
4. You should see JSON with `courses: []`

### 3. Check Application Storage
In Developer Tools, click the **Application** tab:
1. Expand **Session Storage** → `http://localhost:3000`
2. Check `gradebuddy_courses` value
3. If it's `[]` (empty array), the scraping failed

## What to Share with Me

Please open the browser console (F12) and look for these files in the project directory:
- `dashboard-debug.html` (created during login)
- `cie-page-fetched.html` (created when fetching marks)

**Share these files with me so I can fix the scraping logic!**

## Quick Workaround

While we debug the scraping, you can test the app with manual entry:

1. Go back to home page
2. Click **"Enter marks manually instead"**
3. Add your courses manually
4. Test the GPA calculator and simulator features

## What's Happening

The authentication is working perfectly! The issue is that the CIE page structure doesn't match what the scraper expects. Once you share the HTML files, I can update the parser to correctly extract your course data.

## How to Get the HTML Files

### Option 1: From Terminal Output
If you ran the test script (`npx tsx test-full-scraper.ts`), check the project folder for:
- `dashboard-debug.html`
- `cie-page-fetched.html`
- `courses-debug.json`

### Option 2: From API
Add this temporary code to check what HTML we're getting:

1. Open browser console (F12)
2. Paste this code and press Enter:

```javascript
// Check what's in sessionStorage
console.log('Courses:', JSON.parse(sessionStorage.getItem('gradebuddy_courses') || '[]'));
console.log('Profile:', JSON.parse(sessionStorage.getItem('gradebuddy_profile') || 'null'));
```

If courses is empty `[]`, then the scraper needs adjustment.

### Option 3: Check Server Logs
If you're running `npm run dev`, check the terminal for log messages like:
```
[fetchCIEMarks] Loaded dashboard HTML, length: XXXX
[fetchCIEMarks] CIE page loaded, length: XXXX
[fetchCIEMarks] Found X course tabs
[fetchCIEMarks] Successfully parsed X courses
```

This will tell us where the scraping is failing.

## Most Likely Issue

The portal's CIE page probably has a different structure than expected. The scraper is looking for:
- Tabbed interface with course codes
- Tables with course data
- Specific HTML selectors

But your portal might use:
- Different HTML structure
- JavaScript-rendered content
- AJAX-loaded data
- Different CSS classes

**Solution:** Share the `cie-page-fetched.html` file and I'll update the parser!
