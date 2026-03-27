// Configuration
const API_ENDPOINT = "https://jargonbridge-api-12345.azurewebsites.net/translate";
const STORAGE_KEYS = {
  HISTORY: "jb_history",
  DARK_MODE: "jb_dark_mode",
  SAVE_HISTORY: "jb_save_history"
};

// DOM Elements
const inputBox = document.getElementById("input");
const outputBox = document.getElementById("output");
const translateBtn = document.getElementById("translateBtn");
const copyBtn = document.getElementById("copyBtn");
const errorMsg = document.getElementById("errorMsg");
const outputSection = document.getElementById("outputSection");
const modeSelect = document.getElementById("modeSelect");
const charCount = document.getElementById("charCount");

// Tab elements
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Settings elements
const darkModeToggle = document.getElementById("darkModeToggle");
const saveHistoryToggle = document.getElementById("saveHistoryToggle");
const apiEndpointInput = document.getElementById("apiEndpoint");
const testApiBtn = document.getElementById("testApiBtn");
const apiStatus = document.getElementById("apiStatus");

// History elements
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeExtension();
  setupEventListeners();
  loadSettings();
  loadHistory();
  autoFillText();
});

// Initialize extension
function initializeExtension() {
  apiEndpointInput.value = API_ENDPOINT;
}

// Setup event listeners
function setupEventListeners() {
  // Translate button
  translateBtn.addEventListener("click", handleTranslate);

  // Copy button
  copyBtn.addEventListener("click", () => {
    const text = outputBox.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    });
  });

  // Character counter
  inputBox.addEventListener("input", () => {
    charCount.textContent = inputBox.value.length;
  });

  // Tab navigation
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });

  // Settings
  darkModeToggle.addEventListener("change", toggleDarkMode);
  saveHistoryToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SAVE_HISTORY]: e.target.checked });
  });

  // Test API
  testApiBtn.addEventListener("click", testApiConnection);

  // Clear history
  clearHistoryBtn.addEventListener("click", clearHistory);

  // Allow Enter key to translate
  inputBox.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      handleTranslate();
    }
  });
}

// Handle translation
async function handleTranslate() {
  const text = inputBox.value.trim();

  if (!text) {
    showError("Please enter text to translate");
    return;
  }

  if (text.length > 500) {
    showError("Text is too long. Maximum 500 characters.");
    return;
  }

  hideError();
  showLoading(true);

  try {
    // Modify prompt based on selected mode
    let modifiedText = text;
    const mode = modeSelect.value;

    if (mode === "executive") {
      modifiedText = `${text}\n\n[Format as an executive summary - max 2-3 sentences]`;
    } else if (mode === "detailed") {
      modifiedText = `${text}\n\n[Provide a detailed explanation with examples if possible]`;
    }

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: modifiedText })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.result;

    // Display result
    outputBox.innerHTML = result.replace(/\n/g, "<br>");
    outputSection.style.display = "block";

    // Save to history
    saveToHistory(text, result);

    showLoading(false);
  } catch (err) {
    console.error("ERROR:", err);
    showError("Failed to connect to backend. Check your connection and try again.");
    showLoading(false);
  }
}

// Show loading state
function showLoading(isLoading) {
  const spinner = document.getElementById("spinner");
  const btnText = document.getElementById("btnText");

  if (isLoading) {
    translateBtn.disabled = true;
    spinner.style.display = "inline-block";
    btnText.textContent = "Translating";
  } else {
    translateBtn.disabled = false;
    spinner.style.display = "none";
    btnText.textContent = "Translate";
  }
}

// Error handling
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

function hideError() {
  errorMsg.style.display = "none";
}

// Tab switching
function switchTab(tabName) {
  // Remove active from all tabs and contents
  tabBtns.forEach((btn) => btn.classList.remove("active"));
  tabContents.forEach((content) => content.classList.remove("active"));

  // Add active to selected tab and content
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(tabName).classList.add("active");
}

