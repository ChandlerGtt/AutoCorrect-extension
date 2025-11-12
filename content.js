// content.js – force auto-correct (no confirmation bubble)
const worker = new Worker(chrome.runtime.getURL('worker.js'), { type: 'module' });

let activeEl = null;
let lastToken = "";
let lastRange = null;

// ... rest of your code stays the same
// ---- helpers reused from your original file ----
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

// Computes the current word around the caret.
function getCurrentWordRange(el) {
  const text = getValue(el) ?? '';
  let caret = 0;

  if ('selectionStart' in el && el.selectionStart != null) {
    caret = el.selectionStart;
  } else if (el.isContentEditable) {
    // fallback for contenteditable
    caret = text.length;
  }

  // token boundaries (letters only)
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
// ---- end reused helpers ----

// Ask worker for a correction for the *current* word and auto-apply it.
function requestAutoCorrect(el) {
  const { token, start, end, text } = getCurrentWordRange(el);
  lastRange = { start, end, text };

  // ignore short/non-alpha tokens
  if (!token || token.length < 2 || !/^[A-Za-z]+$/.test(token)) return;

  // avoid spamming the worker with the same token repeatedly
  if (token === lastToken) return;
  lastToken = token;

  activeEl = el;
  worker.postMessage({ word: token, mode: 'auto' });
}

// Trigger autocorrect when the user *finishes* a word.
// Heuristics: space, enter, tab, or punctuation next to the caret.
function shouldTriggerFromKeyup(e) {
  const k = e.key;
  return (
    k === ' ' || k === 'Enter' || k === 'Tab' ||
    k === '.' || k === ',' || k === ';' || k === ':' ||
    k === '!' || k === '?' || k === '"' || k === "'" || k === ')'
  );
}

document.addEventListener('keyup', (e) => {
  const el = e.target;
  const val = getValue(el);
  if (val == null) return;

  // Update active element
  activeEl = el;

  // Fast path: explicit boundary keys
  if (shouldTriggerFromKeyup(e)) {
    requestAutoCorrect(el);
    return;
  }

  // Fallback: if char *before* caret is whitespace/punctuation, we likely ended a word
  if ('selectionStart' in el && el.selectionStart != null && el.selectionStart > 0) {
    const prevCh = val[el.selectionStart - 1];
    if (prevCh && /[\s.,;:!?'"()\[\]{}]/.test(prevCh)) {
      requestAutoCorrect(el);
    }
  }
}, true);

// Keep track of focus (so the worker knows where to write back)
document.addEventListener('focusin', (e) => {
  activeEl = e.target;
}, true);

// Auto-apply top suggestion (if it actually changes the token)
worker.onmessage = ({ data }) => {
  if (!activeEl) return;

  const suggestions = (data && data.suggestions) || [];
  if (!suggestions.length) return;

  const { token, start, end, text } = getCurrentWordRange(activeEl);
  if (!token) return;

  const top = suggestions[0];

  // If top suggestion is literally the same (case-insensitive), do nothing
  if (top && top.toLowerCase() === token.toLowerCase()) return;

  // Replace the word with the top suggestion
  const updated = replaceRange(text, start, end, top);
  setValue(activeEl, updated);

  // Move caret to the end of the replacement for inputs/textarea
  if ('selectionStart' in activeEl) {
    const pos = start + top.length;
    activeEl.selectionStart = activeEl.selectionEnd = pos;
  }
};
