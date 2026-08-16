# YouTube Authentication Guide

## The Problem
YouTube blocks automated downloads because they think you're a bot. The error you're seeing is:
```
Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication.
```

## The Solution - 3 Methods

### Method 1: Browser Cookies (EASIEST - Recommended for Windows/Mac)

**Step 1: Install Chrome extension to export cookies**
1. Open Chrome/Chromium browser
2. Go to [Chrome Web Store - Get cookies.txt](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndtbojnaibmipjbapijlobnodkd)
3. Click "Add to Chrome"

**Step 2: Export YouTube cookies**
1. Go to YouTube.com
2. Log in to your account
3. Click the extension icon in the top right
4. Select "cookies.txt" format
5. Copy the text that appears

**Step 3: Upload to SOCIAL HUB**
1. Go to "Media Downloader" section
2. Scroll down to "Downloader Settings"
3. Paste or upload the cookies.txt file
4. Click "Save"

**Step 4: Try downloading again**
- The downloader will now use your YouTube cookies automatically!

---

### Method 2: Firefox Extension

**Step 1: Install Firefox extension**
1. Open Firefox browser
2. Go to [Firefox Add-ons - Cookie Editor](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)
3. Click "Add to Firefox"

**Step 2: Export as cookies.txt**
1. Go to YouTube.com
2. Log in to your account
3. Click the Cookie Editor icon
4. Use "Export" function
5. Choose "cookies.txt" format

**Step 3: Upload to SOCIAL HUB**
(Same as Method 1 - Steps 1-4)

---

### Method 3: Manual Cookie Export (Advanced)

**Step 1: Get cookies using DevTools**
1. Go to YouTube.com and log in
2. Press F12 to open Developer Tools
3. Go to "Application" tab
4. Click "Cookies" > "https://www.youtube.com"
5. Look for important cookies:
   - `__Secure-1PSIDTS`
   - `__Secure-1PSID`
   - `HSID`
   - `SSID`
   - `SameSite`
   - `logged_in`

**Step 2: Create cookies.txt format**
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	0	__Secure-1PSIDTS	YOUR_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	__Secure-1PSID	YOUR_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	HSID	YOUR_VALUE_HERE
.youtube.com	TRUE	/	TRUE	0	logged_in	1
```

**Step 3: Upload to SOCIAL HUB**
(Same as Method 1 - Steps 1-4)

---

## Automatic Browser Cookie Detection

The downloader now automatically tries to use cookies from:
- ✅ Chromium/Chrome browser
- ✅ Firefox browser
- ✅ Uploaded cookies.txt files

**If you have YouTube open in your browser and logged in, the downloader should work without any extra steps!**

---

## Troubleshooting

### Still getting "Sign in to confirm" error?

**Try these steps:**

1. **Log out and log back in on YouTube**
   - Clear your browser cookies for youtube.com
   - Log in again
   - Try downloading

2. **Use Incognito/Private mode**
   - If it's a public video, try an incognito window
   - Incognito windows don't require as much authentication

3. **Check if video is restricted**
   - Some videos require YouTube Premium or are age-restricted
   - Private videos cannot be downloaded

4. **Wait a bit**
   - If you've made many download attempts, YouTube might temporarily block you
   - Wait 30 minutes and try again

5. **Use a VPN**
   - YouTube sometimes blocks certain regions
   - Try connecting to a different country's VPN

### Error says "HTTP Error 429"?
- **HTTP 429 = Too Many Requests**
- YouTube is rate-limiting you
- Wait 30 minutes before trying again
- Upload cookies from a different account

### Can't find extension in my browser?
- Make sure you're using Chromium, Chrome, or Firefox
- Safari and Edge may not work well
- Try another browser if available

---

## Best Practices

✅ **DO:**
- Regularly refresh your cookies.txt file (monthly)
- Use your personal YouTube account for downloads
- Only download content you have permission to download
- Store cookies securely - don't share them

❌ **DON'T:**
- Use someone else's cookies
- Attempt to download copyrighted content without permission
- Download thousands of videos in one day (YouTube will block you)
- Use cookies that have been leaked/compromised

---

## Why This Is Necessary

YouTube specifically blocks automated tools to:
- Protect against mass downloads
- Prevent bot abuse
- Enforce Terms of Service

By using your own browser cookies, you prove you're a real user, and YouTube allows the download.

---

## Questions?

If you're still having issues:
1. Check the error message displayed - it's specific to your problem
2. Review the steps above for your browser
3. Make sure your YouTube account is in good standing (no violations)
4. Try a different video to test
5. Check your internet connection

---

## Cookies Privacy & Security

⚠️ **Important Security Note:**
- **Never share** your cookies.txt file with others
- **Never paste** cookies in public forums or chat
- **Keep them private** - they contain your YouTube session data
- **Delete old cookies.txt files** when you're done using them
- The app only uses cookies locally - they're never sent to third-party servers

---

**Updated:** 2026-08-16 | SOCIAL HUB Media Downloader
