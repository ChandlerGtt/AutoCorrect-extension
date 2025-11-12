// content.js – Production version (no worker, minimal logging)

let activeEl = null;
let lastToken = "";
let isEnabled = true;

// Check if autocorrect is enabled for this site
async function checkEnabled() {
  try {
    const host = window.location.hostname;
    const response = await chrome.runtime.sendMessage({ 
      action: 'checkEnabled',
      host 
    });
    isEnabled = response?.enabled ?? true;
  } catch (error) {
    isEnabled = true;
  }
}

// Initialize
checkEnabled();

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled || changes.pausedHosts) {
    checkEnabled();
  }
});

// Helper functions
function getValue(el) {
  if ('value' in el) return el.value;
  if (el.isContentEditable) return el.innerText;
  return null;
}

function setValue(el, newValue) {
  if ('value' in el) {
    el.value = newValue;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el.isContentEditable) {
    el.innerText = newValue;
  }
}

function getCurrentWordRange(el) {
  const text = getValue(el) ?? '';
  let caret = 0;

  if ('selectionStart' in el && el.selectionStart != null) {
    caret = el.selectionStart;
  } else if (el.isContentEditable) {
    caret = text.length;
  }

  const leftMatch = text.slice(0, caret).match(/[A-Za-z]+$/);
  const left = leftMatch ? caret - leftMatch[0].length : caret;

  const rightMatch = text.slice(caret).match(/^[A-Za-z]+/);
  const right = rightMatch ? caret + rightMatch[0].length : caret;

  const token = text.slice(left, right);
  return { token, start: left, end: right, text };
}

function replaceRange(text, start, end, replacement) {
  return text.slice(0, start) + replacement + text.slice(end);
}

// Extract context words (previous words for AI)
function getContextWords(text, position, numWords = 10) {
  const beforeText = text.slice(0, position);
  const words = beforeText.trim().split(/\s+/);
  return words.slice(-numWords).join(' ');
}

// Correct using pre-captured word info
async function correctCapturedWord(el, wordInfo, triggerKey) {
  const token = wordInfo.token;
  
  if (!/^[A-Za-z]+$/.test(token)) {
    insertText(el, triggerKey);
    return;
  }
  
  if (token === lastToken) {
    insertText(el, triggerKey);
    return;
  }
  
  lastToken = token;
  activeEl = el;

  try {
    // Extract context for AI processing
    const context = getContextWords(wordInfo.text, wordInfo.start, 10);
    
    const response = await chrome.runtime.sendMessage({
      action: 'correctWord',
      word: token,
      context: context
    });

    if (response && response.suggestions && response.suggestions.length > 0) {
      const suggestion = response.suggestions[0];
      
      if (suggestion.toLowerCase() !== token.toLowerCase()) {
        const currentText = getValue(el) ?? '';
        const updated = replaceRange(currentText, wordInfo.start, wordInfo.end, suggestion);
        setValue(el, updated);
        
        if ('selectionStart' in el) {
          const pos = wordInfo.start + suggestion.length;
          el.selectionStart = el.selectionEnd = pos;
        }
      }
    }
    
    // Add the trigger key (space, period, etc.) after correction
    insertText(el, triggerKey);
    
  } catch (error) {
    console.error('Autocorrect error:', error);
    insertText(el, triggerKey);
  }
}

// Helper to insert text at cursor position
function insertText(el, text) {
  if ('selectionStart' in el) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentValue = el.value;
    
    el.value = currentValue.slice(0, start) + text + currentValue.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function shouldTriggerFromKeyup(e) {
  const k = e.key;
  return (
    k === ' ' || k === 'Enter' || k === 'Tab' ||
    k === '.' || k === ',' || k === ';' || k === ':' ||
    k === '!' || k === '?' || k === '"' || k === "'" || k === ')'
  );
}

// Event listeners
document.addEventListener('keydown', (e) => {
  if (!shouldTriggerFromKeyup(e)) return;
  if (!isEnabled) return;
  
  const el = e.target;
  const val = getValue(el);
  
  if (val == null) return;

  activeEl = el;
  
  // Capture the word NOW before the key changes anything
  const wordInfo = getCurrentWordRange(el);
  
  if (!wordInfo.token || wordInfo.token.length < 2) return;
  
  // Store the trigger key
  const triggerKey = e.key;
  
  // Prevent default to stop the space from being added yet
  e.preventDefault();
  
  // Correct with the captured word info
  correctCapturedWord(el, wordInfo, triggerKey);
}, true);

document.addEventListener('focusin', (e) => {
  activeEl = e.target;
}, true);

console.log('AutoCorrect extension loaded');