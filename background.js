// Background: on install/startup, ask open ChatGPT tabs to refresh.
const CHAT_URLS = ["https://chat.openai.com/*", "https://chatgpt.com/*"];

async function promptRefreshAllOpenChatTabs() {
  const tabs = await chrome.tabs.query({
    url: CHAT_URLS
  });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "refreshPrompt" });
    } catch (e) {
      // Content script might not be injected yet; ignore.
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  promptRefreshAllOpenChatTabs();
});

chrome.runtime.onStartup.addListener(() => {
  promptRefreshAllOpenChatTabs();
});

// From popup: refresh all ChatGPT tabs
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "refreshAllChatTabs") {
    promptRefreshAllOpenChatTabs().then(() => sendResponse({ ok: true }));
    return true; // async
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  // Forward command to active tab in active window
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: CHAT_URLS
  });
  
  if (tabs[0]) {
    try {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: "command",
        command: command
      });
    } catch (e) {
      // Content script might not be ready; ignore
    }
  }
});
