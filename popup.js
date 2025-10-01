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

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
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
  
  // Update individual stat elements
  const statVisible = document.getElementById('stat-visible');
  const statTotal = document.getElementById('stat-total');
  const statArchived = document.getElementById('stat-archived');
  const statPercent = document.getElementById('stat-percent');
  const statMemory = document.getElementById('stat-memory');
  
  if (stats.error) {
    if (statVisible) statVisible.textContent = 'N/A';
    if (statTotal) statTotal.textContent = 'N/A';
    if (statArchived) statArchived.textContent = 'N/A';
    if (statPercent) statPercent.textContent = 'N/A';
    if (statMemory) statMemory.textContent = 'N/A';
    return;
  }

  const visible = stats.visible || 0;
  const total = stats.total || 0;
  const archived = stats.archived || 0;
  const archivedPercent = total > 0 ? Math.round((archived / total) * 100) : 0;
  const memorySaved = total > 0 ? Math.round((archived / total) * 100) : 0;
  
  if (statVisible) statVisible.textContent = visible.toString();
  if (statTotal) statTotal.textContent = total.toString();
  if (statArchived) statArchived.textContent = `${archived} (${archivedPercent}%)`;
  if (statPercent) statPercent.textContent = `${archivedPercent}%`;
  if (statMemory) statMemory.textContent = `~${memorySaved}%`;
}

