# Changelog v1.1.0 - October 1, 2025

## 🎉 Major Features Added

### ✅ Message Pair Counting
- **What Changed:** Messages are now counted as pairs (your prompt + ChatGPT's response = 1 message)
- **Before:** 6 visible items (3 yours + 3 ChatGPT's) showed as "6 visible"
- **Now:** Shows correctly as "3 visible"
- **Why:** More intuitive - matches how you think about conversations

### ✅ Scroll-Up Auto-Load (WORKING!)
- **What:** Scroll to top automatically loads more messages
- **How:** Dual detection system:
  - Scroll event detection with debouncing
  - IntersectionObserver as backup
- **Behavior:** Loads +5 pairs when scrolling near top (within 500px)
- **Smart Reset:** Automatically resets to your original setting when you send a new message
- **Performance:** Optimized with debouncing and cooldown periods

### ✅ Enhanced Search with Navigation
- **Highlighting:** Yellow for all matches, orange for current match
- **Match Counter:** Shows "Match X of Y" below search box
- **Navigation Arrows:** ◀ Previous | 🔍 Search | ▶ Next
- **Auto-Show:** Hidden messages with matches become visible
- **Keyboard:** Enter to search, Escape to clear

## 🔧 Technical Improvements

### Core Architecture Changes
- Added `getMessagePairs()` function for intelligent pair grouping
- Rewrote `applyPruning()` to work with pairs instead of individual turns
- Complete `setupScrollDetection()` overhaul with dual detection
- New search system with DOM tree walking and highlight management

### Performance Features
- Scroll debouncing (150ms) prevents excessive updates
- Cooldown mechanism (1000ms) prevents rapid-fire expansions
- IntersectionObserver for efficient visibility detection
- Smart observer re-setup after pruning changes

### Debug Improvements
- Extensive console logging for troubleshooting
- Tracks scroll position, direction, and trigger points
- Reports pair counts and pruning operations
- Search match tracking and navigation logging

## 📝 Files Modified

### content.js (Major Changes)
- Added `getMessagePairs()` - groups conversation turns into pairs
- Rewrote `applyPruning()` - operates on pairs, re-setups observers
- Rewrote `updatePill()` - displays pair counts
- Rewrote `setupScrollDetection()` - dual detection system
- Rewrote `setupNewMessageDetection()` - detects new pairs
- Complete search overhaul: `searchInMessages()`, `highlightInElement()`, `clearSearchHighlights()`
- Updated message handlers: `searchArchive`, `searchNext`, `searchPrev`, `clearSearch`, `getStats`

### popup.html (Minor Changes)
- Added search navigation buttons: `searchPrevBtn` (◀), `searchNextBtn` (▶)
- Added `searchResults` div for match counter display
- Updated label: "Search archived messages" → "Search messages"

### popup.js (Minor Changes)
- Added `updateSearchResults()` for match info display
- Added navigation handlers for prev/next buttons
- Added keyboard shortcuts (Enter, Escape)
- Added auto-clear on empty input
- Updated to work with new message handlers

### manifest.json
- Version bump: 1.0.0 → 1.1.0

## 🐛 Bug Fixes from v1.0.0

1. **Search Functionality Now Works**
   - Fixed: Missing `searchArchive` handler in content.js
   - Now: Finds and highlights all matches across all messages

2. **Message Counting Fixed**
   - Fixed: Double-counting individual turns
   - Now: Correctly counts conversation pairs

3. **Scroll Detection Fixed**
   - Fixed: Wasn't detecting scroll events at all
   - Now: Dual detection system (scroll events + IntersectionObserver)

## 📊 Statistics & Metrics

### Code Changes
- Lines added: ~350
- Lines modified: ~150
- New functions: 5
- Rewritten functions: 7

### Features
- Total features: 12
- New in v1.1.0: 3 major features
- Improved from v1.0.0: 4 features

## 🔄 Migration from v1.0.0

**Automatic** - No user action required!

Settings are preserved:
- Your `keepN` value
- Debug logs preference
- Pill position
- Theme selection
- All other settings

**What You'll Notice:**
1. Message counts cut in half (this is correct - pairs not individual turns)
2. Scroll-up now loads more messages automatically
3. Search actually works and highlights results

## ⚙️ System Requirements

- Chrome/Edge 51+ (for IntersectionObserver)
- ChatGPT on chat.openai.com or chatgpt.com
- No additional dependencies

## 🧪 Testing Performed

✅ Message pair counting with various conversation lengths
✅ Scroll detection on both chat.openai.com and chatgpt.com
✅ Search highlighting with 1-100+ matches
✅ Navigation through search results
✅ Auto-reset on new message after auto-expand
✅ Settings persistence across sessions
✅ Pill drag and click functionality
✅ Debug logging output

## 📚 Known Limitations

### Not Yet Fixed (Planned for v1.1.1)
- Search navigation arrows don't auto-scroll to match (highlighting works, scroll doesn't)
- Some performance impact during ChatGPT response generation

### By Design
- Scroll detection has 150ms debounce (prevents spam)
- Auto-expand cooldown of 1000ms (prevents rapid triggers)
- Search highlighting modifies DOM (necessary for visual feedback)

## 🚀 Upgrade Instructions

### From v1.0.0:
1. Pull latest code from GitHub
2. Reload extension in Chrome (`chrome://extensions/`)
3. Done! Settings are preserved.

### Fresh Install:
1. Clone repository
2. Load unpacked in Chrome
3. Configure settings in popup
4. Enjoy faster ChatGPT!

## 🙏 Credits

- Scroll detection inspired by infinite scroll patterns
- Search highlighting using native DOM TreeWalker
- IntersectionObserver for efficient visibility tracking

## 📖 Documentation

See also:
- `FIXES_SUMMARY.md` - Detailed technical explanation of fixes
- `LATEST_FIXES.md` - Most recent changes and testing instructions
- `backup-v1.1-working/RESTORE_INSTRUCTIONS.md` - Rollback guide

---

**Release Date:** October 1, 2025
**Tag:** v1.1.0
**Branch:** main
**Status:** Stable (with known issues listed above)

