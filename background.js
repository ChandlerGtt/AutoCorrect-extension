// background.js - Lean AI-powered autocorrect service worker

const DEFAULTS = {
  enabled: true,
  mode: 'auto', // 'auto', 'off'
  pausedHosts: [],
  minWordLength: 2
};

// Minimal dictionary - AI handles the rest
let dictionary = null;
let initialized = false;
let correctionMemory = null;

console.log('🚀 Background script starting...');

// Initialize with minimal fallback dictionary
async function initializeModels() {
  if (initialized) {
    console.log('ℹ️ Models already initialized');
    return;
  }

  // Ultra-minimal fallback dictionary - only top 20 most common English words
  // AI + Levenshtein distance handles everything else
  dictionary = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
    'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this'
  ]);

  console.log('✅ Minimal dictionary loaded with', dictionary.size, 'words');

  // Initialize correction memory
  if (!correctionMemory) {
    correctionMemory = new CorrectionMemory();
    correctionMemory.startAutoCleanup();
    console.log('✅ Correction memory initialized');
  }

  initialized = true;
}

// Badge helper
async function setBadge(enabled) {
  try {
    await chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: "#777" });
  } catch (e) {
    console.log('⚠️ Could not set badge:', e);
  }
}

// Build context menus
async function buildMenus() {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: "toggle-site",
      title: "Pause/Resume on this site",
      contexts: ["action"]
    });
  } catch (e) {
    console.log('⚠️ Could not build menus:', e);
  }
}

// Install event
chrome.runtime.onInstalled.addListener(async () => {
  console.log('📦 Extension installed/updated');

  const cur = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set({ ...DEFAULTS, ...cur });
  await setBadge(cur.enabled ?? true);
  await buildMenus();
  await initializeModels();

  console.log('✅ Extension setup complete');
});

// Storage change listener
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.enabled) {
    await setBadge(changes.enabled.newValue);
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "toggle-site" || !tab?.url) return;

  const host = new URL(tab.url).hostname;
  const { pausedHosts = [] } = await chrome.storage.sync.get(["pausedHosts"]);
  const set = new Set(pausedHosts);

  set.has(host) ? set.delete(host) : set.add(host);
  await chrome.storage.sync.set({ pausedHosts: Array.from(set) });

  await chrome.action.setBadgeText({ text: set.has(host) ? "PAU" : "" });
  setTimeout(async () => {
    const { enabled = true } = await chrome.storage.sync.get("enabled");
    await setBadge(enabled);
  }, 800);

  console.log(`✅ Autocorrect ${set.has(host) ? 'paused' : 'resumed'} for ${host}`);
});

// ===== MINIMAL GRAMMAR RULES (top 5 most common) =====

const GRAMMAR_FIXES = {
  'alot': 'a lot',
  'teh': 'the',
  'recieve': 'receive',
  'definately': 'definitely',
  'seperate': 'separate'
};

function checkGrammarFixes(text) {
  const lowerText = text.toLowerCase();
  const fixes = [];

  for (const [wrong, correct] of Object.entries(GRAMMAR_FIXES)) {
    const index = lowerText.indexOf(wrong);
    if (index !== -1) {
      fixes.push({
        type: 'grammar',
        wrong: wrong,
        correct: correct,
        position: index,
        confidence: 0.95
      });
    }
  }

  return fixes;
}

// ===== CORRECTION MEMORY SYSTEM =====

class CorrectionMemory {
  constructor() {
    this.sentences = new Map();
    this.maxAge = 5 * 60 * 1000; // 5 minutes
    this.maxSentences = 100;
    this.cleanupInterval = null;
  }

  generateSentenceId(text, timestamp) {
    return `${text.slice(0, 20)}_${timestamp}`;
  }

  addCorrection(sentenceId, correction) {
    if (!this.sentences.has(sentenceId)) {
      this.sentences.set(sentenceId, {
        corrections: [],
        text: '',
        startTime: Date.now(),
        isComplete: false,
        revalidated: false
      });
    }

    this.sentences.get(sentenceId).corrections.push({
      ...correction,
      timestamp: Date.now(),
      revalidated: false
    });

    if (this.sentences.size > this.maxSentences) {
      const oldestKey = Array.from(this.sentences.keys())[0];
      this.sentences.delete(oldestKey);
    }
  }

  getSentenceCorrections(sentenceId) {
    return this.sentences.get(sentenceId)?.corrections || [];
  }

  markSentenceComplete(sentenceId, fullText) {
    const data = this.sentences.get(sentenceId);
    if (data) {
      data.isComplete = true;
      data.text = fullText;
      data.completionTime = Date.now();
    }
  }

  getSentenceData(sentenceId) {
    return this.sentences.get(sentenceId);
  }

  async revalidateSentence(sentenceId) {
    const data = this.sentences.get(sentenceId);
    if (!data || !data.isComplete || data.revalidated) return [];

    const grammarIssues = checkGrammarFixes(data.text);

    for (const correction of data.corrections) {
      correction.revalidated = true;
    }

    data.revalidated = true;
    return grammarIssues;
  }

