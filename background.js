chrome.runtime.onInstalled.addListener(() => {
  // Create a context menu item.
  chrome.contextMenus.create({
    id: "manual-save-form",
    title: "手動儲存表單內容",
    contexts: ["page"] // Show on any page
  });
});

// Listener for when the user clicks on the context menu item.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "manual-save-form") {
    // Send a message to the content script in the active tab.
    chrome.tabs.sendMessage(tab.id, { action: "manual_save_trigger" });
  }
});