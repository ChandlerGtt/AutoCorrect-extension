/* content.js — UI wiring v1 (fixed & complete) */
(() => {
  'use strict';

  // === Utilities ============================================================
  const debounce = (fn, ms = 180) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const WORD_RE = /[A-Za-z][A-Za-z']*/g;
  const getSelectionRange = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0);
    return r.collapsed ? r : null;
  };

  // === Bubble UI ============================================================
  let bubble = document.getElementById('autocorrect-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = 'autocorrect-bubble';
    bubble.className = 'hidden';
    bubble.style.cssText = `
      position: fixed; z-index: 2147483647;
      background: #111827; color: #f9fafb;
      border-radius: 10px; padding: 6px;
      box-shadow: 0 10px 30px rgba(0,0,0,.25);
      font: 13px system-ui, sans-serif;
      display: flex; gap: 4px; align-items: center;
      transform: translate(-9999px, -9999px);
    `;
    bubble.innerHTML = `
      <button id="ac-accept" style="background:#10b981;color:#06231a;border:0;border-radius:6px;padding:4px 6px;cursor:pointer;">Accept</button>
      <button id="ac-next" style="background:#374151;color:#f9fafb;border:0;border-radius:6px;padding:4px 6px;cursor:pointer;">Next</button>
      <button id="ac-ignore" style="background:#374151;color:#f9fafb;border:0;border-radius:6px;padding:4px 6px;cursor:pointer;">Ignore</button>
      <span id="ac-suggestion" style="margin-left:6px;opacity:.9"></span>
    `;
    document.documentElement.appendChild(bubble);
  }

  const ui = {
    showAt(rect) {
      bubble.classList.remove('hidden');
      const vw = innerWidth, vh = innerHeight;
      let x = Math.min(rect.left, vw - 240), y = rect.bottom + 8;
      if (y > vh - 44) y = rect.top - 44;
      bubble.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
    },
    hide() { bubble.classList.add('hidden'); },
    setSuggestion(text) { document.getElementById('ac-suggestion').textContent = text || ''; }
  };

  // === Worker bridge ========================================================
  // Load worker through a Blob
function makeClassicWorker() {
  const base = chrome.runtime.getURL(''); // e.g., 'chrome-extension://<id>/'
  const src = `self.__ac_base='${base}'; importScripts(self.__ac_base + 'worker.js');`;
  const blob = new Blob([src], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}
const worker = makeClassicWorker();

let _busy = false;
function askWorker(word) {
  return new Promise((resolve) => {
    const doSend = () => {
      _busy = true;
      const onMsg = (ev) => {
        worker.removeEventListener('message', onMsg);
        _busy = false;
        resolve(ev.data?.suggestions || []);
      };
      worker.addEventListener('message', onMsg);
      worker.postMessage({ word });
    };
    if (_busy) {
      // tiny queue: wait and try again very soon
      const t = setInterval(() => { if (!_busy) { clearInterval(t); doSend(); } }, 30);
    } else {
      doSend();
    }
  });
}

  // === Underline helpers ====================================================
  function underlineRange(textNode, start, end) {
    const r = document.createRange();
    r.setStart(textNode, start); r.setEnd(textNode, end);
    const span = document.createElement('span');
    span.className = 'autocorrect-underline';
    r.surroundContents(span);
    return span;
  }

  function replaceInTextNode(textNode, start, end, replacement) {
    const before = textNode.textContent.slice(0, start);
    const after = textNode.textContent.slice(end);
    textNode.textContent = before + replacement + after;
  }

  const undoStack = [];
  const pushUndo = (fn) => { undoStack.push(fn); if (undoStack.length > 50) undoStack.shift(); };
  const undoLast = () => { const fn = undoStack.pop(); if (fn) fn(); };

  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'Backquote') { undoLast(); ui.hide(); }
  }, true);

  // === Core typing logic ====================================================
  let lastUnderlineEl = null;
  let lastContext = null;
  let suggestions = [];
  let i = 0;

  async function handleEditableInput() {
    const sel = getSelectionRange();
    if (!sel) { ui.hide(); return; }
    const node = sel.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) { ui.hide(); return; }

    const text = node.textContent;
    const off = sel.startOffset;
    let s = off; while (s > 0 && /[A-Za-z']/i.test(text[s - 1])) s--;
    let e = off; while (e < text.length && /[A-Za-z']/i.test(text[e])) e++;
    const token = text.slice(s, e);
    if (!token || token.length < 2) { ui.hide(); return; }

    suggestions = await askWorker(token);
    if (!suggestions.length || suggestions[0].toLowerCase() === token.toLowerCase()) { ui.hide(); return; }

    if (lastUnderlineEl) {
      lastUnderlineEl.replaceWith(...lastUnderlineEl.childNodes);
      lastUnderlineEl = null;
    }
    lastUnderlineEl = underlineRange(node, s, e);
    lastContext = { container: node, range: [s, e] };

    const rect = sel.getBoundingClientRect();
    ui.setSuggestion(suggestions[0]);
    i = 0;
    ui.showAt(rect);
  }

  const onEditableInput = debounce(handleEditableInput, 120);

  // Inputs / Textareas =======================================================
  const onTextInput = debounce(async (el) => {
    const selStart = el.selectionStart, selEnd = el.selectionEnd;
    if (selStart !== selEnd) { ui.hide(); return; }
    const value = el.value, left = value.slice(0, selStart);
    const m = left.match(WORD_RE); const token = m ? m[m.length - 1] : '';
    if (!token || token.length < 2) { ui.hide(); return; }

    suggestions = await askWorker(token);
    if (!suggestions.length || suggestions[0].toLowerCase() === token.toLowerCase()) { ui.hide(); return; }

    const rect = caretClientRectForInput(el);
    ui.setSuggestion(suggestions[0]);
    i = 0; ui.showAt(rect);
    lastContext = { input: el, token, start: selStart - token.length, end: selStart };
  }, 120);

  function caretClientRectForInput(el) {
    const s = window.getComputedStyle(el);
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;white-space:pre-wrap;visibility:hidden;`;
    const props = [
      'fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','textTransform',
      'textAlign','textIndent','lineHeight','paddingTop','paddingRight','paddingBottom',
      'paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'
    ];
    props.forEach(p => { div.style[p] = s[p]; });
    div.style.width = el.clientWidth + 'px';
    div.textContent = el.value.slice(0, el.selectionStart);
    const span = document.createElement('span'); span.textContent = '\u200b';
    div.appendChild(span); document.body.appendChild(div);
    const r = span.getBoundingClientRect(); document.body.removeChild(div);
    const b = el.getBoundingClientRect();
    return {
      left: b.left + r.left, right: b.right,
      top: b.top, bottom: Math.min(b.top + r.bottom, b.bottom)
    };
  }

  // === Listeners ============================================================
  document.addEventListener('input', (e) => {
    const active = document.activeElement;
    if (active && active.isContentEditable) onEditableInput();
    else if (/^(INPUT|TEXTAREA)$/i.test(active?.tagName || '')) onTextInput(active);
  }, true);

  document.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') onEditableInput();
  }, true);

  // === Bubble button actions ===============================================
  document.getElementById('ac-accept').addEventListener('click', () => {
    if (!lastContext || !suggestions.length) return ui.hide();
    if (lastContext.container) {
      const { container, range } = lastContext;
      const beforeText = container.textContent;
      replaceInTextNode(container, range[0], range[1], suggestions[i]);
      pushUndo(() => { container.textContent = beforeText; });
    } else if (lastContext.input) {
      const { input, start, end } = lastContext;
      const val = input.value;
      const replacement = suggestions[i];
      input.value = val.slice(0, start) + replacement + val.slice(end);
      const pos = start + replacement.length;
      input.setSelectionRange(pos, pos);
      pushUndo(() => { input.value = val; });
    }
    cleanupUnderline(); ui.hide();
  });

  document.getElementById('ac-next').addEventListener('click', () => {
    if (!suggestions.length) return;
    i = (i + 1) % suggestions.length;
    ui.setSuggestion(suggestions[i]);
  });

  document.getElementById('ac-ignore').addEventListener('click', () => {
    cleanupUnderline(); ui.hide();
  });

  function cleanupUnderline() {
    if (lastUnderlineEl && lastUnderlineEl.parentNode) {
      const span = lastUnderlineEl;
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      lastUnderlineEl = null; lastContext = null;
    }
  }

  // Reposition on scroll/resize
  window.addEventListener('scroll', () => {
    if (!bubble.classList.contains('hidden')) {
      const sel = getSelectionRange();
      if (sel) ui.showAt(sel.getBoundingClientRect());
    }
  }, true);
  window.addEventListener('resize', () => {
    if (!bubble.classList.contains('hidden')) {
      const sel = getSelectionRange();
      if (sel) ui.showAt(sel.getBoundingClientRect());
    }
  }, true);

  console.debug('autocorrect content.js loaded ✅');
})();
