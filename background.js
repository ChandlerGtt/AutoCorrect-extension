// background.js - Service worker with dictionary shard loading

const DEFAULTS = { enabled: true, pausedHosts: [] };

// Dictionary and AI model data (loaded in memory)
let dictionary = null;
let initialized = false;

console.log('🚀 Background script starting...');

// Initialize models function
async function initializeModels() {
  if (initialized) {
    console.log('ℹ️ Models already initialized');
    return;
  }
  
  console.log('📚 Loading dictionary from shards...');
  
  try {
    dictionary = await loadDictionaryFromShards();
    console.log('✅ Loaded', dictionary.size, 'words from shards');
  } catch (error) {
    console.warn('⚠️ Could not load shards, using fallback dictionary:', error);
    
    // Fallback dictionary
    dictionary = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
      'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
      'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
      'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
      'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
      'hello', 'world', 'test', 'example', 'correct', 'word', 'spell', 'check',
      'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
      'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
      'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
      'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
      'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
      'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having',
      'may', 'should', 'could', 'would', 'might', 'must', 'shall',
      'am', 'being', 'does', 'done', 'doing', 'made', 'make', 'making',
      'called', 'call', 'calling', 'went', 'going', 'goes', 'came', 'coming',
      'write', 'writing', 'wrote', 'written', 'read', 'reading', 'reads',
      'thing', 'things', 'place', 'places', 'person', 'great', 'small', 'grit', 'greet',
      'get', 'got', 'getting', 'give', 'gave', 'given', 'know', 'knew', 'known',
      'trying', 'tried', 'try', 'tries', 'guess', 'guessed', 'guessing',
      'must', 'adjust', 'adjusted', 'adjusting', 'adjustment', 'i'
    ]);
    console.log('✅ Using fallback dictionary with', dictionary.size, 'words');
  }
  
  initialized = true;
}

