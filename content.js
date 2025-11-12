// content.js – Debug version to test if it's working at all

console.log('🎬 CONTENT SCRIPT LOADED!!!');
console.log('🎬 Extension ID:', chrome.runtime.id);
console.log('🎬 Page URL:', window.location.href);

let activeEl = null;
let lastToken = "";
let isEnabled = true;
let correctionCount = 0;

// Check if autocorrect is enabled for this site
async function checkEnabled() {
  try {
    const host = window.location.hostname;
    console.log('🔧 Checking enabled for:', host);
    const response = await chrome.runtime.sendMessage({ 
      action: 'checkEnabled',
      host 
    });
    isEnabled = response?.enabled ?? true;
    console.log('🔧 Enabled:', isEnabled);
  } catch (error) {
    console.log('⚠️ Check enabled error:', error);
    isEnabled = true;
  }
}

// Initialize
checkEnabled();

// Helper functions
function getValue(el) {
  if ('value' in el) return el.value;
  if (el.isContentEditable) return el.innerText;
  return null;
}

function setValue(el, newValue) {
  console.log('📝 Setting value:', newValue);
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
  
  console.log('📍 Word range:', { token, start: left, end: right, fullText: text });
  
  return { token, start: left, end: right, text };
}

function replaceRange(text, start, end, replacement) {
  return text.slice(0, start) + replacement + text.slice(end);
}

function getContextWords(text, position, numWords = 10) {
  const beforeText = text.slice(0, position);
  const words = beforeText.trim().split(/\s+/);
  return words.slice(-numWords).join(' ');
}

// Correct using pre-captured word info
async function correctCapturedWord(el, wordInfo, triggerKey) {
  correctionCount++;
  console.log(`\n🔔 CORRECTION ATTEMPT #${correctionCount}`);
  
  const token = wordInfo.token;
  console.log('   Word to correct:', token);
  
  if (!/^[A-Za-z]+$/.test(token)) {
    console.log('   ❌ Not alphabetic, skipping');
    insertText(el, triggerKey);
    return;
  }
  
  // Reset lastToken - we use lastCorrectedWord instead now
  lastToken = token;
  activeEl = el;

  try {
    const context = getContextWords(wordInfo.text, wordInfo.start, 10);
    console.log('   Context:', context);
    
    console.log('   📤 Sending to background...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'correctWord',
      word: token,
      context: context
    });

    console.log('   📥 Response:', response);

    if (response && response.suggestions && response.suggestions.length > 0) {
      const suggestion = response.suggestions[0];
      console.log('   💡 Suggestion:', suggestion);
      
      if (suggestion.toLowerCase() !== token.toLowerCase()) {
        console.log('   ✨ APPLYING CORRECTION:', token, '→', suggestion);
        
        const currentText = getValue(el) ?? '';
        const updated = replaceRange(currentText, wordInfo.start, wordInfo.end, suggestion);
        setValue(el, updated);
        
        // Remember we corrected this word
        lastCorrectedWord = suggestion;
        
        if ('selectionStart' in el) {
          const pos = wordInfo.start + suggestion.length;
          el.selectionStart = el.selectionEnd = pos;
          console.log('   📍 Cursor at:', pos);
        }
        
        console.log('   ✅ CORRECTION COMPLETE!');
        
        // Add space AFTER correction is applied
        setTimeout(() => {
          insertText(el, triggerKey);
          // Clear lastCorrectedWord after inserting space
          setTimeout(() => {
            lastCorrectedWord = "";
          }, 200);
        }, 50); // Increased delay to 50ms
        return;
      } else {
        console.log('   ℹ️ Suggestion same as original, no change');
      }
    } else {
      console.log('   ℹ️ No suggestions returned');
    }
    
    // If no correction was made, insert space immediately
    insertText(el, triggerKey);
    
  } catch (error) {
    console.error('   ❌ ERROR:', error);
    insertText(el, triggerKey);
  }
}

// Helper to insert text at cursor position
function insertText(el, text) {
  console.log('➕ Inserting trigger key:', text);
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
console.log('📋 Registering keydown listener...');

let lastCorrectedWord = "";
let processingCorrection = false; // Prevent re-entry

document.addEventListener('keydown', (e) => {
  // Ignore if already processing a correction
  if (processingCorrection) {
    console.log('⏳ Already processing, ignoring');
    return;
  }
  
  console.log(`⌨️ KEYDOWN: "${e.key}" (target: ${e.target.tagName})`);
  
  if (!shouldTriggerFromKeyup(e)) {
    console.log('   Not a trigger key, ignoring');
    return;
  }
  
  console.log('   ✅ TRIGGER KEY DETECTED!');
  
  if (!isEnabled) {
    console.log('   ❌ Extension disabled');
    return;
  }
  
  const el = e.target;
  const val = getValue(el);
  
  console.log('   Element value:', val);
  
  if (val == null) {
    console.log('   ❌ No value, ignoring');
    return;
  }

  activeEl = el;
  
  // Capture the word NOW before the key changes anything
  const wordInfo = getCurrentWordRange(el);
  
  if (!wordInfo.token || wordInfo.token.length < 2) {
    console.log('   ❌ No valid token');
    return;
  }
  
  // Don't re-correct words we just corrected
  if (wordInfo.token === lastCorrectedWord) {
    console.log('   ℹ️ Just corrected this word, skipping');
    return;
  }
  
  console.log('   🎯 Will correct:', wordInfo.token);
  
  // Store the trigger key
  const triggerKey = e.key;
  
  // Prevent default to stop the space from being added yet
  e.preventDefault();
  console.log('   🛑 Prevented default');
  
  // Set processing flag
  processingCorrection = true;
  
  // Correct with the captured word info
  correctCapturedWord(el, wordInfo, triggerKey).finally(() => {
    processingCorrection = false;
  });
}, true);

document.addEventListener('focusin', (e) => {
  console.log('👁️ Focus:', e.target.tagName);
  activeEl = e.target;
}, true);

console.log('✅ AutoCorrect extension loaded and ready!');
console.log('💡 Try typing "teh" and pressing SPACE');