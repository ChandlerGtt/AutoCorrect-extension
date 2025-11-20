// content.js – AI-powered autocorrect with context awareness

console.log('🎬 AutoCorrect AI loaded');

let activeEl = null;
let isEnabled = true;
let currentMode = 'auto'; // 'auto', 'off'
let correctionQueue = new Map(); // Track pending corrections
let currentSentenceId = null; // Track current sentence for re-evaluation
let sentenceStartPos = 0; // Track where current sentence starts
let lastTypingTime = Date.now(); // Track typing pauses

// Check if autocorrect is enabled and get mode
async function checkEnabledAndMode() {
  try {
    const host = window.location.hostname;
    const response = await chrome.runtime.sendMessage({
      action: 'checkEnabled',
      host
    });
    isEnabled = response?.enabled ?? true;
    currentMode = response?.mode || 'auto';
    console.log(`✅ AutoCorrect mode: ${currentMode}, enabled: ${isEnabled}`);
  } catch (error) {
    isEnabled = true;
    currentMode = 'auto';
  }
}

checkEnabledAndMode();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled || changes.pausedHosts || changes.mode) {
    checkEnabledAndMode();
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

function getPreviousWord(el) {
  const text = getValue(el) ?? '';
  let caret = 0;

  if ('selectionStart' in el && el.selectionStart != null) {
    caret = el.selectionStart;
  } else if (el.isContentEditable) {
    caret = text.length;
  }

  // Get text before cursor
  const beforeCursor = text.slice(0, caret);
  
  // Match the last complete word (before the space we just typed)
  // Look for: word characters, then whitespace at the end
  const match = beforeCursor.match(/([A-Za-z]+)\s+$/);
  
  if (!match) return null;
  
  const word = match[1]; // Just the word, not the space
  const wordEnd = beforeCursor.lastIndexOf(word) + word.length;
  const wordStart = wordEnd - word.length;
  
  return { 
    token: word, 
    start: wordStart, 
    end: wordEnd, 
    text: text 
  };
}

function replaceRange(text, start, end, replacement) {
  return text.slice(0, start) + replacement + text.slice(end);
}

function getContextWords(text, position, numWords = 10) {
  const beforeText = text.slice(0, position);
  const words = beforeText.trim().split(/\s+/);
  return words.slice(-numWords).join(' ');
}

// Get cursor position in contenteditable element
function getCursorPosition(el) {
  if (!el.isContentEditable) return 0;

  const selection = window.getSelection();
  if (selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(el);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  return preCaretRange.toString().length;
}

// Set cursor position in contenteditable element
function setCursorPosition(el, position) {
  if (!el.isContentEditable) return;

  const selection = window.getSelection();
  const range = document.createRange();

  let currentPos = 0;
  let found = false;

  // Walk through the text nodes to find the position
  function walkNodes(node) {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent.length;
      if (currentPos + nodeLength >= position) {
        // Found the node containing our target position
        const offset = position - currentPos;
        range.setStart(node, offset);
        range.setEnd(node, offset);
        found = true;
        return;
      }
      currentPos += nodeLength;
    } else {
      for (let child of node.childNodes) {
        walkNodes(child);
        if (found) return;
      }
    }
  }

  walkNodes(el);

  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // Fallback: position at the end
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Correct word asynchronously (doesn't block typing)
async function correctWordAsync(el, wordInfo) {
  const token = wordInfo.token;

  // Skip if not alphabetic
  if (!/^[A-Za-z]+$/.test(token)) return;

  // Skip if mode is 'off'
  if (currentMode === 'off' || !isEnabled) return;

  // Skip if already correcting this word
  const queueKey = `${token}_${wordInfo.start}`;
  if (correctionQueue.has(queueKey)) return;

  correctionQueue.set(queueKey, true);

  try {
    const context = getContextWords(wordInfo.text, wordInfo.start, 10);
    let response = null;
    let source = 'client';

    // Try backend API first (if enabled)
    if (typeof BACKEND_CONFIG !== 'undefined' && BACKEND_CONFIG.enabled) {
      try {
        const apiClient = new AutoCorrectAPIClient(BACKEND_CONFIG);
        const backendResult = await apiClient.correctText(token, context.split(/\s+/), currentMode);

        if (backendResult) {
          // Convert backend response to extension format
          response = {
            suggestions: backendResult.suggestions.map(s => s.text)
          };
          source = 'backend';
          console.log(`✅ Backend correction: "${token}" → "${backendResult.corrected}"`);
        }
      } catch (error) {
        console.log('⚠️ Backend unavailable, falling back to client-side');
      }
    }

    // Fall back to client-side (background.js) if backend didn't work
    if (!response) {
      response = await chrome.runtime.sendMessage({
        action: 'correctWord',
        word: token,
        context: context,
        mode: currentMode
      });
      source = 'client';
    }

    if (response && response.suggestions && response.suggestions.length > 0) {
      const suggestions = response.suggestions;

      // Mode: auto - automatically apply first suggestion
      if (currentMode === 'auto') {
        const suggestion = suggestions[0];

        if (suggestion.toLowerCase() !== token.toLowerCase()) {
          console.log(`🔄 ${source} correction: "${token}" → "${suggestion}"`);
          applyCorrection(el, wordInfo, suggestion);
        }
      }
    }
  } catch (error) {
    console.error('Correction error:', error);
  } finally {
    correctionQueue.delete(queueKey);
  }
}

// Apply correction to text (used in auto mode)
function applyCorrection(el, wordInfo, suggestion) {
  const currentText = getValue(el) ?? '';

  // Check if the word is still there (user might have edited)
  const wordStillThere = currentText.slice(wordInfo.start, wordInfo.end) === wordInfo.token;

  if (wordStillThere) {
    const lengthDiff = suggestion.length - wordInfo.token.length;

    // Save cursor position BEFORE making changes
    let savedCursor = null;
    if ('selectionStart' in el) {
      savedCursor = el.selectionStart;
    } else if (el.isContentEditable) {
      // For contenteditable, save the selection/cursor position
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Calculate cursor position as offset from start
        savedCursor = getCursorPosition(el);
      }
    }

    const updated = replaceRange(currentText, wordInfo.start, wordInfo.end, suggestion);
    setValue(el, updated);

    // Restore cursor position - adjust for length difference
    if ('selectionStart' in el && savedCursor !== null) {
      // Regular input/textarea elements
      if (savedCursor > wordInfo.end) {
        el.selectionStart = el.selectionEnd = savedCursor + lengthDiff;
      } else {
        el.selectionStart = el.selectionEnd = savedCursor;
      }
    } else if (el.isContentEditable && savedCursor !== null) {
      // Contenteditable elements (Gmail, Google Docs, etc.)
      const newCursorPos = savedCursor > wordInfo.end ? savedCursor + lengthDiff : savedCursor;
      setCursorPosition(el, newCursorPos);
    }

    console.log(`✨ Auto-corrected: "${wordInfo.token}" → "${suggestion}"`);

    // Visual feedback: brief highlight
    highlightCorrection(el, wordInfo.start, wordInfo.start + suggestion.length);
  }
}

// Visual feedback for auto-correction
function highlightCorrection(el, start, end) {
  // Brief flash effect - would need more sophisticated implementation
  // for actual visual feedback on the page
  // This is a placeholder for future enhancement
}

function shouldTrigger(e) {
  const k = e.key;
  return (
    k === ' ' || k === 'Enter' || k === 'Tab' ||
    k === '.' || k === ',' || k === ';' || k === ':' ||
    k === '!' || k === '?' || k === '"' || k === "'" || k === ')'
  );
}

// Listen for word completions
document.addEventListener('keyup', (e) => {
  if (!isEnabled) return;
  if (!shouldTrigger(e)) return;
  
  const el = e.target;
  const val = getValue(el);
  
  if (val == null) return;
  
  activeEl = el;
  
  // Get the word that was just completed (now has space after it)
  const wordInfo = getPreviousWord(el);
  
  if (wordInfo && wordInfo.token.length >= 2) {
    // Correct asynchronously (doesn't block typing)
    correctWordAsync(el, wordInfo);
  }
}, true);

document.addEventListener('focusin', (e) => {
  activeEl = e.target;
}, true);

console.log('✅ AutoCorrect AI ready');