function showMessage(message, isError = true) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message-notification ${isError ? 'error' : 'success'}`;
  msgDiv.textContent = message;
  document.body.appendChild(msgDiv);
  
  setTimeout(() => msgDiv.remove(), 3000);
}

// Collapsible sections
function setupCollapsibleSections() {
  const sectionHeaders = document.querySelectorAll('.section-header');
  
  sectionHeaders.forEach(header => {
    // Click handler for entire header
    header.addEventListener('click', (e) => {
      // Prevent event bubbling to parent elements
      e.stopPropagation();
      
      const sectionName = header.getAttribute('data-section');
      const content = document.getElementById(`${sectionName}-content`);
      
      if (content) {
        const isCurrentlyCollapsed = content.classList.contains('collapsed');
        
        // Toggle collapsed state
        if (isCurrentlyCollapsed) {
          content.classList.remove('collapsed');
          header.classList.remove('collapsed');
        } else {
          content.classList.add('collapsed');
          header.classList.add('collapsed');
        }
        
        // Save collapse state (true = expanded, false = collapsed)
        const collapseState = JSON.parse(localStorage.getItem('sectionCollapseState') || '{}');
        collapseState[sectionName] = !isCurrentlyCollapsed; // Save expanded state
        localStorage.setItem('sectionCollapseState', JSON.stringify(collapseState));
      }
    });
  });
  
  // Restore collapse state on load (default to all expanded)
  const collapseState = JSON.parse(localStorage.getItem('sectionCollapseState') || '{}');
  
  // If no saved state, keep everything expanded (default)
  // Only collapse if explicitly saved as collapsed (false)
  sectionHeaders.forEach(header => {
    const sectionName = header.getAttribute('data-section');
    const content = document.getElementById(`${sectionName}-content`);
    
    // If saved state is false (collapsed), apply collapsed state
    if (collapseState[sectionName] === false) {
      if (content) {
        content.classList.add('collapsed');
        header.classList.add('collapsed');
      }
    }
    // Otherwise keep expanded (default state from HTML)
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Setup collapsible sections
  setupCollapsibleSections();
  
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
    presetProfile: document.getElementById("presetProfile"),
    keepN: document.getElementById("keepN"),
    keepNPreset: document.getElementById("keepNPreset"),
    mode: document.getElementById("mode"),
    storageCap: document.getElementById("storageCap"),
    exportArchive: document.getElementById("exportArchive"),
    exportMenu: document.getElementById("exportMenu"),
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
    regexSearch: document.getElementById("regexSearch"),
    searchFilter: document.getElementById("searchFilter"),
    conversationStats: document.getElementById("conversation-stats")
  };

  // Auto-apply function
  async function autoApplySettings() {
    try {
      const settings = {
        keepN: Math.max(1, parseInt(elements.keepN?.value, 10) || s.keepN),
        mode: elements.mode?.value === "hidden" ? "hidden" : "storage",
        storageCap: Math.max(50, parseInt(elements.storageCap?.value, 10) || s.storageCap),
        debugLogs: elements.debugLogs?.checked || false,
        autoCollapse: elements.autoCollapse?.checked || false,
        pillEnabled: elements.pillEnabled?.checked !== false,
        theme: elements.themeSelect?.value || 'auto',
        selectors: DEFAULTS.selectors
      };
      
      await setSettings(settings);
      
      if (tab?.id) {
        await sendMessage(tab.id, { type: "applySettings" });
        updateStats();
      }
    } catch (error) {
      console.error('Auto-apply error:', error);
    }
  }

  // Set values from settings
  if (elements.keepN) elements.keepN.value = s.keepN;
  if (elements.mode) elements.mode.value = s.mode;
  if (elements.storageCap) elements.storageCap.value = s.storageCap;
  if (elements.debugLogs) elements.debugLogs.checked = s.debugLogs;
  if (elements.autoCollapse) elements.autoCollapse.checked = s.autoCollapse;
  if (elements.pillEnabled) elements.pillEnabled.checked = s.pillEnabled !== false;
  if (elements.themeSelect) elements.themeSelect.value = s.theme || 'auto';

  // Profile presets
  const PRESETS = {
    performance: { keepN: 5, mode: 'hidden' },
    research: { keepN: 50, mode: 'storage' },
    full: { keepN: 999999, mode: 'storage' }
  };

  if (elements.presetProfile) {
    elements.presetProfile.addEventListener('change', () => {
      const preset = elements.presetProfile.value;
      if (preset && PRESETS[preset]) {
        const config = PRESETS[preset];
        elements.keepN.value = config.keepN;
        elements.mode.value = config.mode;
        elements.keepNPreset.value = '';
        autoApplySettings();
      }
    });
  }

  // keepN preset dropdown handler with auto-apply
  if (elements.keepNPreset) {
    elements.keepNPreset.addEventListener('change', () => {
      const value = elements.keepNPreset.value;
      if (value) {
        elements.keepN.value = value;
        elements.presetProfile.value = ''; // Clear profile preset
        autoApplySettings();
      }
    });
    
    // Update preset dropdown when keepN changes manually and auto-apply
    elements.keepN.addEventListener('change', () => {
      const currentValue = elements.keepN.value;
      const presetOptions = ['10', '50', '100', '999999'];
      if (presetOptions.includes(currentValue)) {
        elements.keepNPreset.value = currentValue;
      } else {
        elements.keepNPreset.value = '';
      }
      elements.presetProfile.value = ''; // Clear profile preset
      autoApplySettings();
    });
  }

  // Auto-apply on all setting changes (clear profile preset on manual changes)
  if (elements.mode) {
    elements.mode.addEventListener('change', () => {
      elements.presetProfile.value = ''; // Clear profile preset
      autoApplySettings();
    });
  }
  if (elements.storageCap) {
    elements.storageCap.addEventListener('change', autoApplySettings);
  }
  if (elements.debugLogs) {
    elements.debugLogs.addEventListener('change', autoApplySettings);
  }
  if (elements.autoCollapse) {
    elements.autoCollapse.addEventListener('change', autoApplySettings);
  }
  if (elements.pillEnabled) {
    elements.pillEnabled.addEventListener('change', autoApplySettings);
  }

  // Theme change handler with auto-apply
  if (elements.themeSelect) {
    elements.themeSelect.addEventListener('change', async () => {
      const theme = elements.themeSelect.value;
      applyTheme(theme);
      await autoApplySettings();
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

  // Export button with dropdown menu
  if (elements.exportArchive && elements.exportMenu) {
    // Toggle dropdown menu
    elements.exportArchive.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = elements.exportMenu.style.display === 'block';
      elements.exportMenu.style.display = isVisible ? 'none' : 'block';
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
      if (elements.exportMenu) {
        elements.exportMenu.style.display = 'none';
      }
    });

    // Handle export format selection
    const exportOptions = document.querySelectorAll('.export-option');
    exportOptions.forEach(option => {
      option.addEventListener('click', async (e) => {
        e.stopPropagation();
        const format = option.getAttribute('data-format');
        elements.exportMenu.style.display = 'none';

        if (!tab?.id) return;

        // Get all messages
        const result = await sendMessage(tab.id, { type: "getAllMessagesForExport" });
        if (result?.error) {
          showMessage('Export failed: ' + result.error);
          return;
        }

        const messages = result.messages || [];
        const date = new Date().toISOString().split("T")[0];
        const filename = `chatgpt-conversation-${date}`;

        // Export based on format
        switch (format) {
          case 'json':
            downloadJson({ messages, exportDate: new Date().toISOString(), messageCount: messages.length }, `${filename}.json`);
            showMessage('Exported as JSON!', false);
            break;

          case 'markdown':
            const markdown = messages.map((msg, idx) => {
              const role = idx % 2 === 0 ? '**You:**' : '**ChatGPT:**';
              return `${role}\n\n${msg}\n\n---\n`;
            }).join('\n');
            downloadText(markdown, `${filename}.md`);
            showMessage('Exported as Markdown!', false);
            break;

          case 'txt':
            const text = messages.map((msg, idx) => {
              const role = idx % 2 === 0 ? 'You:' : 'ChatGPT:';
              return `${role}\n${msg}\n\n${'='.repeat(60)}\n`;
            }).join('\n');
            downloadText(text, `${filename}.txt`);
            showMessage('Exported as Text!', false);
            break;

          case 'html':
            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ChatGPT Conversation - ${date}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f5f5f5; }
    .role { font-weight: bold; margin-bottom: 8px; }
    .content { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>ChatGPT Conversation</h1>
  <p>Exported: ${new Date().toLocaleDateString()}</p>
  ${messages.map((msg, idx) => {
    const isUser = idx % 2 === 0;
    return `<div class="message ${isUser ? 'user' : 'assistant'}">
      <div class="role">${isUser ? 'You' : 'ChatGPT'}</div>
      <div class="content">${msg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>`;
  }).join('\n')}
</body>
</html>`;
            downloadText(html, `${filename}.html`);
            showMessage('Exported as HTML!', false);
            break;
        }
      });
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

      const useRegex = elements.regexSearch?.checked || false;
      const filter = elements.searchFilter?.value || '';

      elements.searchBtn.textContent = "⌛";
      const result = await sendMessage(tab.id, { 
        type: "searchArchive", 
        query,
        useRegex,
        filter
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