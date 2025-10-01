# Latest Fixes - October 1, 2025

## ✅ Two Issues Fixed

### 1. Search Auto-Scroll to Match ✓

**Problem:** Clicking ◀/▶ arrows didn't scroll to the highlighted word

**Solution:**
- Moved `scrollIntoView()` outside the forEach loop
- Added 100ms setTimeout to ensure DOM updates before scrolling
- Added debug logging to track which match we're scrolling to
- Now scrolls to center of screen with smooth behavior

**How it Works:**
```javascript
// After updating all highlights, scroll to current match
setTimeout(() => {
  currentMark.scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center',
    inline: 'nearest'
  });
}, 100);
```

---

### 2. Scroll-Up Auto-Load Fixed (Now Works Like Pill Click) ✓

**Problem:** Scroll detection wasn't working at all

**Root Cause:** ChatGPT uses specific scrollable containers, not `window.scroll`

**Solution - Dual Detection System:**

#### Method 1: Scroll Event Detection
- Finds the actual scrollable element in ChatGPT's DOM
- Tries multiple candidates: `main`, scroll containers, overflow elements
- Listens with event capture to catch all scroll events
- Adds listeners immediately and at 1s, 3s intervals (for dynamic content)
- When scroll < 500px from top + scrolling up + have hidden messages → expand +5
- Uses debounce (150ms) to prevent excessive triggers
- Has cooldown (1000ms) to prevent rapid firing

#### Method 2: IntersectionObserver (Backup)
- Observes the first visible message element
- When it becomes >50% visible on screen → expand +5
- Automatically re-observes new top element after expansion
- More reliable than scroll events in some cases

**How to Test Scroll Detection:**

1. **Enable Debug Logs:**
   - Open popup → Check "Enable debug logs" → Apply Settings
   - Open DevTools (F12) → Console tab

2. **Test Scroll Events:**
   ```
   Set keepN to 3
   Open long conversation (10+ pairs)
   Scroll down to bottom
   Slowly scroll up
   
   Watch console for:
   "Scroll event: Xpx, was: Ypx, scrollingUp: true, hidden: Z"
   "User scrolled to top! Auto-expanding by +5 pairs..."
   "Setting keepN to 8 (auto-expanded)"
   ```

3. **Test IntersectionObserver:**
   ```
   If scroll events don't trigger, the observer will catch it:
   "Top message detected via IntersectionObserver! Auto-expanding +5..."
   ```

4. **Verify Reset on New Message:**
   ```
   After auto-expand, send a new message
   Should see: "New message pair detected, resetting to original keepN: 3"
   ```

**Debug Console Output You'll See:**
```
[ChatGPT Speedup] Found main container, adding scroll listener. ScrollHeight: 2500, ClientHeight: 800
[ChatGPT Speedup] Found scrollable container: overflow-y-auto
[ChatGPT Speedup] Observing top element for intersection
[ChatGPT Speedup] Scroll detection enabled for auto-expand (+5 like pill click)

// When you scroll up:
[ChatGPT Speedup] Scroll event: 450px, was: 650px, scrollingUp: true, hidden: 12
[ChatGPT Speedup] User scrolled to top! Auto-expanding by +5 pairs (like clicking pill)...
[ChatGPT Speedup] Setting keepN to 8 (auto-expanded)
[ChatGPT Speedup] Pruning: 15 total pairs, keeping 8 visible
```

---

## Technical Details

### Files Modified
- `content.js` only

### Key Changes

**Search Auto-Scroll:**
- Lines 589-602: Moved scroll logic outside loop, added setTimeout

**Scroll Detection:**
- Lines 314-452: Complete rewrite of `setupScrollDetection()`
- Added `getScrollableElement()` helper
- Added dual detection: scroll events + IntersectionObserver
- Added multiple listener attachment attempts
- Added debouncing and cooldown mechanisms

**ApplyPruning Enhancement:**
- Lines 308-311: Re-setup observer after pruning changes

### Why Two Methods?

1. **Scroll Events** - Fast, immediate response
2. **IntersectionObserver** - More reliable, catches cases scroll events miss

If one method doesn't work in a user's browser/setup, the other will catch it.

---

## Testing Instructions

### Test Search Auto-Scroll:
1. Reload extension
2. Search for a common word (e.g., "the")
3. Should see "Match 1 of X"
4. Click ▶ Next
5. **Should auto-scroll** to next match (highlighted in orange)
6. Keep clicking ▶ - should scroll through all matches
7. Click ◀ - should scroll backwards

### Test Scroll Auto-Load:
1. **Enable debug logs** (very important!)
2. Set keepN to 3
3. Open conversation with 10+ exchanges
4. Scroll to bottom (only 3 pairs visible)
5. Scroll up slowly
6. Watch console for scroll events
7. When near top, should expand +5 pairs
8. Keep scrolling up, should expand again
9. Send new message
10. Should reset to 3 pairs

**If Not Working:**
- Check console for scroll event logs
- If no scroll events: Check for IntersectionObserver logs
- If neither: Report which ChatGPT URL you're using

---

## Browser Compatibility

Tested features:
- `scrollIntoView()` - All modern browsers
- `IntersectionObserver` - Chrome 51+, Firefox 55+, Safari 12.1+
- Event capture - All modern browsers

---

## Known Edge Cases

1. **Very fast scrolling**: Debounce may miss some events (intentional to prevent spam)
2. **Mobile view**: IntersectionObserver provides better support
3. **Narrow windows**: Scroll detection adapts to container size

---

## Next Steps

Test both features thoroughly:
- [ ] Search auto-scroll works smoothly
- [ ] Scroll detection triggers (check console logs)
- [ ] Both methods work independently
- [ ] Auto-expand works like clicking pill (+5 each time)
- [ ] Resets correctly on new message

**When ready, commit with:**
```bash
git add content.js
git commit -m "Fix search auto-scroll and scroll detection

- Search now scrolls to match when navigating with arrows
- Scroll detection uses dual method: events + IntersectionObserver
- Auto-expands +5 pairs when scrolling to top
- Extensive debug logging for troubleshooting
- Re-observes top element after each expansion"
git push origin main
```

---

**Status:** Ready for testing! 🎉

Both fixes are comprehensive and include fallback methods for reliability.