// Load dictionary from compressed shards
async function loadDictionaryFromShards() {
  const words = new Set();
  
  // Generate all shard combinations: a_, aa, ab, ac, ..., zz
  const shardNames = [];
  
  // Single letter + underscore (a_, b_, c_, ...)
  for (let i = 97; i <= 122; i++) {
    shardNames.push(String.fromCharCode(i) + '_');
  }
  
  // Two letter combinations (aa, ab, ..., zz)
  for (let i = 97; i <= 122; i++) {
    for (let j = 97; j <= 122; j++) {
      shardNames.push(String.fromCharCode(i) + String.fromCharCode(j));
    }
  }
  
  console.log(`📦 Loading ${shardNames.length} shards...`);
  
  let loadedCount = 0;
  let failedCount = 0;
  
  for (const shardName of shardNames) {
    try {
      const shardPath = `assets/shards/${shardName}.txt.gz`;
      const shardUrl = chrome.runtime.getURL(shardPath);
      
      const response = await fetch(shardUrl);
      
      if (!response.ok) {
        failedCount++;
        continue;
      }
      
      // Decompress using DecompressionStream API
      const arrayBuffer = await response.arrayBuffer();
      const decompressedStream = new Response(
        new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'))
      );
      const text = await decompressedStream.text();
      
      // Split by lines and add to dictionary
      const shardWords = text.split('\n').filter(w => w.trim().length > 0);
      
      shardWords.forEach(word => {
        const cleaned = word.trim().toLowerCase();
        if (cleaned && /^[a-z]+$/.test(cleaned)) {
          words.add(cleaned);
        }
      });
      
      loadedCount++;
      
      // Log progress every 50 shards
      if (loadedCount % 50 === 0) {
        console.log(`✅ Loaded ${loadedCount} shards so far... (${words.size} words)`);
      }
    } catch (error) {
      failedCount++;
      // Silently skip failed shards
    }
  }
  
  console.log(`✅ Successfully loaded ${loadedCount} shards, ${failedCount} failed`);
  
  if (words.size === 0) {
    throw new Error('No words loaded from shards');
  }
  
  return words;
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

// ===== AI CORRECTION LOGIC =====

function getAICorrections(word, context = '') {
  const normalized = word.toLowerCase();
  
  // If word is correct, return empty
  if (dictionary && dictionary.has(normalized)) {
    return [];
  }
  
  // Generate candidates
  const candidates = new Set();
  
  // Strategy 1: Edit distance
  const editCandidates = generateEditCandidates(normalized);
  editCandidates.forEach(c => {
    if (dictionary && dictionary.has(c)) candidates.add(c);
  });
  
  // Strategy 2: Common misspellings
  const commonFixes = getCommonMisspellingFixes(normalized);
  commonFixes.forEach(c => candidates.add(c));
  
  // Strategy 3: Phonetic
  const phoneticMatches = getPhoneticMatches(normalized);
  phoneticMatches.forEach(c => {
    if (dictionary && dictionary.has(c)) candidates.add(c);
  });
  
  // Rank and return top 3
  const ranked = rankCandidates(Array.from(candidates), normalized, context);
  return ranked.slice(0, 3);
}

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

function getCommonMisspellingFixes(word) {
  const fixes = {
    'teh': 'the',
    'recieve': 'receive',
    'occured': 'occurred',
    'seperate': 'separate',
    'definately': 'definitely',
    'goverment': 'government',
    'enviroment': 'environment',
    'begining': 'beginning',
    'beleive': 'believe',
    'wierd': 'weird',
    'freind': 'friend',
    'thier': 'their',
    'untill': 'until',
    'tommorrow': 'tomorrow',
    'writting': 'writing',
    'occurance': 'occurrence',
    'basicly': 'basically',
    'realy': 'really',
    'publically': 'publicly',
    'mispell': 'misspell',
    'neccessary': 'necessary',
    'accomodate': 'accommodate',
    'calender': 'calendar',
    'concious': 'conscious',
    'existance': 'existence',
    'guage': 'gauge',
    'happend': 'happened',
    'independant': 'independent',
    'knowlege': 'knowledge',
    'maintainance': 'maintenance',
    'noticable': 'noticeable',
    'occassion': 'occasion',
    'paralell': 'parallel',
    'reccommend': 'recommend',
    'surprize': 'surprise',
    'truely': 'truly',
    'unfortunatly': 'unfortunately',
    'vaccuum': 'vacuum',
    'wheather': 'whether'
  };
  
  return fixes[word] ? [fixes[word]] : [];
}

function getPhoneticMatches(word) {
  const phonetic = {
    'nite': 'night',
    'lite': 'light',
    'rite': 'right',
    'thru': 'through',
    'foto': 'photo',
    'fone': 'phone',
    'kool': 'cool',
    'skool': 'school',
    'tho': 'though',
    'thot': 'thought',
    'wud': 'would',
    'cud': 'could',
    'shud': 'should'
  };
  
  return phonetic[word] ? [phonetic[word]] : [];
}

function rankCandidates(candidates, original, context = '') {
  const scored = candidates.map(candidate => {
    const distance = levenshteinDistance(original, candidate);
    const frequencyScore = getFrequencyScore(candidate);
    
    // TODO: Add context score here when implementing AI
    // const contextScore = getContextScore(candidate, context);
    
    const score = frequencyScore / (distance + 1);
    return { word: candidate, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.map(item => item.word);
}

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

function getFrequencyScore(word) {
  const frequencies = {
    'the': 1000, 'be': 800, 'to': 750, 'of': 700, 'and': 680,
    'a': 650, 'in': 600, 'that': 550, 'have': 500, 'it': 480,
    'their': 400, 'there': 400, 'world': 300, 'hello': 250,
    'is': 900, 'was': 850, 'for': 700, 'are': 650, 'with': 600,
    'they': 580, 'at': 560, 'one': 540, 'this': 500,
    'from': 480, 'by': 460, 'not': 440, 'word': 420, 'but': 400,
    'what': 380, 'some': 360, 'we': 340, 'can': 320, 'out': 300
  };
  
  return frequencies[word] || 100;
}

// ===== MESSAGE HANDLER =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'correctWord') {
    if (!initialized) {
      initializeModels().then(() => {
        const suggestions = getAICorrections(request.word, request.context);
        sendResponse({ suggestions });
      });
      return true;
    }
    
    const suggestions = getAICorrections(request.word, request.context);
    sendResponse({ suggestions });
    return true;
  }
  
  if (request.action === 'checkEnabled') {
    chrome.storage.sync.get(DEFAULTS).then(settings => {
      const isHostPaused = settings.pausedHosts.includes(request.host);
      const enabled = settings.enabled && !isHostPaused;
      sendResponse({ enabled });
    });
    return true;
  }
});

// Initialize on startup
initializeModels();

console.log('✅ AutoCorrect background service worker ready');