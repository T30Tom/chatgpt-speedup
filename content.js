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
  await chrome.storage.sync.set({ [settingsKey()]: state });
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
          debug(`Found ${messages.length} messages using selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      debug("Selector error:", e);
    }
  }
  
  return messages;
}

function ensurePill() {
  if (!state.pillEnabled) {
    if (pillEl) {
      pillEl.remove();
      pillEl = null;
    }
    return null;
  }

  if (pillEl && document.body.contains(pillEl)) return pillEl;
  
  pillEl = document.createElement("div");
  pillEl.id = "chat-pruner-pill";
  pillEl.style.cssText = `
    position: fixed !important;
    right: 20px;
    bottom: 20px;
    min-width: 140px;
    height: 36px;
    padding: 0 14px;
    background: rgba(10, 10, 10, 0.9);
    color: #fff;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 18px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 2147483647;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 600 13px/1 system-ui, sans-serif;
    transition: all 0.2s;
  `;
  pillEl.innerHTML = '<span style="color: #fff;">Loading...</span>';
  pillEl.title = "Click: +5 • Shift: -5 • Alt+drag: move";

  // Hover effect
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

  let isDragging = false;
  let startX, startY, startLeft, startTop;

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

function updatePill() {
  const pill = ensurePill();
  if (!pill) return;
  
  const messages = getAllMessages();
  const visible = messages.filter(m => !hiddenMessages.has(m)).length;
  const total = messages.length;
  
  const textEl = pill.querySelector('span');
  if (textEl) {
    if (total === 0) {
      textEl.textContent = 'No messages found';
    } else {
      textEl.textContent = `${visible} visible / ${total} total`;
    }
  }
  
  // Update border color based on pruning level
  const hiddenPercent = total > 0 ? (hiddenMessages.size / total) * 100 : 0;
  if (hiddenPercent > 50) {
    pill.style.borderColor = 'rgba(255, 100, 100, 0.6)';
  } else if (hiddenPercent > 25) {
    pill.style.borderColor = 'rgba(255, 200, 0, 0.6)';
  } else {
    pill.style.borderColor = 'rgba(255, 255, 255, 0.2)';
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
  const messages = getAllMessages();
  const keep = Math.max(1, state.keepN);
  
  debug(`Pruning: ${messages.length} total messages, keeping ${keep} visible`);
  
  // First, show all messages
  hiddenMessages.forEach(msg => {
    if (msg && msg.style) {
      msg.style.display = '';
      msg.style.opacity = '';
      msg.style.maxHeight = '';
    }
  });
  hiddenMessages.clear();
  
  // Hide older messages if we have more than keepN
  if (messages.length > keep) {
    const toHide = messages.slice(0, messages.length - keep);
    
    toHide.forEach(msg => {
      // Use multiple hiding methods for compatibility
      msg.style.display = 'none';
      msg.style.opacity = '0';
      msg.style.maxHeight = '0';
      msg.style.overflow = 'hidden';
      hiddenMessages.add(msg);
    });
    
    debug(`Hid ${toHide.length} messages`);
  }
  
  updatePill();
}

// Auto-expand when scrolling to top
function setupScrollDetection() {
  let scrollTimeout;
  
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    
    scrollTimeout = setTimeout(() => {
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const scrollingUp = currentScroll < lastScrollPosition;
      lastScrollPosition = currentScroll;
      
      // Check if we're near the top (within 200px)
      if (scrollingUp && currentScroll < 200) {
        const messages = getAllMessages();
        const visibleCount = messages.filter(m => !hiddenMessages.has(m)).length;
        
        // If we have hidden messages and user is scrolling to top
        if (hiddenMessages.size > 0) {
          debug("User scrolled to top, auto-expanding messages...");
          const newKeepN = Math.min(messages.length, state.keepN + 10);
          
          if (newKeepN > state.keepN) {
            isAutoExpanded = true;
            updateKeepN(newKeepN);
          }
        }
      }
    }, 150); // Debounce scroll events
  }, { passive: true });
  
  debug("Scroll detection enabled for auto-expand");
}

// Detect when user sends a new message to reset to original keepN
function setupNewMessageDetection() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    // Check if new messages were added
    const messages = getAllMessages();
    const hadAutoExpanded = isAutoExpanded;
    
    // Look for the textarea/input to detect when user is typing
    const inputArea = document.querySelector('textarea[data-id], textarea#prompt-textarea, div[contenteditable="true"]');
    
    if (inputArea && hadAutoExpanded) {
      // Set up a one-time listener for when they submit
      const checkForNewMessage = () => {
        setTimeout(() => {
          const newMessages = getAllMessages();
          // If message count increased, user sent a message
          if (newMessages.length > messages.length) {
            debug("New message detected, resetting to original keepN:", originalKeepN);
            isAutoExpanded = false;
            updateKeepN(originalKeepN);
          }
        }, 1000);
      };
      
      // Listen for Enter key or button click
      inputArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          checkForNewMessage();
        }
      }, { once: true });
    }
    
    // Also apply pruning when DOM changes
    setTimeout(applyPruning, 500);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
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

// Search functionality
function searchInMessages(query) {
  if (!query || query.length < 2) {
    return { matches: 0, message: "Query too short" };
  }
  
  const messages = getAllMessages();
  const searchLower = query.toLowerCase();
  let matchCount = 0;
  
  debug(`Searching for "${query}" in ${messages.length} messages`);
  
  messages.forEach(msg => {
    const text = msg.textContent || msg.innerText || "";
    const textLower = text.toLowerCase();
    
    if (textLower.includes(searchLower)) {
      matchCount++;
      // Temporarily show the message if it was hidden
      if (hiddenMessages.has(msg)) {
        msg.style.display = '';
        msg.style.opacity = '';
        msg.style.maxHeight = '';
        msg.style.backgroundColor = 'rgba(255, 255, 0, 0.1)'; // Highlight
        
        // Scroll to first match
        if (matchCount === 1) {
          setTimeout(() => {
            msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    }
  });
  
  debug(`Found ${matchCount} matches for "${query}"`);
  
  if (matchCount > 0) {
    // Update the keepN to show all matches
    const visibleNeeded = messages.length - Array.from(hiddenMessages).filter(msg => {
      const text = msg.textContent || msg.innerText || "";
      return !text.toLowerCase().includes(searchLower);
    }).length;
    
    if (visibleNeeded > state.keepN) {
      updateKeepN(visibleNeeded);
    } else {
      updatePill();
    }
  }
  
  return { matches: matchCount };
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
      
    case "getStats":
      const messages = getAllMessages();
      const visible = messages.filter(m => !hiddenMessages.has(m)).length;
      sendResponse({
        visible: visible,
        archived: hiddenMessages.size,
        total: messages.length
      });
      return true;
      
    case "searchArchive":
      const result = searchInMessages(msg.query);
      sendResponse(result);
      return true;
      
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
