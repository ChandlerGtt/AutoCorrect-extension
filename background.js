// background.js - Service worker with AI correction logic

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
    // Load dictionary from shards (50K+ words)
    dictionary = await loadDictionaryFromShards();
    console.log('✅ Loaded', dictionary.size, 'words from shards');
  } catch (error) {
    console.warn('⚠️ Could not load shards, using fallback dictionary:', error);
    
    // Fallback: use hardcoded dictionary if shards fail
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
      'thing', 'things', 'place', 'places', 'person', 'great', 'small', 'grit', 'greet'
    ]);
    console.log('✅ Using fallback dictionary with', dictionary.size, 'words');
  }
  
  initialized = true;
}

// Load dictionary from compressed shards
async function loadDictionaryFromShards() {
  const words = new Set();
  
  // Import pako for decompression
  importScripts(chrome.runtime.getURL('libs/pako.min.js'));
  
  // Load all shard files (assumes you have shard_0.json.gz, shard_1.json.gz, etc.)
  const shardCount = 10; // Adjust based on how many shards build-dict.js created
  
  for (let i = 0; i < shardCount; i++) {
    try {
      const shardPath = `assets/shards/shard_${i}.json.gz`;
      const shardUrl = chrome.runtime.getURL(shardPath);
      
      console.log(`📦 Loading shard ${i}...`);
      
      // Fetch the compressed shard
      const response = await fetch(shardUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Decompress using pako
      const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
      const shardWords = JSON.parse(decompressed);
      
      // Add words to dictionary
      shardWords.forEach(word => words.add(word.toLowerCase()));
      
      console.log(`✅ Shard ${i} loaded: ${shardWords.length} words`);
    } catch (error) {
      console.warn(`⚠️ Could not load shard ${i}:`, error);
      // Continue with other shards
    }
  }
  
  return words;
}

// Badge helper
async function setBadge(enabled) {
  try {
    await chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: "#777" });
    console.log('🏷️ Badge set:', enabled ? 'ON' : 'OFF');
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
    console.log('📋 Context menus created');
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
  console.log('⚙️ Storage changed:', changes);
  if (changes.enabled) {
    await setBadge(changes.enabled.newValue);
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  
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
  console.log('🔍 Checking word:', word);
  console.log('📝 With context:', context);
  
  const normalized = word.toLowerCase();
  
  // If word is correct, return empty
  if (dictionary && dictionary.has(normalized)) {
    console.log('✅ Word is correct');
    return [];
  }
  
  console.log('❌ Word needs correction');
  
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
  
  console.log('📋 Found candidates:', Array.from(candidates));
  
  // TODO: Use context to improve ranking
  // For now, just log it to prepare for future AI integration
  if (context) {
    console.log('🧠 Context will be used for AI ranking in future version');
  }
  
  // Rank and return top 3
  const ranked = rankCandidates(Array.from(candidates), normalized, context);
  console.log('🏆 Ranked suggestions:', ranked);
  
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
  console.log('📬 Received message:', request.action);
  
  if (request.action === 'correctWord') {
    // Log context if provided
    if (request.context) {
      console.log('📝 Context:', request.context);
    }
    
    if (!initialized) {
      console.log('⚠️ Models not initialized, initializing now...');
      initializeModels().then(() => {
        // TODO: Use context for AI-powered correction
        const suggestions = getAICorrections(request.word, request.context);
        console.log('📤 Sending suggestions:', suggestions);
        sendResponse({ suggestions });
      });
      return true; // Keep channel open for async response
    }
    
    // TODO: Pass context to AI correction function
    const suggestions = getAICorrections(request.word, request.context);
    console.log('📤 Sending suggestions:', suggestions);
    sendResponse({ suggestions });
    return true;
  }
  
  if (request.action === 'checkEnabled') {
    chrome.storage.sync.get(DEFAULTS).then(settings => {
      const isHostPaused = settings.pausedHosts.includes(request.host);
      const enabled = settings.enabled && !isHostPaused;
      console.log('🔍 Check enabled for', request.host, '→', enabled);
      sendResponse({ enabled });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'log') {
    console.log('[Content Script]:', request.message);
  }
});

// Initialize on startup
initializeModels();

console.log('✅ AutoCorrect background service worker ready');