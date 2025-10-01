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

function debug(...args) {
  if (state.debugLogs) console.log("[ChatGPT Speedup]", ...args);
}

function settingsKey() {
  return "chat_pruner_settings";
}

async function loadSettings() {
  const { [settingsKey()]: s } = await chrome.storage.sync.get(settingsKey());
  if (s) Object.assign(state, s);
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
      updateKeepN(Math.max(1, current - 5));
    } else {
      updateKeepN(current + 5);
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

function updateKeepN(n) {
  state.keepN = Math.max(1, n);
  saveSettings({ keepN: state.keepN });
  debug(`Setting keepN to ${state.keepN}`);
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
      
      // Set up observer
      if (observer) observer.disconnect();
      observer = new MutationObserver(() => {
        setTimeout(applyPruning, 500);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
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
