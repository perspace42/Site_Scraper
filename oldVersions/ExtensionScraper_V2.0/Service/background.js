/*
Author: Scott Field
Date: 10/17/25
Purpose:
Automatically deploy UI Elements when extension is run.
Automatically adds Script to opened Tabs
*/

/*Global Variables*/
let popupID = null;
const injectedTabs = new Set();

/*Script Injection Section*/

// Check if URL is suitable for injection (http or https)
function isInjectableUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

// Inject content script into a given tab, skip chrome-extension pages but inject even if tab has no URL
function injectContentScript(tab) {
  if (!tab) {
    console.log('Skipping injection: tab is undefined.');
    return;
  }
  if (injectedTabs.has(tab.id)){
    console.log(`Skipping injection: tab ${tab.id} already injected.`);
    return;
  }
  if (tab.url && tab.url.startsWith('chrome-extension://')) {
    console.log(`Skipping injection: tab ${tab.id} with URL ${tab.url} is a chrome extension`);
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['Content/select.js'],
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Injection failed in tab ${tab.id}:`, chrome.runtime.lastError.message);
    } else {
      console.log(`Content script injected in tab ${tab.id}`);
      injectedTabs.add(tab.id);
    }
  });
}

// Inject content script into all open tabs on install/startup
function injectIntoAllTabs() {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, tabs => {
    for (const tab of tabs) {
      injectContentScript(tab);
    }
  });
}

// Stop the select.js Script on All Injected Tabs
function stopAllTabScript(){
  for (const tabId of injectedTabs) {
    chrome.tabs.sendMessage(tabId, {
      type: 'stopSelection',
      tabs: Array.from(injectedTabs)
    });
  }
}

chrome.runtime.onInstalled.addListener(injectIntoAllTabs);
chrome.runtime.onStartup.addListener(injectIntoAllTabs);

// Inject script on tab updates when loading is complete and URL is valid http(s) but NOT chrome-extension
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isInjectableUrl(tab.url)) {
    if (tab.url.startsWith('chrome-extension://')) {
      console.log(`Skipping injection for chrome-extension tab: ${tabId}`);
      return;
    }
    injectContentScript(tab);
  }
});

// Inject script on newly created tabs after load finished and after checking URL validity
chrome.tabs.onCreated.addListener(tab => {
  const listener = (tabId, changeInfo, updatedTab) => {
    if (tabId === tab.id && changeInfo.status === 'complete' && isInjectableUrl(updatedTab.url)) {
      if (updatedTab.url.startsWith('chrome-extension://')) {
        console.log(`Skipping injection for chrome-extension tab: ${tabId}`);
      } else {
        injectContentScript(updatedTab);
      }
      chrome.tabs.onUpdated.removeListener(listener);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
});

// Remove closed tabs from the injectedTabs set
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (injectedTabs.has(tabId)) {
    injectedTabs.delete(tabId);
    console.log(`Tab ${tabId} closed and removed from injectedTabs`);
  }
});


/*User Interface Section*/
//type : 'popup', 'panel', 'window'
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL('View/ui.html'),
    type: 'popup',
    width: 400,
    height: 600,
  });
});
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL('View/ui.html'),
    type: 'popup',
    width: 400,
    height: 600,
  }, (window) => {
    popupID = window.id;
  });
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupID) {
    stopAllTabScript();
    console.log('Extension window closed:', windowId);
    popupID = null; // Reset the saved window ID
  }
});
