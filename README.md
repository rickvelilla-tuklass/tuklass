# Tuklass

Tuklass is a student workspace for notes, calendars, reminders, messages, profiles, and study tools.

## Repository structure

- `index.html` — public landing page + logged-in Tuklass app shell
- `catalog.html` — direct entry for Notes
- `calendar.html` — direct entry for Calendar
- `reminders.html` — direct entry for Reminders
- `messages.html` — direct entry for Messages
- `chat.html` — direct entry for a conversation
- `profile.html` — public student profile route
- `edit-profile.html` — profile editor
- `admin-reminders.html` — class reminder administration
- `tuklass-spa.css` — shared logged-in app styling
- `tuklass-spa.js` — shared soft-navigation/router and page modules
- `sitemap.xml` — public search sitemap
- `robots.txt` — crawler rules
- `CNAME` — GitHub Pages custom domain

## Important

The site still depends on the existing `images/` folder in the GitHub repository.
Do not delete that folder when replacing the code files.

The frontend also depends on the existing Google Apps Script backend and the
legacy `writejotUser` localStorage key. Those names are intentionally preserved
for compatibility even though the product is branded Tuklass.
