# GradeBuddy 🎓

**Know exactly what you need to score.** Plan your grades, ace your semester.

Built for **NIE (National Institute of Engineering)** students using the VTU grading system.

## Features

- **📚 Course Entry** — Add your courses with CIE marks, credits, and max marks
- **📊 Grade Calculator** — See exactly how many marks you need in SEE to hit each grade target (O, A+, A, B, C, P)
- **🎯 GPA Simulator** — Select expected grades per course and see your predicted SGPA in real-time
- **📈 Course Overview** — Visual cards with progress rings showing your CIE performance

## How It Works

1. Enter your courses (course code, name, credits, CIE marks)
2. View the **Grade Calculator** tab to see required SEE marks for each grade
3. Use the **GPA Simulator** to plan your target SGPA

### Grade Scale (VTU)

| Grade | GPA | Marks Range |
|-------|-----|-------------|
| O     | 10  | 90 – 100    |
| A+    | 9   | 80 – 89     |
| A     | 8   | 70 – 79     |
| B     | 7   | 60 – 69     |
| C     | 6   | 50 – 59     |
| P     | 5   | 40 – 49     |
| F     | 0   | 0 – 39      |

## Tech Stack

- **Next.js 16** with App Router
- **React 19**
- **Framer Motion** for animations
- **Lucide React** for icons
- Vanilla CSS with glassmorphism design

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start using GradeBuddy.

## Branches

- **`master`** — Manual entry mode (stable, deployed)
- **`portal-fetch`** — Experimental auto-fetch from Contineo portal (work in progress)

## License

MIT
