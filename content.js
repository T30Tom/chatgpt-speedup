/**
 * ChatGPT Speedup - Working with correct selectors
 */

const DEFAULTS = {
  keepN: 5,
  mode: "storage",
  storageCap: 200,
  debugLogs: true, // Enable by default to debug
  autoCollapse: false,
  pillEnabled: true
};

let state = { ...DEFAULTS };
let pillEl = null;
let hiddenMessages = new Set();
let observer = null;
let originalKeepN = DEFAULTS.keepN; // Store original user setting
let isAutoExpanded = false; // Track if we've auto-expanded
let lastScrollPosition = 0;

function debug(...args) {
  if (state.debugLogs) console.log("[ChatGPT Speedup]", ...args);
}

function settingsKey() {
  return "chat_pruner_settings";
}

async function loadSettings() {
  const { [settingsKey()]: s } = await chrome.storage.sync.get(settingsKey());
  if (s) Object.assign(state, s);
  originalKeepN = state.keepN; // Store the user's original setting
  debug("Settings loaded:", state);
}

async function saveSettings(partial) {
  Object.assign(state, partial);
  try {
    await chrome.storage.sync.set({ [settingsKey()]: state });
  } catch (error) {
    // Handle extension context invalidation (common in Opera/some browsers)
    if (error.message?.includes('Extension context invalidated')) {
      debug("Extension context invalidated - settings not saved. Please reload the page.");
      console.warn("ChatGPT Speedup: Extension context invalidated. Settings will apply but won't persist. Reload the page to fix.");
    } else {
      console.error("ChatGPT Speedup: Error saving settings:", error);
    }
  }
}

