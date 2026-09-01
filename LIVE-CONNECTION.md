# Tuklass Live Connection

This repository build is connected to the new Tuklass infrastructure.

## Live domain
https://tuklass.com

## Google Sign-In client
390952944395-3l2f1v20jarmslg83i3juduhbocoqdv2.apps.googleusercontent.com

## Apps Script backend
https://script.google.com/macros/s/AKfycbybWxbR34bbA6VlAbaI1qBn21iCqisr0-Mww6WzTVxUZdTJ-q7-jPP2TfZ3XrO5uMXVgw/exec

## Google Cloud

The OAuth Web client should include this Authorized JavaScript Origin:

https://tuklass.com

If the site is also served from `https://www.tuklass.com`, add that as a second
Authorized JavaScript Origin in Google Cloud before using the `www` hostname.

## GitHub Pages

Keep the existing `images/` folder when replacing the repository files.

The `CNAME` in this package is set to:

tuklass.com

## Compatibility

The localStorage key `writejotUser` and legacy `writejot_...` browser cache keys
are intentionally preserved so the current Tuklass frontend logic continues to
work. They are internal compatibility names and do not control the public brand.
