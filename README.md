# Tuklass V8 frontend

Tuklass is a student workspace for notes, calendars, reminders, messages, profiles, and study tools.

## Active files

- `index.html` — public landing page + logged-in app shell
- route HTML files (`calendar.html`, `messages.html`, etc.) — direct-entry copies of the same SPA shell
- `tuklass-config.js` — **V8 single source for API URL, Google Client ID, version, and polling intervals**
- `tuklass-spa.js` — shared router + route modules
- `tuklass-spa.css`, `tuklass-v4.css`, `tuklass-v5.css`, `tuklass-v6.css`, `tuklass-v7.css` — current layered styling
- `tuklass-v4.js`, `tuklass-v5.js` — compatibility/feature modules still used by the current build
- `CNAME`, `robots.txt`, `sitemap.xml` — GitHub Pages/domain files

## V8 performance behavior

- chat refresh: 7 seconds while visible;
- messages inbox refresh: 20 seconds while visible;
- reminders refresh: 60 seconds while visible;
- opening/sending a chat triggers immediate refreshes, so normal interactions do not wait for the polling interval;
- a request already in progress is not duplicated by the next polling tick.

You can tune the intervals in `tuklass-config.js` without editing the large SPA file.

## Important

The site depends on the existing `images/` directory in your GitHub repository. Do not delete it when replacing these frontend files.

The legacy localStorage key `writejotUser` is intentionally preserved for compatibility with existing signed-in sessions.