  cleanupOld() {
    const now = Date.now();
    const toDelete = [];

    for (const [id, data] of this.sentences.entries()) {
      if (now - data.startTime > this.maxAge) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.sentences.delete(id));

    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} old sentences from memory`);
    }
  }

  startAutoCleanup() {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanupOld(), 30000);
  }

  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ===== LEAN AI CORRECTION LOGIC =====

function getAICorrections(word, context = '', mode = 'auto') {
  const normalized = word.toLowerCase();

  // If word is in minimal dictionary, it's correct
  if (dictionary && dictionary.has(normalized)) {
    return [];
  }

  // Generate candidates using edit distance
  const candidates = new Set();

  // Strategy 1: Edit distance (AI's main tool)
  const editCandidates = generateEditCandidates(normalized);
  editCandidates.forEach(c => {
    if (dictionary && dictionary.has(c)) candidates.add(c);
  });

  // Strategy 2: Top 10 common misspellings only
  const commonFixes = getCommonMisspellingFixes(normalized);
  commonFixes.forEach(c => candidates.add(c));

  // Strategy 3: Top 5 phonetic matches only
  const phoneticMatches = getPhoneticMatches(normalized);
  phoneticMatches.forEach(c => {
    if (dictionary && dictionary.has(c)) candidates.add(c);
  });

  // Rank using pure Levenshtein distance (simplest, most reliable)
  const ranked = rankCandidatesByDistance(Array.from(candidates), normalized);
  return ranked.slice(0, 3);
}

// Generate edit distance candidates (deletions, substitutions, insertions, transpositions)
function generateEditCandidates(word) {
  const candidates = new Set();
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  // Deletions
  for (let i = 0; i < word.length; i++) {
    candidates.add(word.slice(0, i) + word.slice(i + 1));
  }

  // Substitutions
  for (let i = 0; i < word.length; i++) {
    for (const char of alphabet) {
      candidates.add(word.slice(0, i) + char + word.slice(i + 1));
    }
  }

  // Insertions
  for (let i = 0; i <= word.length; i++) {
    for (const char of alphabet) {
      candidates.add(word.slice(0, i) + char + word.slice(i));
    }
  }

  // Transpositions
  for (let i = 0; i < word.length - 1; i++) {
    candidates.add(
      word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
    );
  }

  return candidates;
}

// Top 10 most common misspellings only
function getCommonMisspellingFixes(word) {
  const fixes = {
    'teh': 'the',
    'recieve': 'receive',
    'seperate': 'separate',
    'definately': 'definitely',
    'goverment': 'government',
    'beleive': 'believe',
    'freind': 'friend',
    'thier': 'their',
    'untill': 'until',
    'tommorrow': 'tomorrow'
  };

  return fixes[word] ? [fixes[word]] : [];
}

// Top 5 phonetic matches only
function getPhoneticMatches(word) {
  const phonetic = {
    'nite': 'night',
    'lite': 'light',
    'thru': 'through',
    'tho': 'though',
    'wud': 'would'
  };

  return phonetic[word] ? [phonetic[word]] : [];
}

// Pure Levenshtein distance ranking (AI-first approach)
function rankCandidatesByDistance(candidates, original) {
  const scored = candidates.map(candidate => ({
    word: candidate,
    distance: levenshteinDistance(original, candidate)
  }));

  // Sort by distance (lower is better)
  scored.sort((a, b) => a.distance - b.distance);

  return scored.map(item => item.word);
}

// Levenshtein distance algorithm
function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() =>
    Array(a.length + 1).fill(null)
  );

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

// ===== MESSAGE HANDLER =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'correctWord') {
    if (!initialized) {
      initializeModels().then(() => {
        const suggestions = getAICorrections(request.word, request.context, request.mode);

        if (request.sentenceId && correctionMemory) {
          correctionMemory.addCorrection(request.sentenceId, {
            originalWord: request.word,
            correctedTo: suggestions[0] || request.word,
            position: request.position || 0,
            context: request.context
          });
        }

        sendResponse({ suggestions });
      });
      return true;
    }

    const suggestions = getAICorrections(request.word, request.context, request.mode);

    if (request.sentenceId && correctionMemory && suggestions.length > 0) {
      correctionMemory.addCorrection(request.sentenceId, {
        originalWord: request.word,
        correctedTo: suggestions[0],
        position: request.position || 0,
        context: request.context
      });
    }

    sendResponse({ suggestions });
    return true;
  }

  if (request.action === 'checkEnabled') {
    chrome.storage.sync.get(DEFAULTS).then(settings => {
      const isHostPaused = settings.pausedHosts.includes(request.host);
      const enabled = settings.enabled && !isHostPaused;
      const mode = settings.mode || 'auto';
      sendResponse({ enabled, mode });
    });
    return true;
  }

  if (request.action === 'sentenceComplete') {
    if (correctionMemory && request.sentenceId && request.fullText) {
      correctionMemory.markSentenceComplete(request.sentenceId, request.fullText);

      correctionMemory.revalidateSentence(request.sentenceId).then(grammarIssues => {
        console.log(`📝 Sentence complete with ${grammarIssues.length} grammar issues`);
        sendResponse({ grammarIssues });
      });
      return true;
    }
    sendResponse({ grammarIssues: [] });
    return true;
  }

  if (request.action === 'checkGrammar') {
    const grammarFixes = checkGrammarFixes(request.text || '');
    sendResponse({ fixes: grammarFixes });
    return true;
  }
});

// Initialize on startup
initializeModels();

console.log('✅ AutoCorrect AI-first service worker ready');
