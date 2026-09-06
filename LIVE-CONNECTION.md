# Tuklass V8 live connection

The frontend's environment-specific connection settings now live in one place:

`frontend/tuklass-config.js`

Current Google OAuth Client ID and Apps Script `/exec` URL are stored there. The active HTML/JS modules read `window.TUKLASS_CONFIG` instead of duplicating the endpoint throughout the codebase.

If you create a new Apps Script deployment URL later, update `apiUrl` in `tuklass-config.js`, then cache-bust or hard-refresh the deployed site.

If you replace the Google OAuth web client, update `googleClientId` in the same file and ensure your Tuklass domain is included in the OAuth client's authorized JavaScript origins.
