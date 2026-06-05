# 🎓 GradeBuddy

GradeBuddy is a modern, fast, and student-friendly dashboard built to track grades, calculate GPA, and monitor attendance securely. 

This branch (**`portal-fetch`**) contains the **Full Automated Scraping** version. It connects directly to the Contineo student portal, bypassing complex reCAPTCHAs, to automatically fetch your CIE marks, registration details, and attendance.

![GradeBuddy Dashboard Concept](https://img.shields.io/badge/GradeBuddy-Dashboard-blue?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Next.js](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=Puppeteer&logoColor=white)

---

## ✨ Features

- **🚀 One-Click Fetching**: Just enter your USN and DOB. GradeBuddy automatically logs into the portal and fetches your data.
- **🤖 Built-in reCAPTCHA Bypass**: Uses Puppeteer (headless Chromium) to generate native tokens, bypassing the portal's strict reCAPTCHA v3 verification during OTP submission.
- **⚡ Blazing Fast Extraction**: Uses in-browser `fetch()` calls executed in parallel batches to extract CIE marks and attendance in ~15 seconds instead of traditional sequential scraping.
- **📊 Beautiful Dashboard**: A premium, dark-mode focused UI that visualizes attendance, marks, and SGPA calculations.
- **🔒 Privacy First**: Your credentials are only used temporarily for the scraping session and are never stored on any database.
- **📝 Manual Mode Fallback**: Users can choose to enter their marks manually without providing portal credentials.

---

## 🏗️ Architecture & How It Works

GradeBuddy's `portal-fetch` branch operates using a hybrid server-side scraping approach:

1. **Authentication (Puppeteer)**: The Next.js API spins up a headless Chromium instance to navigate the login flow and naturally execute the portal's reCAPTCHA scripts, guaranteeing a valid session token.
2. **Data Extraction (In-Browser Fetch)**: Once authenticated, the browser instance executes parallel `fetch` requests using its active cookie jar to gather course registrations (credits/nature) and individual CIE marks.
3. **Session Closure**: After data is bundled into a clean JSON response, the browser instance is destroyed to save memory.
4. **State Management**: The React frontend receives the data and stores it in `sessionStorage` for snappy, persistent navigation without re-fetching.

---

## 🛠️ Local Development

To run GradeBuddy locally, you need Node.js installed.

1. **Clone the repository and switch to the `portal-fetch` branch**:
   ```bash
   git clone https://github.com/bitwise-adi/GradeBuddy.git
   cd GradeBuddy
   git checkout portal-fetch
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   *(Note: This will download a local version of Chromium for Puppeteer)*

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open the App**:
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Deployment

Because this branch uses Puppeteer, it requires a host that supports Docker/Container deployments (it **cannot** be deployed on Vercel).

We recommend **Render.com** (or Railway).

### Deploying to Render
1. Create a **New Web Service** on Render.
2. Connect this GitHub repository and select the **`portal-fetch`** branch.
3. Change the **Language/Runtime** to **Docker**.
4. Set the **Region** to **Singapore** (closest to the portal servers for lower latency).
5. Deploy using the **Free Instance Type**.

*The included `Dockerfile` is pre-configured to install system-level Chromium dependencies and map them correctly for Puppeteer.*

---

## 🌿 Branching Strategy

- **`portal-fetch` (Default/Main)**: The complete app including the server-side Puppeteer scraper. Requires Docker to deploy.
- **`master`**: A lightweight, purely frontend version where users must manually enter their marks. Deployed on Vercel.

---

## 📄 Disclaimer

GradeBuddy is an independent project built to improve the student experience. It is not affiliated with, maintained, or endorsed by the institute or Contineo. User data is not collected or stored.
