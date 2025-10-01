# Fixes Applied - October 1, 2025

## Summary
Two critical issues have been fixed after creating the v1.0.0 backup:

### ✅ Issue 1: Search Button Now Working
**Problem:** Search button was returning "no matches found" even when text was visible.

**Root Cause:** The `popup.js` was sending a `searchArchive` message, but `content.js` had no handler for it.

**Solution:**
- Added `searchInMessages()` function to search through all messages (both visible and hidden)
- Added `searchArchive` case handler in the message listener
- Search now:
  - Finds matches in both visible and hidden messages
  - Automatically shows hidden messages that match
  - Highlights matching messages with yellow background
  - Scrolls to the first match
  - Updates keepN to show all matching messages

**How to Test:**
1. Open ChatGPT with some conversation history
2. Click the extension popup
3. Type a word you know exists in your messages in the search box
4. Click the search button 🔍
5. You should see "Found X matches" and the page should scroll to highlight matches

### ✅ Issue 2: Auto-Expand on Scroll to Top
**Problem:** Extension needed to allow users to see older messages without manually clicking the pill, but reset when they send a new prompt.

**Solution:**
- Added scroll detection that monitors when user scrolls up
- When user scrolls near the top (within 200px) and there are hidden messages:
  - Automatically loads 10 more messages
  - Marks this as an "auto-expand" (not saved as user preference)
- When user sends a new prompt:
  - Automatically resets to their original keepN setting
  - Ensures faster ChatGPT performance returns

**How to Test:**
1. Set "Messages to keep visible" to 6 in the popup
2. Open a conversation with 20+ messages
3. Scroll down to the bottom (only 6 messages should be visible)
4. Slowly scroll up to the top
5. You should see 10 more messages automatically load (now 16 visible)
6. Continue scrolling up to load even more
7. Type and send a new prompt
8. After ChatGPT responds, you should be back to 6 visible messages

## Technical Details

### New Variables Added:
```javascript
let originalKeepN = DEFAULTS.keepN; // Store user's preferred setting
let isAutoExpanded = false;          // Track if we auto-expanded
let lastScrollPosition = 0;          // For scroll direction detection
```

### New Functions:
- `searchInMessages(query)` - Searches all messages and highlights matches
- `setupScrollDetection()` - Monitors scroll position for auto-expand
- `setupNewMessageDetection()` - Detects new user messages to reset keepN

### Modified Functions:
- `updateKeepN(n, isManualChange)` - Now tracks manual vs automatic changes
- `loadSettings()` - Now stores originalKeepN for reset functionality

## Files Modified
- `content.js` - All fixes implemented here
- No changes to `popup.js`, `popup.html`, or `content.css`

## Commits
1. **v1.0.0 backup**: `5df593b` - Working core version with backup directory
2. **Fixes applied**: `b900c12` - Search and auto-expand features

## Backup & Restore

### Your Backup is Safe
Your working v1.0.0 is saved in:
- **Directory:** `backup-working-v1/` (with RESTORE_INSTRUCTIONS.md)
- **Git Tag:** `v1.0.0`
- **GitHub Release:** https://github.com/T30Tom/chatgpt-speedup/releases/tag/v1.0.0

### How to Restore to v1.0.0 (Before Fixes)

**Option 1: From Backup Directory**
```bash
cd c:\Users\teoin\chatgpt-speedup
copy backup-working-v1\*.* .
```

**Option 2: From Git**
```bash
git checkout v1.0.0
```

**Option 3: From Specific Files**
```bash
git checkout v1.0.0 -- content.js
# Then reload the extension in Chrome
```

### How to Restore to Any Specific Commit
```bash
# View commit history
git log --oneline

# Restore to any commit
git checkout <commit-hash>

# Or create a new branch from that point
git checkout -b my-restore-branch <commit-hash>
```

## Next Steps
1. Test both features thoroughly in ChatGPT
2. Reload the extension in Chrome to apply changes:
   - Go to `chrome://extensions/`
   - Click the refresh icon on "ChatGPT Speedup"
   - Or toggle it off and on
3. Report any issues or additional improvements needed

## Notes
- The auto-expand feature uses a 150ms debounce on scroll to prevent excessive updates
- Search is case-insensitive and searches in all message text
- The original keepN is preserved even after multiple auto-expands
- Debug logs show when auto-expand triggers (if debug mode is enabled)

