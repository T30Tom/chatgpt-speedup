const settingsKey = "chat_pruner_settings";

// Default configurations
const DEFAULTS = {
  keepN: 5,
  mode: "storage",
  storageCap: 200,
  debugLogs: false,
  autoCollapse: false,
  pillEnabled: true,
  theme: "auto", // "auto", "light", "dark"
  selectors: {
    message: "li[data-message-author-role], [data-testid*='conversation-turn']",
    content: ".markdown-content, .content",
    roleAttr: "data-message-author-role"
  }
};

// Apply theme to popup
function applyTheme(theme) {
  if (theme === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

async function getSettings() {
  const { [settingsKey]: s } = await chrome.storage.sync.get(settingsKey);
  return { ...DEFAULTS, ...s };
}

async function setSettings(newSettings) {
  await chrome.storage.sync.set({ [settingsKey]: newSettings });
}

async function sendMessage(tabId, message) {
  return new Promise((resolve) => {
    // First check if the tab exists and is valid
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        resolve({ error: 'Tab not found' });
        return;
      }
      
      // Check if it's a valid ChatGPT page
      if (!tab.url?.match(/^https:\/\/(chat\.openai\.com|chatgpt\.com)/)) {
        resolve({ error: 'Not a ChatGPT page' });
        return;
      }
      
      // Try to send the message
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Message error:', chrome.runtime.lastError.message);
          // If content script is not ready, return a specific error
          if (chrome.runtime.lastError.message.includes('Could not establish connection') ||
              chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
            resolve({ error: 'Content script not ready. Please refresh the page.' });
          } else {
            resolve({ error: chrome.runtime.lastError.message });
          }
          return;
        }
        resolve(response || { ok: true });
      });
    });
  });
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  
  if (!tab?.url?.match(/^https:\/\/(chat\.openai\.com|chatgpt\.com)/)) {
    return null;
  }
  return tab;
}

async function updateStats() {
  const tab = await getCurrentTab();
  if (!tab?.id) return;

  const stats = await sendMessage(tab.id, { type: "getStats" });
  const statsEl = document.getElementById("conversation-stats");
  
  if (!statsEl) return;
  
  if (stats.error) {
    if (stats.error.includes('not ready')) {
      statsEl.innerHTML = `
        <div style="color: #999;">
          Content script not loaded.<br>
          <button id="refreshPageBtn" style="margin-top:4px;padding:4px 8px;font-size:11px;">Refresh Page</button>
        </div>
      `;
      const refreshBtn = document.getElementById('refreshPageBtn');
      if (refreshBtn) {
        refreshBtn.onclick = async () => {
          await chrome.tabs.reload(tab.id);
          window.close();
        };
      }
    } else {
      statsEl.innerHTML = `<div style="color: #999;">Stats unavailable</div>`;
    }
    return;
  }

  statsEl.innerHTML = `
    This conversation:<br>
    <strong>${stats.visible || 0}</strong> messages visible / <strong>${stats.total || 0}</strong> total<br>
    <strong>${stats.archived || 0}</strong> in archive
  `;
}