function getAllMessages() {
  // ChatGPT's actual message structure - look for conversation turns
  let messages = [];
  
  // Try multiple selectors based on ChatGPT versions
  const selectors = [
    '[data-testid^="conversation-turn-"]', // Current ChatGPT structure
    'div.group.w-full:has(.text-token-text-primary)', // Alternative structure
    'div[class*="ConversationItem"]', // Another possible structure
    'main article', // Fallback to articles
    'div.relative.flex.w-full' // Generic message container
  ];
  
  for (const selector of selectors) {
    try {
      const found = document.querySelectorAll(selector);
      if (found.length > 0) {
        // Filter to actual message containers
        messages = Array.from(found).filter(el => {
          const text = el.textContent || '';
          // Must have content and not be the input area
          return text.length > 10 && 
                 !el.querySelector('textarea') &&
                 !el.querySelector('button[aria-label="Send"]') &&
                 !el.closest('form');
        });
        
        if (messages.length > 0) {
          debug(`Found ${messages.length} individual turns using selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      debug("Selector error:", e);
    }
  }
  
  return messages;
}

// Group messages into pairs (user prompt + ChatGPT response = 1 "message")
function getMessagePairs() {
  const allTurns = getAllMessages();
  const pairs = [];
  
  // Group consecutive turns into pairs
  for (let i = 0; i < allTurns.length; i += 2) {
    const userTurn = allTurns[i];
    const assistantTurn = allTurns[i + 1];
    
    if (userTurn && assistantTurn) {
      // Both turns exist - create a pair
      pairs.push({
        elements: [userTurn, assistantTurn],
        userTurn: userTurn,
        assistantTurn: assistantTurn
      });
    } else if (userTurn) {
      // Only user turn (waiting for response)
      pairs.push({
        elements: [userTurn],
        userTurn: userTurn,
        assistantTurn: null
      });
    }
  }
  
  debug(`Grouped ${allTurns.length} turns into ${pairs.length} pairs`);
  return pairs;
}

function ensurePill() {
  if (!state.pillEnabled) {
    if (pillEl) {
      pillEl.remove();
      pillEl = null;
    }
    return null;
  }

  if (pillEl && document.body.contains(pillEl)) {
    applyPillTheme();
    return pillEl;
  }
  
  pillEl = document.createElement("div");
  pillEl.id = "chat-pruner-pill";
  applyPillTheme();
  pillEl.innerHTML = '<span class="pill-text">Loading...</span>';
  pillEl.title = "Click: +5 • Shift: -5 • Alt+drag: move";

  // Hover effect
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  pillEl.addEventListener('mouseenter', () => {
    if (!isDragging) pillEl.style.transform = 'scale(1.05)';
  });
  pillEl.addEventListener('mouseleave', () => {
    if (!isDragging) pillEl.style.transform = 'scale(1)';
  });

  // Load saved position
  chrome.storage.sync.get("pill_position", ({ pill_position }) => {
    if (pill_position?.x !== undefined && pill_position?.y !== undefined) {
      pillEl.style.left = `${pill_position.x}px`;
      pillEl.style.top = `${pill_position.y}px`;
      pillEl.style.right = 'auto';
      pillEl.style.bottom = 'auto';
    }
  });

  // Click handler
  pillEl.addEventListener("click", (e) => {
    if (isDragging || e.altKey) return;
    e.preventDefault();
    
    const current = state.keepN;
    if (e.shiftKey) {
      updateKeepN(Math.max(1, current - 5), true); // Manual change
    } else {
      updateKeepN(current + 5, true); // Manual change
    }
  });

  // Drag with Alt
  pillEl.addEventListener("mousedown", (e) => {
    if (!e.altKey || e.button !== 0) return;
    e.preventDefault();
    
    const rect = pillEl.getBoundingClientRect();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    pillEl.style.cursor = 'move';
    pillEl.style.transform = 'scale(0.95)';
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    const newLeft = Math.max(0, Math.min(window.innerWidth - 140, startLeft + (e.clientX - startX)));
    const newTop = Math.max(0, Math.min(window.innerHeight - 36, startTop + (e.clientY - startY)));
    
    pillEl.style.left = `${newLeft}px`;
    pillEl.style.top = `${newTop}px`;
    pillEl.style.right = 'auto';
    pillEl.style.bottom = 'auto';
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    pillEl.style.cursor = 'pointer';
    pillEl.style.transform = 'scale(1)';
    
    const rect = pillEl.getBoundingClientRect();
    chrome.storage.sync.set({
      pill_position: { x: rect.left, y: rect.top }
    });
  });

  document.body.appendChild(pillEl);
  return pillEl;
}

function applyPillTheme() {
  if (!pillEl) return;
  
  // Detect current theme
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                 (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
                 state.theme === 'dark';
  
  const bgColor = isDark ? 'rgba(10, 10, 10, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  const textColor = isDark ? '#ffffff' : '#353740';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)';
  const shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)';
  
  pillEl.style.cssText = `
    position: fixed !important;
    right: 20px;
    bottom: 20px;
    min-width: 140px;
    height: 36px;
    padding: 0 14px;
    background: ${bgColor};
    color: ${textColor};
    border: 2px solid ${borderColor};
    border-radius: 18px;
    box-shadow: 0 4px 12px ${shadowColor};
    z-index: 2147483647;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    transition: all 0.2s;
  `;
  
  // Update text color
  const textEl = pillEl.querySelector('.pill-text');
  if (textEl) {
    textEl.style.color = textColor;
  }
}

function updatePill() {
  const pill = ensurePill();
  if (!pill) return;
  
  const pairs = getMessagePairs();
  const visiblePairs = pairs.filter(pair => {
    // A pair is visible if any of its elements are visible
    return pair.elements.some(el => !hiddenMessages.has(el));
  }).length;
  const total = pairs.length;
  
  const textEl = pill.querySelector('.pill-text');
  if (textEl) {
    if (total === 0) {
      textEl.textContent = 'No messages found';
    } else {
      textEl.textContent = `${visiblePairs} visible / ${total} total`;
    }
  }
  
  // Update border color based on pruning level (keep the color indicators)
  const hiddenPercent = total > 0 ? ((total - visiblePairs) / total) * 100 : 0;
  if (hiddenPercent > 50) {
    pill.style.borderColor = 'rgba(255, 100, 100, 0.6)';
  } else if (hiddenPercent > 25) {
    pill.style.borderColor = 'rgba(255, 200, 0, 0.6)';
  } else {
    // Use theme-based border
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                   (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
                   state.theme === 'dark';
    pill.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)';
  }
}

function updateKeepN(n, isManualChange = false) {
  state.keepN = Math.max(1, n);
  
  // Only save and update original if it's a manual change (not auto-expand)
  if (isManualChange || !isAutoExpanded) {
    saveSettings({ keepN: state.keepN });
    originalKeepN = state.keepN;
    isAutoExpanded = false;
  }
  
  debug(`Setting keepN to ${state.keepN}${isAutoExpanded ? ' (auto-expanded)' : ''}`);
  applyPruning();
}

function applyPruning() {
  const pairs = getMessagePairs();
  const keep = Math.max(1, state.keepN);
  
  debug(`Pruning: ${pairs.length} total pairs, keeping ${keep} visible`);
  
  // Save scroll position before pruning to prevent auto-scroll to top
  const scrollableEl = document.querySelector('main') || window;
  const savedScrollTop = scrollableEl.scrollTop || window.scrollY || 0;
  
  // First, show all messages
  hiddenMessages.forEach(msg => {
    if (msg && msg.style) {
      msg.style.display = '';
      msg.style.opacity = '';
      msg.style.maxHeight = '';
    }
  });
  hiddenMessages.clear();
  
  // Hide older pairs if we have more than keepN
  if (pairs.length > keep) {
    const pairsToHide = pairs.slice(0, pairs.length - keep);
    
    pairsToHide.forEach(pair => {
      // Hide all elements in the pair
      pair.elements.forEach(el => {
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.maxHeight = '0';
        el.style.overflow = 'hidden';
        hiddenMessages.add(el);
      });
    });
    
    debug(`Hid ${pairsToHide.length} pairs (${hiddenMessages.size} individual elements)`);
  }
  
  updatePill();
  
  // Restore scroll position after pruning
  setTimeout(() => {
    if (scrollableEl.scrollTo) {
      scrollableEl.scrollTo({ top: savedScrollTop, behavior: 'instant' });
    } else if (scrollableEl === window) {
      window.scrollTo({ top: savedScrollTop, behavior: 'instant' });
    } else {
      scrollableEl.scrollTop = savedScrollTop;
    }
  }, 10);
  
  // Re-setup top message observer after pruning changes
  if (typeof window.chatgptSpeedupSetupTopObserver === 'function') {
    setTimeout(() => window.chatgptSpeedupSetupTopObserver(), 300);
  }
}

// Auto-expand when scrolling to top
function setupScrollDetection() {
  let scrollTimeout;
  let hasTriggeredAtTop = false;
  let scrollListenersAdded = false;
  
  // Find the actual scrollable element in ChatGPT
  function getScrollableElement() {
    // Try different possible scrollable containers
    const candidates = [
      document.querySelector('main'),
      document.querySelector('div[class*="react-scroll"]'),
      document.querySelector('.overflow-y-auto'),
      document.scrollingElement,
      document.documentElement
    ];
    
    for (const el of candidates) {
      if (el && el.scrollHeight > el.clientHeight) {
        return el;
      }
    }
    
    return document.documentElement;
  }
  
  const handleScroll = (event) => {
    // Only process if we have hidden messages
    if (hiddenMessages.size === 0) return;
    
    clearTimeout(scrollTimeout);
    
    scrollTimeout = setTimeout(() => {
      // Get the scrollable element
      const scrollEl = event?.target?.scrollTop !== undefined ? event.target : getScrollableElement();
      const currentScroll = scrollEl.scrollTop || 0;
      const scrollingUp = currentScroll < lastScrollPosition;
      
      lastScrollPosition = currentScroll;
      
      // Check if we're near the top (within 500px) and scrolling up
      if (scrollingUp && currentScroll < 500 && hiddenMessages.size > 0) {
        if (!hasTriggeredAtTop) {
          hasTriggeredAtTop = true;
          const pairs = getMessagePairs();
          
          debug(`User scrolled to top! Auto-expanding by +5 pairs (like clicking pill)...`);
          const newKeepN = Math.min(pairs.length, state.keepN + 5);
          
          if (newKeepN > state.keepN) {
            isAutoExpanded = true;
            updateKeepN(newKeepN);
          }
          
          // Reset trigger after a delay
          setTimeout(() => {
            hasTriggeredAtTop = false;
          }, 1000);
        }
      } else if (currentScroll > 500) {
        // Reset trigger when scrolling away from top
        hasTriggeredAtTop = false;
      }
    }, 200); // Increased debounce for better performance
  };
  
  // Listen to scroll on multiple possible containers
  const tryAddScrollListener = () => {
    if (scrollListenersAdded) return;
    
    const main = document.querySelector('main');
    if (main) {
      debug(`Adding scroll listener to main container`);
      main.addEventListener('scroll', handleScroll, { passive: true });
      scrollListenersAdded = true;
    }
    
    // Fallback to window scroll
    window.addEventListener('scroll', handleScroll, { passive: true });
  };
  
  // Try immediately and after a delay (for dynamic content)
  tryAddScrollListener();
  setTimeout(tryAddScrollListener, 1000);
  
  // Alternative method: Use IntersectionObserver only when scroll doesn't work
  let topObserver = null;
  const setupTopMessageObserver = () => {
    // Only use observer if we have hidden messages
    if (hiddenMessages.size === 0) {
      if (topObserver) {
        topObserver.disconnect();
        topObserver = null;
      }
      return;
    }
    
    const pairs = getMessagePairs();
    if (pairs.length === 0) return;
    
    // Clean up old observer
    if (topObserver) {
      topObserver.disconnect();
    }
    
    // Observe the first visible pair's first element
    const visiblePairs = pairs.filter(pair => {
      return pair.elements.some(el => !hiddenMessages.has(el));
    });
    
    if (visiblePairs.length > 0 && visiblePairs[0].elements[0]) {
      const topElement = visiblePairs[0].elements[0];
      
      topObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // When top element is fully visible and we have hidden messages
          if (entry.isIntersecting && entry.intersectionRatio > 0.5 && hiddenMessages.size > 0) {
            debug("Top message visible via IntersectionObserver! Auto-expanding +5...");
            const currentPairs = getMessagePairs();
            const newKeepN = Math.min(currentPairs.length, state.keepN + 5);
            
            if (newKeepN > state.keepN) {
              isAutoExpanded = true;
              updateKeepN(newKeepN);
              
              // Re-setup observer with new top element
              setTimeout(() => setupTopMessageObserver(), 500);
            }
          }
        });
      }, {
        threshold: [0.5], // Only one threshold for efficiency
        rootMargin: '100px'
      });
      
      topObserver.observe(topElement);
    }
  };
  
  // Only set up observer if scroll detection might not work
  setTimeout(() => {
    if (hiddenMessages.size > 0) {
      setupTopMessageObserver();
    }
  }, 2000);
  
  // Make it accessible for re-setup after pruning
  window.chatgptSpeedupSetupTopObserver = setupTopMessageObserver;
  
  debug("Scroll detection enabled (optimized for performance)");
}

// Detect when user sends a new message to reset to original keepN
function setupNewMessageDetection() {
  if (observer) observer.disconnect();
  
  let lastPairCount = getMessagePairs().length;
  let pruningTimeout = null;
  let observerPaused = false;
  
  observer = new MutationObserver(() => {
    // Skip if we're paused (during active generation)
    if (observerPaused) return;
    
    // Throttle pruning checks - only check every 2 seconds max
    if (pruningTimeout) return;
    
    pruningTimeout = setTimeout(() => {
      const currentPairs = getMessagePairs();
      const currentPairCount = currentPairs.length;
      
      if (currentPairCount > lastPairCount && isAutoExpanded) {
        debug("New message pair detected, resetting to original keepN:", originalKeepN);
        isAutoExpanded = false;
        lastPairCount = currentPairCount;
        updateKeepN(originalKeepN, true);
      } else if (currentPairCount !== lastPairCount) {
        lastPairCount = currentPairCount;
        applyPruning();
      }
      
      pruningTimeout = null;
    }, 2000); // Only check every 2 seconds instead of 500ms
  });
  
  // Only observe main chat container, not entire body
  const mainContainer = document.querySelector('main') || document.body;
  observer.observe(mainContainer, {
    childList: true,
    subtree: true
  });
  
  // Pause observer during ChatGPT response generation
  window.chatgptSpeedupPauseObserver = () => {
    observerPaused = true;
    debug("Observer paused during response generation");
  };
  
  window.chatgptSpeedupResumeObserver = () => {
    observerPaused = false;
    debug("Observer resumed");
    // Check for changes when resuming
    const currentPairs = getMessagePairs();
    if (currentPairs.length !== lastPairCount) {
      lastPairCount = currentPairs.length;
      applyPruning();
    }
  };
}

// Detect when ChatGPT is generating a response
function setupGenerationDetection() {
  let isGenerating = false;
  let generationCheckInterval = null;
  
  const checkIfGenerating = () => {
    // Look for stop button or generating indicator
    const stopButton = document.querySelector('button[data-testid="stop-button"], button[aria-label="Stop generating"]');
    const wasGenerating = isGenerating;
    isGenerating = !!stopButton;
    
    if (isGenerating && !wasGenerating) {
      debug("ChatGPT started generating - pausing observer");
      if (typeof window.chatgptSpeedupPauseObserver === 'function') {
        window.chatgptSpeedupPauseObserver();
      }
    } else if (!isGenerating && wasGenerating) {
      debug("ChatGPT finished generating - resuming observer");
      if (typeof window.chatgptSpeedupResumeObserver === 'function') {
        window.chatgptSpeedupResumeObserver();
      }
    }
  };
  
  // Check every 500ms for generation state
  generationCheckInterval = setInterval(checkIfGenerating, 500);
  
  debug("Generation detection enabled");
}

async function init() {
  debug("Initializing ChatGPT Speedup...");
  await loadSettings();
  
  // Initial setup
  ensurePill();
  
  // Wait for messages with longer timeout
  let attempts = 0;
  const checkInterval = setInterval(() => {
    const messages = getAllMessages();
    attempts++;
    
    if (messages.length > 0) {
      clearInterval(checkInterval);
      debug(`Ready! Found ${messages.length} messages`);
      applyPruning();
      
      // Set up observers and scroll detection
      setupNewMessageDetection();
      setupScrollDetection();
      setupGenerationDetection();
    } else {
      debug(`Attempt ${attempts}: No messages yet`);
      updatePill(); // Update pill to show "No messages"
      
      if (attempts > 60) { // 30 seconds
        clearInterval(checkInterval);
        debug("Timeout: No messages found");
      }
    }
  }, 500);
}

// Search functionality with highlighting
let searchState = {
  currentQuery: '',
  matches: [],
  currentIndex: -1,
  highlightClass: 'chatgpt-speedup-highlight'
};

function clearSearchHighlights() {
  // Remove all existing highlights
  const highlights = document.querySelectorAll(`.${searchState.highlightClass}, .${searchState.highlightClass}-current`);
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize(); // Merge adjacent text nodes
    }
  });
  
  searchState.matches = [];
  searchState.currentIndex = -1;
}

function highlightText(element, pattern) {
  const text = element.textContent || '';
  const fragments = [];
  let lastIndex = 0;
  let match;
  
  // Reset regex lastIndex for global patterns
  pattern.lastIndex = 0;
  
  // Find all instances using the pattern
  while ((match = pattern.exec(text)) !== null) {
    const index = match.index;
    const matchText = match[0];
    
    // Add text before match
    if (index > lastIndex) {
      fragments.push(document.createTextNode(text.substring(lastIndex, index)));
    }
    
    // Add highlighted match
    const mark = document.createElement('mark');
    mark.className = searchState.highlightClass;
    mark.textContent = matchText;
    mark.style.cssText = 'background-color: yellow; color: black; padding: 2px 0;';
    fragments.push(mark);
    searchState.matches.push(mark);
    
    lastIndex = index + matchText.length;
    
    // Prevent infinite loop for zero-width matches
    if (matchText.length === 0) {
      pattern.lastIndex++;
    }
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    fragments.push(document.createTextNode(text.substring(lastIndex)));
  }
  
  return fragments;
}

function highlightInElement(element, query, pattern) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip if parent is already a highlight or is a script/style
        if (node.parentElement?.tagName === 'MARK' || 
            node.parentElement?.tagName === 'SCRIPT' ||
            node.parentElement?.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        // Only accept if contains match using pattern
        const text = node.textContent || '';
        pattern.lastIndex = 0; // Reset for test
        return pattern.test(text)
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }
  
  // Process text nodes
  textNodes.forEach(textNode => {
    const fragments = highlightText(textNode, pattern);
    if (fragments.length > 0) {
      const parent = textNode.parentNode;
      fragments.forEach(fragment => {
        parent.insertBefore(fragment, textNode);
      });
      parent.removeChild(textNode);
    }
  });
}

function searchInMessages(query, action = 'search', options = {}) {
  if (!query || query.length < 2) {
    clearSearchHighlights();
    return { matches: 0, currentIndex: -1, total: 0 };
  }
  
  const useRegex = options.useRegex || false;
  const filter = options.filter || '';
  const searchKey = `${query}|${useRegex}|${filter}`;
  
  // If it's a new search, clear previous highlights
  if (searchKey !== searchState.currentQuery) {
    clearSearchHighlights();
    searchState.currentQuery = searchKey;
    
    const allTurns = getAllMessages();
    debug(`Searching for "${query}" in ${allTurns.length} individual turns (regex: ${useRegex}, filter: ${filter})`);
    
    // Find all pairs that contain matches and ensure they're visible
    const pairs = getMessagePairs();
    let pairsWithMatches = [];
    
    // Create search pattern
    let searchPattern;
    try {
      if (useRegex) {
        searchPattern = new RegExp(query, 'gi');
      } else {
        searchPattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      }
    } catch (e) {
      debug("Invalid regex pattern:", e);
      return { matches: 0, currentIndex: -1, total: 0, error: "Invalid regex pattern" };
    }
    
    pairs.forEach(pair => {
      let pairHasMatch = false;
      pair.elements.forEach(el => {
        // Apply filter
        const role = el.getAttribute('data-message-author-role');
        if (filter === 'from:me' && role !== 'user') return;
        if (filter === 'from:assistant' && role !== 'assistant') return;
        
        const text = el.textContent || '';
        if (searchPattern.test(text)) {
          pairHasMatch = true;
          // Highlight the text
          highlightInElement(el, useRegex ? query : null, searchPattern);
          
          // Show if hidden
          if (hiddenMessages.has(el)) {
            el.style.display = '';
            el.style.opacity = '';
            el.style.maxHeight = '';
          }
        }
      });
      
      if (pairHasMatch) {
        pairsWithMatches.push(pair);
      }
    });
    
    // Ensure enough pairs are visible to show all matches
    if (pairsWithMatches.length > state.keepN) {
      isAutoExpanded = true;
      updateKeepN(pairsWithMatches.length);
    }
    
    debug(`Found ${searchState.matches.length} matches in ${pairsWithMatches.length} pairs`);
    
    // Set current to first match
    searchState.currentIndex = searchState.matches.length > 0 ? 0 : -1;
  }
  
  // Handle navigation
  if (action === 'next' && searchState.matches.length > 0) {
    searchState.currentIndex = (searchState.currentIndex + 1) % searchState.matches.length;
  } else if (action === 'prev' && searchState.matches.length > 0) {
    searchState.currentIndex = (searchState.currentIndex - 1 + searchState.matches.length) % searchState.matches.length;
  }
  
  // Update highlighting
  searchState.matches.forEach((mark, idx) => {
    if (idx === searchState.currentIndex) {
      mark.className = searchState.highlightClass + '-current';
      mark.style.cssText = 'background-color: orange; color: black; padding: 2px 4px; font-weight: bold; border-radius: 2px;';
    } else {
      mark.className = searchState.highlightClass;
      mark.style.cssText = 'background-color: yellow; color: black; padding: 2px 0;';
    }
  });
  
  // Scroll to current match - use multiple methods for reliability
  if (searchState.currentIndex >= 0 && searchState.matches[searchState.currentIndex]) {
    const currentMark = searchState.matches[searchState.currentIndex];
    const currentMatchNum = searchState.currentIndex + 1;
    const totalMatches = searchState.matches.length;
    
    debug(`Navigating to match ${currentMatchNum} of ${totalMatches}`);
    
    // Method 1: Ensure parent message is visible
    const messageContainer = currentMark.closest('[data-testid^="conversation-turn-"], div.group.w-full');
    if (messageContainer && hiddenMessages.has(messageContainer)) {
      debug("Parent message is hidden, making it visible");
      messageContainer.style.display = '';
      messageContainer.style.opacity = '';
      messageContainer.style.maxHeight = '';
      hiddenMessages.delete(messageContainer);
    }
    
    // Method 2: Use multiple scroll attempts with increasing delays
    const scrollToMatch = () => {
      debug(`Scrolling to match at position ${currentMatchNum}/${totalMatches}`);
      
      // First scroll attempt - instant
      currentMark.scrollIntoView({ 
        behavior: 'auto',  // Use 'auto' for instant scroll
        block: 'center',
        inline: 'nearest'
      });
      
      // Second scroll attempt - smooth after a delay
      setTimeout(() => {
        currentMark.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        // Flash the highlight to make it more visible
        currentMark.style.cssText = 'background-color: #ff6600; color: white; padding: 4px 6px; font-weight: bold; border-radius: 3px; box-shadow: 0 0 10px rgba(255,102,0,0.5);';
        
        setTimeout(() => {
          currentMark.style.cssText = 'background-color: orange; color: black; padding: 2px 4px; font-weight: bold; border-radius: 2px;';
        }, 300);
      }, 50);
    };
    
    // Execute scroll
    scrollToMatch();
  }
  
  return { 
    matches: searchState.matches.length,
    currentIndex: searchState.currentIndex + 1, // 1-based for display
    total: searchState.matches.length
  };
}

// Message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  debug("Received message:", msg.type);
  
  switch (msg.type) {
    case "ping":
      sendResponse({ ok: true });
      return true;
      
    case "applySettings":
      loadSettings().then(() => {
        applyPruning();
        sendResponse({ ok: true });
      });
      return true;
      
    case "getStats": {
      const pairs = getMessagePairs();
      const visiblePairs = pairs.filter(pair => {
        return pair.elements.some(el => !hiddenMessages.has(el));
      }).length;
      sendResponse({
        visible: visiblePairs,
        archived: pairs.length - visiblePairs,
        total: pairs.length
      });
      return true;
    }
      
    case "searchArchive": {
      const result = searchInMessages(msg.query, msg.action || 'search', {
        useRegex: msg.useRegex,
        filter: msg.filter
      });
      sendResponse(result);
      return true;
    }
      
    case "searchNext": {
      const nextResult = searchInMessages(searchState.currentQuery, 'next');
      sendResponse(nextResult);
      return true;
    }
      
    case "searchPrev": {
      const prevResult = searchInMessages(searchState.currentQuery, 'prev');
      sendResponse(prevResult);
      return true;
    }
      
    case "clearSearch":
      clearSearchHighlights();
      sendResponse({ ok: true });
      return true;
      
    case "getAllMessagesForExport": {
      const allTurns = getAllMessages();
      const messages = allTurns.map(turn => {
        return turn.textContent || turn.innerText || '';
      }).filter(text => text.length > 0);
      
      sendResponse({ messages });
      return true;
    }
      
    case "refreshPrompt":
      if (confirm("Refresh page to reload extension?")) {
        location.reload();
      }
      sendResponse({ ok: true });
      return true;
      
    default:
      sendResponse({ ok: true });
      return true;
  }
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 100);
}

// Log to console for debugging
console.log("ChatGPT Speedup loaded - Check console for debug messages");
