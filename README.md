# UK Quran LMS

A static web application for Quran learning management, with separate student and teacher dashboards, audio lessons, video lessons, reports, and Firebase-based authentication/database integration.

## Project structure

- `index.html` — login page for students and teachers
- `style.css` — global styling
- `manifest.json` — PWA manifest
- `JavaScript/` — core client scripts and Firebase configuration
  - `app.js` — login, role toggle, A2HS prompt, and service worker registration
  - `firebase-config.js` — Firebase app initialization
  - `sw.js` — service worker
  - `archived-data.js` — archived data helper
- `Components/` — feature pages and scripts
  - `Student/` — student dashboard and progress submission
  - `Teacher/` — teacher dashboard, student management, and reports
  - `Report/` — monthly report page
  - `Qira'at/` — audio lesson page
  - `Thajweed/` — video lesson page
- `Audios/` — audio files for Qira'at lessons
- `Videos/` — video files for Thajweed lessons
- `Images/` — app and lesson images

## How to run locally

This project is a static website. Serve it from the project root using any local static server.

### Option 1: Node.js

1. Open a terminal in the project folder.
2. Run:
   ```bash
   npx serve . -l 8000
   ```
3. Open `http://127.0.0.1:8000/` in your browser.

### Option 2: Any static server

If you have another static file server, point it at the project root and open `index.html`.

## Notes

- The app uses Firebase Authentication and Realtime Database, configured in `JavaScript/firebase-config.js`.
- Students and teachers have separate dashboards located in `Components/Student/student.html` and `Components/Teacher/teacher.html`.
- Static resources are referenced using relative paths; serve the app from the project root to avoid broken links.

## Troubleshooting

- If buttons or navigation fail, confirm the app is served from `http://127.0.0.1:8000/` or a similar root URL.
- If `app.js` fails to load, check that `JavaScript/app.js` exists and the page is loaded from the project root.
- If Firebase fails, verify network access and the Firebase project settings.
