// content.js — shows a suggestion bubble and replaces the current word
const worker = new Worker(chrome.runtime.getURL('worker.js'));

// if you already have the enabled/paused guards, keep them; wrap postMessage calls with isActive()

let activeEl = null;
let lastToken = "";
let lastRange = null; // {start,end} for inputs/textarea or contenteditable
let bubble = null;

function ensureBubble() {
  if (bubble) return bubble;
  bubble = document.createElement('div');
  bubble.id = 'qc-bubble';
  bubble.tabIndex = -1;
  document.documentElement.appendChild(bubble);
  return bubble;
}

function hideBubble() {
  if (bubble) bubble.style.display = 'none';
}

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
    // simple caret-to-index for contenteditable: fall back to end
    caret = text.length;
  }

  // find token boundaries (letters only)
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

// Position bubble near the focused element.
// (Simple, robust: anchor to the bottom-left of the field)
function showBubble(el, suggestions, onPick) {
  const hostRect = el.getBoundingClientRect();
  const b = ensureBubble();
  b.innerHTML = suggestions.map((s, i) =>
    `<button class="qc-item" data-i="${i}" type="button">${s}</button>`
  ).join('');

  b.style.left = `${Math.round(hostRect.left)}px`;
  b.style.top  = `${Math.round(hostRect.bottom + 6)}px`;
  b.style.display = 'block';

  // click handlers
  b.querySelectorAll('.qc-item').forEach(btn => {
    btn.addEventListener('click', () => onPick(btn.textContent));
  });

  // basic keyboard nav
  let idx = 0;
  const items = [...b.querySelectorAll('.qc-item')];
  items[0]?.focus();

  const keyHandler = (e) => {
    if (b.style.display === 'none') return;
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      idx = (idx + 1) % items.length; items[idx].focus(); e.preventDefault();
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      idx = (idx - 1 + items.length) % items.length; items[idx].focus(); e.preventDefault();
    } else if (e.key === 'Enter') {
      onPick(items[idx].textContent); e.preventDefault();
    } else if (e.key === 'Escape') {
      hideBubble();
    }
  };
  b.onkeydown = keyHandler;

  // clicking elsewhere hides the bubble
  const outside = (evt) => {
    if (!b.contains(evt.target)) hideBubble();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', outside, { once: true });
  }, 0);
}

function requestSuggestionsFor(el) {
  const { token, start, end, text } = getCurrentWordRange(el);
  lastRange = { start, end, text };
  if (!token || token.length < 2 || !/^[A-Za-z]+$/.test(token)) {
    hideBubble();
    return;
  }
  if (token === lastToken) return;
  lastToken = token;
  worker.postMessage({ word: token });
}

document.addEventListener('keyup', (e) => {
  const el = e.target;
  const val = getValue(el);
  if (val == null) return;
  activeEl = el;
  // request suggestions as user finishes a word (space, punctuation, or pause)
  requestSuggestionsFor(el);
}, true);

// Optional: right-click to force suggestions if caret is on a red-squiggled word
document.addEventListener('contextmenu', (e) => {
  const el = e.target;
  const val = getValue(el);
  if (val == null) return;
  activeEl = el;
  requestSuggestionsFor(el);
}, true);

worker.onmessage = ({ data }) => {
  if (!activeEl) return;
  const suggestions = (data && data.suggestions) || [];
  if (!suggestions.length) { hideBubble(); return; }

  // If the top suggestion equals our token, don't show the bubble
  const { token } = getCurrentWordRange(activeEl);
  if (suggestions[0] && suggestions[0].toLowerCase() === (token || '').toLowerCase()) {
    hideBubble(); return;
  }

  showBubble(activeEl, suggestions.slice(0, 6), (choice) => {
    if (!lastRange) return hideBubble();
    const { start, end, text } = getCurrentWordRange(activeEl);
    const updated = replaceRange(text, start, end, choice);
    setValue(activeEl, updated);

    // move caret to end of replacement for inputs/textarea
    if ('selectionStart' in activeEl) {
      const pos = start + choice.length;
      activeEl.selectionStart = activeEl.selectionEnd = pos;
    }
    hideBubble();
  });
};

// Hide bubble when focus leaves fields
document.addEventListener('focusin', (e) => {
  activeEl = e.target;
}, true);
document.addEventListener('focusout', () => hideBubble(), true);
