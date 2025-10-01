# Backup - Working Version v1
**Created:** October 1, 2025
**Status:** First working core version

## What's included
This backup contains the first fully working version of ChatGPT Speedup with:
- Working message pruning/hiding
- Floating pill UI
- Settings persistence
- Message visibility controls

## How to Restore

### Option 1: Simple File Copy
1. Copy all files from this `backup-working-v1/` directory
2. Paste them into the main project directory
3. Reload the extension in Chrome

### Option 2: Using Git
If you've committed this backup to git, you can restore to this exact state:

```bash
# View all commits
git log --oneline

# Find the commit hash for "Working version v1 backup"
# Then restore to that commit
git checkout <commit-hash>

# Or if you want to create a new branch from that point
git checkout -b restore-working-v1 <commit-hash>
```

### Option 3: From GitHub Release
If you created a GitHub release:
1. Go to your repository's Releases page
2. Find "v1.0.0 - Working Core"
3. Download the source code zip
4. Extract and replace your current files

## Files in this backup
- content.js - Main content script with message handling
- content.css - Styling for the floating pill
- popup.js - Extension popup functionality
- popup.html - Popup interface
- manifest.json - Extension manifest
- background.js - Background service worker

## What was working
✅ Message hiding/showing based on keepN setting
✅ Floating pill showing visible/total messages
✅ Click to increase messages (+5)
✅ Shift+click to decrease messages (-5)
✅ Alt+drag to move pill position
✅ Settings persistence
✅ Multiple ChatGPT page structure detection

## Known issues (to be fixed after backup)
❌ Search button not finding matches
❌ No auto-load more messages when scrolling to top