// Settings
function loadSettings() {
  chrome.storage.local.get(
    [STORAGE_KEYS.DARK_MODE, STORAGE_KEYS.SAVE_HISTORY],
    (items) => {
      if (items[STORAGE_KEYS.DARK_MODE]) {
        document.body.classList.add("dark-mode");
        darkModeToggle.checked = true;
      }

      if (items[STORAGE_KEYS.SAVE_HISTORY] !== undefined) {
        saveHistoryToggle.checked = items[STORAGE_KEYS.SAVE_HISTORY];
      } else {
        saveHistoryToggle.checked = true;
      }
    }
  );
}

function toggleDarkMode(e) {
  const isDarkMode = e.target.checked;
  if (isDarkMode) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
  chrome.storage.local.set({ [STORAGE_KEYS.DARK_MODE]: isDarkMode });
}

// Test API connection
async function testApiConnection() {
  testApiBtn.disabled = true;
  apiStatus.textContent = "Testing...";
  apiStatus.classList.remove("success", "error");

  try {
    const response = await fetch(API_ENDPOINT.replace("/translate", "/health"), {
      method: "GET"
    });

    if (response.ok) {
      apiStatus.textContent = "✓ Connection successful!";
      apiStatus.classList.add("success");
    } else {
      throw new Error("API returned error");
    }
  } catch (err) {
    apiStatus.textContent = "✗ Connection failed. Check your endpoint.";
    apiStatus.classList.add("error");
  }

  testApiBtn.disabled = false;
}

// History management
function saveToHistory(input, output) {
  chrome.storage.local.get([STORAGE_KEYS.SAVE_HISTORY], (items) => {
    if (items[STORAGE_KEYS.SAVE_HISTORY] === false) return;

    const timestamp = new Date();
    const historyEntry = {
      id: Date.now(),
      input: input.substring(0, 100),
      output: output,
      timestamp: timestamp.toLocaleString()
    };

    chrome.storage.local.get([STORAGE_KEYS.HISTORY], (items) => {
      let history = items[STORAGE_KEYS.HISTORY] || [];
      history.unshift(historyEntry);
      history = history.slice(0, 50); // Keep only last 50

      chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
    });
  });
}

function loadHistory() {
  chrome.storage.local.get([STORAGE_KEYS.HISTORY], (items) => {
    const history = items[STORAGE_KEYS.HISTORY] || [];

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-history">No history yet</div>';
      clearHistoryBtn.style.display = "none";
      return;
    }

    clearHistoryBtn.style.display = "block";
    historyList.innerHTML = history
      .map(
        (entry) => `
      <div class="history-item" onclick="loadHistoryItem(${entry.id})">
        <div class="history-item-text">${escapeHtml(entry.input)}</div>
        <div class="history-item-time">${entry.timestamp}</div>
      </div>
    `
      )
      .join("");
  });
}

function loadHistoryItem(id) {
  chrome.storage.local.get([STORAGE_KEYS.HISTORY], (items) => {
    const history = items[STORAGE_KEYS.HISTORY] || [];
    const entry = history.find((e) => e.id === id);

    if (entry) {
      switchTab("translator");
      inputBox.value = entry.input;
      outputBox.innerHTML = entry.output.replace(/\n/g, "<br>");
      outputSection.style.display = "block";
      charCount.textContent = entry.input.length;
    }
  });
}

function clearHistory() {
  if (confirm("Are you sure you want to clear all history?")) {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
    loadHistory();
  }
}

// Auto-fill selected text
function autoFillText() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: () => window.getSelection().toString()
      },
      (results) => {
        if (results && results[0] && results[0].result) {
          const selectedText = results[0].result;
          if (selectedText.length > 0) {
            inputBox.value = selectedText;
            charCount.textContent = selectedText.length;
          }
        }
      }
    );
  });
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}