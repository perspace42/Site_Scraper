/*
Author: Scott Field
Date: 10/17/2025
Purpose:
listen for user input and receive data from the browser pages DOM.
*/

// Prevent double initialization if script is injected multiple times
if (window.isSelectingInitialized != true) {
  window.isSelectingInitialized = true;

  // Global Variables
  let isSelecting = false;
  let previousElement = null;

  // Compute XPath of element
  function getXPath(element) {
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentNode;

    if (element === document.body) {
      return '/html/body';
    }

    const idx = (sib, name) => {
      let count = 1;
      for (let sibling = sib.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === 1 && sibling.tagName === name) {
          count++;
        }
      }
      return count;
    };

    let index = '';
    if (parent) {
      index = `[${idx(element, tagName)}]`;
    }

    const parentPath = parent ? getXPath(parent) : '';

    return `${parentPath}/${tagName}${index}`;
  }

  // Clear previously highlighted element
  function clearHighlight() {
    if (previousElement) {
      previousElement.style.outline = '';
      previousElement.style.cursor = '';
      previousElement = null;
    }
  }

  // Highlight element on mouseover
  function onMouseOver(event) {
    if (!isSelecting) return;

    if (previousElement && previousElement !== event.target) {
      previousElement.style.outline = '';
      previousElement.style.cursor = '';
    }

    previousElement = event.target;
    previousElement.style.outline = '2px solid red';
    previousElement.style.cursor = 'copy'; //possibly change to custom cursor later
  }

  // On element click send XPath message
  function onClick(event) {
    if (!isSelecting) return;

    event.preventDefault();
    event.stopPropagation();

    clearHighlight();

    const clickedElement = event.target;
    const xPath = getXPath(clickedElement);

    chrome.runtime.sendMessage({ type: 'elementClicked', path: xPath });

    console.log('Selected element XPath:', xPath);
  }

  // Start selection mode
  function startSelection() {
    if (isSelecting) return;
    isSelecting = true;
    console.log('Selection mode started');
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('click', onClick, true);
  }

  // Stop selection mode
  function stopSelection() {
    if (!isSelecting) return;
    isSelecting = false;
    console.log('Selection mode stopped');
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('click', onClick, true);
    clearHighlight();
  }

  // Listen for messages to start/stop selection
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.type === 'startSelection') {
      console.log('Starting selection mode');
      startSelection();
      sendResponse({ status: 'started' });
    } else if (request.type === 'stopSelection') {
        console.log('Stopping selection mode');
        stopSelection();
        sendResponse({ status: 'stopped' });
    }
    return true;
  });
}