function showMessage(message, isError = true) {
  const msgDiv = document.createElement('div');
  msgDiv.style.cssText = isError 
    ? 'background:#fee;color:#c00;padding:8px;margin:8px 0;border-radius:4px;font-size:12px'
    : 'background:#efe;color:#080;padding:8px;margin:8px 0;border-radius:4px;font-size:12px';
  msgDiv.textContent = message;
  document.body.insertBefore(msgDiv, document.body.firstChild);
  
  setTimeout(() => msgDiv.remove(), 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on a valid page
  const tab = await getCurrentTab();
  if (!tab) {
    document.body.innerHTML = `
      <div style="padding: 16px; text-align: center;">
        <h3 style="margin:0 0 8px;">ChatGPT Speedup</h3>
        <p style="color: #666;">
          Please open this popup while on<br>
          chat.openai.com or chatgpt.com
        </p>
      </div>
    `;
    return;
  }

  // Load settings and apply theme
  const s = await getSettings();
  applyTheme(s.theme || 'auto');

  // Get all elements
  const elements = {
    keepN: document.getElementById("keepN"),
    mode: document.getElementById("mode"),
    storageCap: document.getElementById("storageCap"),
    apply: document.getElementById("apply"),
    refreshTabs: document.getElementById("refreshTabs"),
    exportArchive: document.getElementById("exportArchive"),
    importArchive: document.getElementById("importArchive"),
    clearArchive: document.getElementById("clearArchive"),
    importFile: document.getElementById("importFile"),
    debugLogs: document.getElementById("debugLogs"),
    autoCollapse: document.getElementById("autoCollapse"),
    pillEnabled: document.getElementById("pillEnabled"),
    themeSelect: document.getElementById("themeSelect"),
    searchBtn: document.getElementById("searchBtn"),
    searchNextBtn: document.getElementById("searchNextBtn"),
    searchPrevBtn: document.getElementById("searchPrevBtn"),
    searchArchive: document.getElementById("searchArchive"),
    searchResults: document.getElementById("searchResults"),
    conversationStats: document.getElementById("conversation-stats")
  };

  // Set values from settings
  if (elements.keepN) elements.keepN.value = s.keepN;
  if (elements.mode) elements.mode.value = s.mode;
  if (elements.storageCap) elements.storageCap.value = s.storageCap;
  if (elements.debugLogs) elements.debugLogs.checked = s.debugLogs;
  if (elements.autoCollapse) elements.autoCollapse.checked = s.autoCollapse;
  if (elements.pillEnabled) elements.pillEnabled.checked = s.pillEnabled !== false;
  if (elements.themeSelect) elements.themeSelect.value = s.theme || 'auto';

  // Theme change handler
  if (elements.themeSelect) {
    elements.themeSelect.addEventListener('change', async () => {
      const theme = elements.themeSelect.value;
      applyTheme(theme);
      await setSettings({ ...s, theme });
    });
  }

  // Watch for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (elements.themeSelect?.value === 'auto') {
      applyTheme('auto');
    }
  });

  // Update stats
  updateStats();
  const statsInterval = setInterval(updateStats, 2000);

  // Apply button
  if (elements.apply) {
    elements.apply.addEventListener("click", async () => {
      try {
        const settings = {
          keepN: Math.max(1, parseInt(elements.keepN?.value, 10) || DEFAULTS.keepN),
          mode: elements.mode?.value === "hidden" ? "hidden" : "storage",
          storageCap: Math.max(50, parseInt(elements.storageCap?.value, 10) || DEFAULTS.storageCap),
          debugLogs: elements.debugLogs?.checked || false,
          autoCollapse: elements.autoCollapse?.checked || false,
          pillEnabled: elements.pillEnabled?.checked !== false,
          theme: elements.themeSelect?.value || 'auto',
          selectors: DEFAULTS.selectors
        };
        
        await setSettings(settings);
        
        if (tab?.id) {
          const response = await sendMessage(tab.id, { type: "applySettings" });
          if (response?.error) {
            if (response.error.includes('not ready')) {
              showMessage('Content script not loaded. Please refresh the page.');
            } else {
              showMessage('Error: ' + response.error);
            }
          } else {
            showMessage('Settings applied!', false);
            updateStats();
          }
        }
      } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message);
      }
    });
  }

  // Refresh tabs button
  if (elements.refreshTabs) {
    elements.refreshTabs.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "refreshAllChatTabs" }, () => {
        showMessage('Refresh request sent', false);
      });
    });
  }

  // Export button
  if (elements.exportArchive) {
    elements.exportArchive.addEventListener("click", async () => {
      if (!tab?.id) return;

      const archive = await sendMessage(tab.id, { type: "exportArchive" });
      if (archive?.error) {
        showMessage('Export failed: ' + archive.error);
        return;
      }

      const date = new Date().toISOString().split("T")[0];
      downloadJson(archive, `chatgpt-archive-${date}.json`);
      showMessage('Archive exported!', false);
    });
  }

  // Import button
  if (elements.importArchive && elements.importFile) {
    elements.importArchive.addEventListener("click", () => {
      elements.importFile.click();
    });

    elements.importFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const archive = JSON.parse(e.target.result);
          if (!tab?.id) return;

          const result = await sendMessage(tab.id, { type: "importArchive", archive });
          if (result?.error) {
            showMessage("Import failed: " + result.error);
          } else {
            updateStats();
            showMessage('Archive imported!', false);
          }
        } catch (err) {
          showMessage("Import error: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Clear button
  if (elements.clearArchive) {
    elements.clearArchive.addEventListener("click", async () => {
      if (!confirm("Clear the current conversation archive?")) return;
      
      if (!tab?.id) return;

      const result = await sendMessage(tab.id, { type: "clearArchive" });
      if (result?.error) {
        showMessage("Clear failed: " + result.error);
      } else {
        updateStats();
        showMessage('Archive cleared!', false);
      }
    });
  }

  // Search functionality
  if (elements.searchBtn && elements.searchArchive) {
    function updateSearchResults(result) {
      if (!elements.searchResults) return;
      
      if (result?.error) {
        elements.searchResults.textContent = "Error: " + result.error;
        elements.searchResults.style.color = "#c00";
      } else if (result?.total > 0) {
        elements.searchResults.textContent = `Match ${result.currentIndex} of ${result.total}`;
        elements.searchResults.style.color = "#080";
      } else if (result?.total === 0) {
        elements.searchResults.textContent = "No matches found";
        elements.searchResults.style.color = "#999";
      } else {
        elements.searchResults.textContent = "";
      }
    }

    async function performSearch() {
      const query = elements.searchArchive.value.trim();
      if (!query || !tab?.id) {
        updateSearchResults({ total: 0 });
        return;
      }

      elements.searchBtn.textContent = "⌛";
      const result = await sendMessage(tab.id, { 
        type: "searchArchive", 
        query 
      });
      elements.searchBtn.textContent = "🔍";

      updateSearchResults(result);
    }

    async function searchNext() {
      if (!tab?.id) return;
      const result = await sendMessage(tab.id, { type: "searchNext" });
      updateSearchResults(result);
    }

    async function searchPrev() {
      if (!tab?.id) return;
      const result = await sendMessage(tab.id, { type: "searchPrev" });
      updateSearchResults(result);
    }

    elements.searchBtn.addEventListener("click", performSearch);
    elements.searchNextBtn?.addEventListener("click", searchNext);
    elements.searchPrevBtn?.addEventListener("click", searchPrev);
    
    elements.searchArchive.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        performSearch();
      } else if (e.key === "Escape") {
        // Clear search
        elements.searchArchive.value = "";
        updateSearchResults({ total: 0 });
        if (tab?.id) {
          sendMessage(tab.id, { type: "clearSearch" });
        }
      }
    });

    // Clear search when input is cleared
    elements.searchArchive.addEventListener("input", (e) => {
      if (!e.target.value.trim()) {
        updateSearchResults({ total: 0 });
        if (tab?.id) {
          sendMessage(tab.id, { type: "clearSearch" });
        }
      }
    });
  }

  // Cleanup on unload
  window.addEventListener('unload', () => {
    clearInterval(statsInterval);
  });
});