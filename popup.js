const settingsKey = "chat_pruner_settings";

// Default selector configurations
const DEFAULTS = {
  keepN: 5,
  mode: "storage",
  storageCap: 200,
  debugLogs: false,
  autoCollapse: false,
  selectors: {
    message: "li[data-message-author-role], [data-testid*='conversation-turn']",
    content: ".markdown-content, .content",
    roleAttr: "data-message-author-role"
  }
};

async function getSettings() {
  const { [settingsKey]: s } = await chrome.storage.sync.get(settingsKey);
  return s || { ...DEFAULTS };
}

async function setSettings(newSettings) {
  await chrome.storage.sync.set({ [settingsKey]: newSettings });
}

async function sendMessage(tabId, message) {
  try {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Message error:', chrome.runtime.lastError.message);
          resolve({ error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: true });
      });
    });
  } catch (err) {
    console.error('Send message error:', err);
    return { error: err.message };
  }
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
    document.body.innerHTML = `
      <div style="padding: 16px; color: #666;">
        Please open this popup while on chat.openai.com or chatgpt.com
      </div>
    `;
    return null;
  }
  return tab;
}

async function updateStats() {
  const tab = await getCurrentTab();
  if (!tab?.id) return;

  const stats = await sendMessage(tab.id, { type: "getStats" });
  if (!stats || stats.error) return;

  const statsEl = document.getElementById("conversation-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      This conversation:<br>
      ${stats.visible || 0} messages visible / ${stats.total || 0} total<br>
      ${stats.archived || 0} in archive
    `;
  }
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
    searchBtn: document.getElementById("searchBtn"),
    searchArchive: document.getElementById("searchArchive"),
    conversationStats: document.getElementById("conversation-stats")
  };

  // Add conversation stats element if missing
  if (!elements.conversationStats) {
    const statsDiv = document.createElement('div');
    statsDiv.id = 'conversation-stats';
    statsDiv.className = 'muted';
    statsDiv.style.margin = '12px 0';
    statsDiv.style.padding = '8px';
    statsDiv.style.background = '#f9f9f9';
    statsDiv.style.borderRadius = '6px';
    statsDiv.innerHTML = 'Loading stats...';
    document.querySelector('.search-container').after(statsDiv);
  }

  // Add archive management buttons if missing
  if (!elements.exportArchive) {
    const archiveDiv = document.createElement('div');
    archiveDiv.className = 'row';
    archiveDiv.style.marginTop = '12px';
    archiveDiv.innerHTML = `
      <button id="exportArchive" title="Export archived messages">Export</button>
      <button id="importArchive" title="Import archived messages">Import</button>
      <button id="clearArchive" title="Clear archived messages">Clear</button>
      <input type="file" id="importFile" accept=".json" style="display:none">
    `;
    document.querySelector('.row').after(archiveDiv);
    
    // Re-query elements
    elements.exportArchive = document.getElementById("exportArchive");
    elements.importArchive = document.getElementById("importArchive");
    elements.clearArchive = document.getElementById("clearArchive");
    elements.importFile = document.getElementById("importFile");
  }

  // Load current settings
  const s = await getSettings();
  elements.keepN.value = s.keepN ?? DEFAULTS.keepN;
  elements.mode.value = s.mode ?? DEFAULTS.mode;
  elements.storageCap.value = s.storageCap ?? DEFAULTS.storageCap;
  elements.debugLogs.checked = s.debugLogs ?? DEFAULTS.debugLogs;
  elements.autoCollapse.checked = s.autoCollapse ?? DEFAULTS.autoCollapse;

  // Update stats
  updateStats();
  setInterval(updateStats, 2000);

  // Apply button
  elements.apply.addEventListener("click", async () => {
    try {
      const keepN = Math.max(1, parseInt(elements.keepN.value, 10) || DEFAULTS.keepN);
      const mode = (elements.mode.value === "hidden") ? "hidden" : "storage";
      const storageCap = Math.max(50, parseInt(elements.storageCap.value, 10) || DEFAULTS.storageCap);
      const debugLogs = elements.debugLogs.checked || false;
      const autoCollapse = elements.autoCollapse.checked || false;
      
      const settings = {
        keepN,
        mode,
        storageCap,
        debugLogs,
        autoCollapse,
        selectors: DEFAULTS.selectors
      };
      
      await setSettings(settings);
      const tab = await getCurrentTab();
      
      if (tab?.id) {
        const response = await sendMessage(tab.id, { type: "applySettings" });
        if (response?.error) {
          if (response.error.includes('not exist') || response.error.includes('not ready')) {
            showMessage('Please refresh the ChatGPT page for changes to take effect', false);
          } else {
            showMessage('Error: ' + response.error);
          }
        } else {
          showMessage('Settings applied!', false);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('Error: ' + error.message);
    }
  });

  // Refresh tabs button
  elements.refreshTabs.addEventListener("click", async () => {
    chrome.runtime.sendMessage({ type: "refreshAllChatTabs" }, () => {
      showMessage('Refresh request sent to all ChatGPT tabs', false);
    });
  });

  // Export button
  if (elements.exportArchive) {
    elements.exportArchive.addEventListener("click", async () => {
      const tab = await getCurrentTab();
      if (!tab?.id) return;

      const archive = await sendMessage(tab.id, { type: "exportArchive" });
      if (!archive || archive.error) {
        showMessage('Error exporting archive');
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
          const tab = await getCurrentTab();
          if (!tab?.id) return;

          await sendMessage(tab.id, { type: "importArchive", archive });
          updateStats();
          showMessage('Archive imported!', false);
        } catch (err) {
          showMessage("Error importing: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Clear button
  if (elements.clearArchive) {
    elements.clearArchive.addEventListener("click", async () => {
      if (!confirm("Clear the current conversation archive?")) return;
      
      const tab = await getCurrentTab();
      if (!tab?.id) return;

      await sendMessage(tab.id, { type: "clearArchive" });
      updateStats();
      showMessage('Archive cleared!', false);
    });
  }

  // Search functionality
  if (elements.searchBtn && elements.searchArchive) {
    async function performSearch() {
      const query = elements.searchArchive.value.trim();
      if (!query) return;

      const tab = await getCurrentTab();
      if (!tab?.id) return;

      elements.searchBtn.textContent = "⌛";
      const result = await sendMessage(tab.id, { 
        type: "searchArchive", 
        query 
      });
      elements.searchBtn.textContent = "🔍";

      if (result?.matches > 0) {
        showMessage(`Found ${result.matches} matches`, false);
      } else {
        showMessage('No matches found');
      }
    }

    elements.searchBtn.addEventListener("click", performSearch);
    elements.searchArchive.addEventListener("keydown", (e) => {
      if (e.key === "Enter") performSearch();
    });
  }
});