/*
 * Tuklass V8 central configuration.
 *
 * Keep environment-specific values here instead of duplicating them across
 * every route module. If Tuklass later moves from Apps Script to another API,
 * this is the first frontend file to update.
 */
window.TUKLASS_CONFIG = Object.freeze({
    version: "8.7.0",

    apiUrl:
        "https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec",

    googleClientId:
        "390952944395-3l2f1v20jarmslg83i3juduhbocoqdv2.apps.googleusercontent.com",

    /* V8.7: payments are handled manually through the official Tuklass Facebook page. */
    paymentsUrl:
        "https://www.facebook.com/profile.php?id=61593610565987",

    polling: Object.freeze({
        /* Chat still refreshes quickly, but V8 cuts idle backend traffic. */
        chatForegroundMs: 7000,
        conversationsMs: 20000,
        remindersMs: 60000
    })
});
