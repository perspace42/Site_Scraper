/*
Author: Scott Field
Date: 10/17/2025
Purpose: Dynamically Fill The UI with data received from back end, turns back end Script
on/off
*/

/* Global variables */

let started = false;

/* Functions */

//Function to get the last focused tab that is NOT in an extension window
function getLastFocusedNonExtensionTab(callback) {
  chrome.windows.getLastFocused({ populate: true }, (window) => {
    if (!window || !window.tabs) {
      callback(null);
      return;
    }

    const activeTab = window.tabs.find(tab => tab.active);
    if (activeTab && activeTab.url && !activeTab.url.startsWith('chrome-extension://') &&
        (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
      // Found valid active tab in last focused window
      callback(activeTab);
      return;
    }

    // Last focused window was an extension window or no valid active tab
    // Find last focused normal window with valid active tab
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }, (windows) => {
      // Sort windows descending by focused flag (true > false)
      windows.sort((a, b) => (b.focused === a.focused)? 0 : b.focused? 1 : -1);

      for (const win of windows) {
        const tab = win.tabs.find(t => t.active &&
          t.url && !t.url.startsWith('chrome-extension://') &&
          (t.url.startsWith('http://') || t.url.startsWith('https://')));
        if (tab) {
          callback(tab);
          return;
        }
      }

      // No suitable tab found
      callback(null);
    });
  });
}

/*DOM Element Dependent Code*/

document.addEventListener('DOMContentLoaded', () => {
  const stateBtn = document.getElementById('stateBtn');
  if (!stateBtn) {
    console.error('Element with id "stateBtn" not found!');
    return;
  }

  stateBtn.addEventListener('click', () => {
    getLastFocusedNonExtensionTab((tab) => {
      if (!tab) {
        console.warn('No valid webpage tab found for script injection.');
        return;
      }

      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ['Content/select.js'] },
        () => {
          if (chrome.runtime.lastError) {
            console.error('Script injection failed:', chrome.runtime.lastError.message);
            return;
          }
          if (!started) {
            started = true;
            stateBtn.textContent = 'Stop';
            chrome.tabs.sendMessage(tab.id, { type: 'startSelection' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Message failed:', chrome.runtime.lastError.message);
              } else {
                console.log('Selection started:', response?.status);
              }
            });
          } else {
            started = false;
            stateBtn.textContent = 'Start';
            chrome.tabs.sendMessage(tab.id, { type: 'stopSelection' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Message failed:', chrome.runtime.lastError.message);
              } else {
                console.log('Selection stopped:', response?.status);
              }
            });
          }
        }
      );
    });
  });
  /*
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request, 'from:', sender);
    if (request.type === 'elementClicked') {
      const form = document.getElementById('elementList');
      if (form) {
        const entry = document.createElement('div');
        entry.textContent = `Type: ${request.type}, Path: ${request.path}`;
        container.appendChild(entry);
      }
      sendResponse({ status: 'data received' });
    }
    return false;
  });
  */
  chrome.runtime.onMessage.addListener((request, sender) => {
    console.log('Message received:', request, 'from:', sender);
    if (request.type === 'elementClicked') {
      const form = document.getElementById('elementList');
      if (form) {
        const entry = document.createElement('div');
        entry.textContent = `Type: ${request.type}, Path: ${request.path}`;
        form.appendChild(entry);
      }
    }
  });

/*End of DOM Element Dependent Code*/
});
