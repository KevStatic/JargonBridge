// Service Worker for Jargon Bridge
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for translating selected text
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate with Jargon Bridge",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-selection") {
    // Open popup with the selected text
    chrome.action.openPopup();

    // Store the selected text to be used by popup
    chrome.storage.local.set({
      selectedText: info.selectionText
    });
  }
});

// In text detector for JargonBridge
let latestSelectedText = "";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TEXT_SELECTED") {
    latestSelectedText = message.text;

    chrome.storage.local.set({
      selectedText: latestSelectedText
    });
  }
});