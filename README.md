4:6 Pour-Over Brewing Method Calculator

A tiny, mobile-friendly web app that helps you plan Tetsu Kasuya’s 4:6 pour-over method. Enter your coffee weight, choose Taste and Body preferences, and the app generates a clear, time-stamped pouring timeline.

Brewing method created by Tetsu Kasuya (2016 World Brewers Cup Champion).

⸻

Features
	•	Specs panel (single row) with icons for Coffee, Water, Water Temp, and Grind.
	•	Live calculation of total water (defaults to 1:15 ratio).
	•	Taste presets: Basic, Increase sweetness, Increase acidity.
	•	Body presets: Basic, Stronger, Lighter.
	•	Pouring Timeline (Start | Amount | % | Pour to), including a “Remove dripper” cue.
	•	Light/Dark theme toggle (persisted in localStorage).
	•	Accessible controls (aria-pressed, visible focus, aria-live updates).

⸻

Demo

If your repo is named 46brew and hosted with GitHub Pages:

https://<your-github-username>.github.io/46brew/

(Enable in Settings → Pages → Build and deployment → Deploy from a branch, then pick your default branch and / (root).)

⸻

Quick Start (Local)
	1.	Clone the repo and open the folder in VS Code.
	2.	Install the Live Server extension (Ritwick Dey).
	3.	Right-click index.html → Open with Live Server.
	4.	Start tweaking—changes hot-reload in your browser.

You don’t need Python or Node for this project.

⸻

Project Structure

.
├── index.html
├── assets/
│   ├── style.css
│   └── app.js
└── icons/
    └── favicon.svg

	•	index.html — markup, Specs panel, theme toggle, app sections
	•	assets/style.css — Apple HIG-inspired light theme by default, dark theme via [data-theme="dark"]
	•	assets/app.js — calculations, UI state, timeline rendering

⸻

How it Works

Inputs
	•	Coffee weight (g).
	•	Taste:
	•	Basic: P1 20%, P2 20%
	•	Increase sweetness: P1 15%, P2 25%
	•	Increase acidity: P1 25%, P2 15%
	•	Body:
	•	Basic: 3 pours at 20% each (P3 1:30, P4 2:15, P5 2:45)
	•	Stronger: 2 pours at 30% each (P3 1:30, P4 2:15)
	•	Lighter: 1 pour at 60% (P3 1:30)

Timing
	•	P1 start 0:00 (15s wetting).
	•	P2 start 0:45.
	•	Later pours start as noted above; the timeline shows start times only.
	•	“Remove dripper” reminder at 3:30.
	•	Totals are rounded to the nearest gram; last pour is adjusted so sum = total water.

Defaults
	•	Ratio 1:15 (water = coffee × 15).
	•	Theme Light. Theme, Taste, and Body persist via localStorage.

⸻

Customize

Open assets/app.js and tweak:

// Ratio
const DEFAULT_RATIO = 15;

// Remove-dripper cue (seconds)
const REMOVE_AT = 210; // 3:30

// Start times (seconds)
const P1_START = 0;                 // implicit
const P2_START = 45;                // 0:45
// Later pour starts are defined per Body in plan46()

// Percentages
// Taste (P1/P2): basic 20/20, sweet 15/25, acid 25/15
// Body (later pours): basic [20,20,20], stronger [30,30], lighter [60]

Styling
	•	Colors, spacing, and typography are in assets/style.css under the theme tokens.
	•	Specs grid: Water Temp uses the .spec--wide class to span two columns on desktop.
	•	Icons: Font Awesome Free (via CDN in index.html). Swap classes (e.g., fa-braille for Grind) as you prefer.

⸻

Accessibility & Design Notes
	•	Keyboard: Buttons have visible focus; aria-pressed reflects state.
	•	Announcements: The water result uses aria-live="polite".
	•	Contrast & spacing follow Apple HIG–inspired defaults; large touch targets (~44px).
	•	Motion is minimal and respects prefers-reduced-motion.

⸻

Development Tips
	•	Want to host icons locally? Replace the Font Awesome CDN link with a local build or inline SVGs.
	•	Prefer a static server? python3 -m http.server works, but Live Server is simpler.
	•	To reset to defaults during testing, clear site data (Local Storage) in devtools.

⸻

Roadmap (Ideas)
	•	Built-in count-up timer with audible cues at each pour start.
	•	URL params to share a recipe (coffee, taste/body, ratio).
	•	PWA for offline access on mobile.
	•	Advanced mode: edit pour starts/% and save custom profiles.

⸻

Credits
	•	Brewing method by Tetsu Kasuya.
	•	Icons: Font Awesome Free (via CDN).
	•	You and your contributors ☕️

⸻

Contributing

PRs are welcome! Please:
	1.	Keep the UI simple and mobile-first.
	2.	Maintain accessibility (labels, focus, color contrast).
	3.	Add comments for any new calculations or timeline logic.
