// content.js – Non-blocking autocorrect (prioritizes smooth typing)

console.log('🎬 AutoCorrect loaded - Non-blocking mode');

let activeEl = null;
let isEnabled = true;
let correctionQueue = new Map(); // Track pending corrections

// Check if autocorrect is enabled
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

checkEnabled();

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

// Correct word asynchronously (doesn't block typing)
async function correctWordAsync(el, wordInfo) {
  const token = wordInfo.token;
  
  // Skip if not alphabetic
  if (!/^[A-Za-z]+$/.test(token)) return;
  
  // Skip if already correcting this word
  const queueKey = `${token}_${wordInfo.start}`;
  if (correctionQueue.has(queueKey)) return;
  
  correctionQueue.set(queueKey, true);

  try {
    const context = getContextWords(wordInfo.text, wordInfo.start, 10);
    
    const response = await chrome.runtime.sendMessage({
      action: 'correctWord',
      word: token,
      context: context
    });

    if (response && response.suggestions && response.suggestions.length > 0) {
      const suggestion = response.suggestions[0];
      
      if (suggestion.toLowerCase() !== token.toLowerCase()) {
        // Apply correction
        const currentText = getValue(el) ?? '';
        
        // Check if the word is still there (user might have edited)
        const wordStillThere = currentText.slice(wordInfo.start, wordInfo.end) === token;
        
        if (wordStillThere) {
          const updated = replaceRange(currentText, wordInfo.start, wordInfo.end, suggestion);
          setValue(el, updated);
          
          // Restore cursor position - adjust for length difference
          if ('selectionStart' in el) {
            const lengthDiff = suggestion.length - token.length;
            const currentCursor = el.selectionStart;
            
            // If cursor is after the corrected word, adjust it
            if (currentCursor > wordInfo.end) {
              el.selectionStart = el.selectionEnd = currentCursor + lengthDiff;
            }
          }
          
          console.log(`✨ Corrected: "${token}" → "${suggestion}"`);
        }
      }
    }
  } catch (error) {
    console.error('Correction error:', error);
  } finally {
    correctionQueue.delete(queueKey);
  }
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

console.log('✅ AutoCorrect ready (non-blocking mode)');