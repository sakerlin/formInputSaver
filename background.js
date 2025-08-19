chrome.runtime.onInstalled.addListener(() => {
  // Create a context menu item.
  chrome.contextMenus.create({
    id: "manual-save-form",
    title: "手動儲存表單內容",
    contexts: ["page"] // Show on any page
  });
});

// Function to inject content.js
async function injectContentScript(tabId, url) {
  const hostname = new URL(url).hostname;
  const result = await chrome.storage.local.get(['whitelistedSites']);
  const whitelistedSites = result.whitelistedSites || [];

  if (whitelistedSites.includes(hostname)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log(`Injected content.js into ${url}`);
    } catch (e) {
      console.error(`Failed to inject content.js into ${url}: ${e.message}`);
    }
  }
}

// Listen for tab updates and activations to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    injectContentScript(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      injectContentScript(tab.id, tab.url);
    }
  });
});

// Listener for when the user clicks on the context menu item.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "manual-save-form") {
    // Ensure content.js is injected before sending message
    if (tab.url) {
      injectContentScript(tab.id, tab.url).then(() => {
        // Send a message to the content script in the active tab.
        chrome.tabs.sendMessage(tab.id, { action: "manual_save_trigger" });
      });
    }
  }
});
