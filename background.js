// background.js - Service worker with dictionary shard loading

const DEFAULTS = {
  enabled: true,
  mode: 'auto', // 'auto', 'suggestions', 'off'
  pausedHosts: [],
  minWordLength: 2
};

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

// ===== CONTEXT AWARENESS DATA =====

// Common bigrams (word pairs that frequently appear together)
const BIGRAMS = {
  'the': ['world', 'best', 'first', 'last', 'only', 'most', 'more', 'other', 'same', 'way', 'time', 'people', 'book', 'store', 'house'],
  'to': ['be', 'the', 'do', 'have', 'get', 'go', 'see', 'make', 'take', 'use', 'find', 'work', 'help', 'write'],
  'of': ['the', 'course', 'all', 'them', 'us', 'these', 'those', 'time', 'life', 'people', 'work'],
  'in': ['the', 'this', 'that', 'order', 'other', 'addition', 'general', 'time', 'place', 'fact'],
  'for': ['the', 'this', 'that', 'example', 'instance', 'some', 'all', 'many', 'most', 'me', 'you'],
  'on': ['the', 'this', 'that', 'top', 'behalf', 'time', 'way', 'earth', 'display'],
  'with': ['the', 'this', 'that', 'all', 'some', 'many', 'each', 'them', 'us', 'you', 'me'],
  'at': ['the', 'least', 'all', 'first', 'last', 'once', 'home', 'work', 'school', 'night', 'time'],
  'is': ['the', 'a', 'an', 'not', 'that', 'this', 'it', 'there', 'one', 'also'],
  'was': ['the', 'a', 'an', 'not', 'that', 'this', 'it', 'there', 'one', 'also'],
  'are': ['the', 'a', 'an', 'not', 'that', 'these', 'those', 'they', 'we', 'you'],
  'have': ['the', 'a', 'an', 'to', 'been', 'had', 'not', 'been', 'some', 'many'],
  'from': ['the', 'this', 'that', 'time', 'place', 'here', 'there', 'now', 'then'],
  'my': ['name', 'life', 'work', 'home', 'family', 'friend', 'book', 'way', 'time', 'mind'],
  'went': ['to', 'home', 'back', 'away', 'out', 'down', 'up', 'there', 'here'],
  'read': ['the', 'this', 'that', 'about', 'it', 'them', 'a', 'an', 'some', 'many'],
  'bought': ['the', 'this', 'that', 'some', 'a', 'an', 'new', 'it', 'them'],
  'some': ['of', 'people', 'time', 'more', 'other', 'new', 'good', 'bad', 'things']
};

// Common trigrams (3-word patterns)
const TRIGRAMS = [
  'in order to', 'as well as', 'in addition to', 'on the other', 'at the same',
  'for the first', 'one of the', 'as a result', 'in the world', 'in the future',
  'at the end', 'at the beginning', 'in the past', 'on the one', 'in the case',
  'a lot of', 'the fact that', 'in order for', 'as long as', 'as soon as',
  'in spite of', 'because of the', 'out of the', 'part of the', 'most of the',
  'in terms of', 'on behalf of', 'with respect to', 'in front of', 'in the middle',
  'i went to', 'i want to', 'i need to', 'i have to', 'i used to',
  'going to be', 'going to have', 'going to get', 'going to do', 'going to make'
];

// Domain keywords for content-aware correction
const DOMAIN_KEYWORDS = {
  technical: ['code', 'program', 'function', 'variable', 'class', 'method', 'database',
              'server', 'api', 'software', 'bug', 'debug', 'test', 'data', 'system',
              'computer', 'file', 'script', 'algorithm', 'array', 'string', 'object'],
  business: ['meeting', 'client', 'company', 'revenue', 'sales', 'profit', 'market',
             'team', 'project', 'deadline', 'budget', 'strategy', 'growth', 'customer',
             'business', 'corporate', 'enterprise', 'management', 'employee'],
  academic: ['research', 'study', 'paper', 'thesis', 'university', 'professor', 'journal',
             'analysis', 'theory', 'hypothesis', 'experiment', 'data', 'results', 'conclusion',
             'academic', 'scholar', 'education', 'student', 'learning'],
  casual: ['lol', 'cool', 'awesome', 'friend', 'fun', 'like', 'love', 'hate', 'yeah',
           'hey', 'hi', 'hello', 'thanks', 'please', 'maybe', 'probably', 'literally']
};

// Domain-specific vocabulary boost
const DOMAIN_VOCABULARY = {
  technical: ['github', 'python', 'javascript', 'compile', 'deploy', 'commit', 'push', 'pull',
              'merge', 'branch', 'repository', 'console', 'terminal', 'command', 'syntax'],
  business: ['invoice', 'contract', 'proposal', 'quarterly', 'stakeholder', 'milestone',
             'deliverable', 'metrics', 'roi', 'kpi', 'synergy', 'bandwidth', 'leverage'],
  academic: ['cite', 'reference', 'bibliography', 'peer', 'reviewed', 'published', 'abstract',
             'methodology', 'literature', 'findings', 'significance', 'correlation'],
  casual: ['gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'dunno', 'yep', 'nope', 'stuff', 'things']
};

// ===== CONTEXT ANALYSIS FUNCTIONS =====

function detectDomain(contextWords) {
  const scores = {
    technical: 0,
    business: 0,
    academic: 0,
    casual: 0
  };

  for (const word of contextWords) {
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.includes(word)) {
        scores[domain]++;
      }
    }
  }

  const entries = Object.entries(scores);
  const maxScore = Math.max(...entries.map(([_, score]) => score));

  if (maxScore === 0) return 'general';

  const topDomain = entries.find(([_, score]) => score === maxScore);
  return topDomain ? topDomain[0] : 'general';
}

function bigramScore(prevWord, candidate) {
  if (!prevWord || !candidate) return 0;

  const prev = prevWord.toLowerCase();
  const cand = candidate.toLowerCase();

  if (BIGRAMS[prev] && BIGRAMS[prev].includes(cand)) {
    return 0.5; // Strong bigram match
  }

  return 0;
}

function trigramScore(contextWords, candidate) {
  if (contextWords.length < 2) return 0;

  const last2 = contextWords.slice(-2).join(' ').toLowerCase();
  const cand = candidate.toLowerCase();
  const trigram = `${last2} ${cand}`;

  for (const commonTrigram of TRIGRAMS) {
    if (commonTrigram === trigram) {
      return 0.4; // Strong trigram match
    }
    // Partial match (contains the trigram)
    if (commonTrigram.includes(trigram)) {
      return 0.2;
    }
  }

  return 0;
}

function domainBoost(candidate, domain) {
  if (domain === 'general') return 0;

  const vocab = DOMAIN_VOCABULARY[domain];
  if (vocab && vocab.includes(candidate.toLowerCase())) {
    return 0.3; // Domain-specific word boost
  }

  return 0;
}

function contextSimilarity(contextWords, candidate) {
  // Check if candidate appears in context (common in coherent text)
  const cand = candidate.toLowerCase();
  for (const word of contextWords) {
    if (word.toLowerCase() === cand) {
      return 0.2; // Word repetition bonus
    }
  }

  return 0;
}

// ===== AI CORRECTION LOGIC =====

function getAICorrections(word, context = '', mode = 'auto') {
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
  // Parse context into words
  const contextWords = context.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const prevWord = contextWords.length > 0 ? contextWords[contextWords.length - 1] : '';
  const domain = detectDomain(contextWords);

  console.log(`🔍 Context analysis: ${contextWords.length} words, domain: ${domain}, prev: "${prevWord}"`);

  const scored = candidates.map(candidate => {
    // 1. Edit distance score (30% weight) - normalized to 0-1
    const distance = levenshteinDistance(original, candidate);
    const editScore = 1.0 / (distance + 1);

    // 2. Frequency score (30% weight) - normalized to 0-1
    const freqRaw = getFrequencyScore(candidate);
    const freqScore = Math.min(freqRaw / 1000, 1.0);

    // 3. Context score (40% weight) - sum of multiple factors
    let contextScore = 0.0;

    // Bigram: does candidate follow previous word?
    contextScore += bigramScore(prevWord, candidate);

    // Trigram: does candidate complete a 3-word pattern?
    contextScore += trigramScore(contextWords, candidate);

    // Domain: does candidate fit the detected domain?
    contextScore += domainBoost(candidate, domain);

    // Repetition: does candidate appear in context?
    contextScore += contextSimilarity(contextWords, candidate);

    // Normalize context score to 0-1
    contextScore = Math.min(contextScore, 1.0);

    // Final weighted score
    const finalScore = (editScore * 0.3) + (freqScore * 0.3) + (contextScore * 0.4);

    return {
      word: candidate,
      score: finalScore,
      breakdown: {
        edit: editScore.toFixed(3),
        freq: freqScore.toFixed(3),
        context: contextScore.toFixed(3),
        final: finalScore.toFixed(3)
      }
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Log top 3 for debugging
  if (scored.length > 0) {
    console.log(`📊 Top suggestions for "${original}":`);
    scored.slice(0, 3).forEach((item, i) => {
      console.log(`  ${i + 1}. "${item.word}" (score: ${item.breakdown.final}, edit: ${item.breakdown.edit}, freq: ${item.breakdown.freq}, ctx: ${item.breakdown.context})`);
    });
  }

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
        const suggestions = getAICorrections(request.word, request.context, request.mode);
        sendResponse({ suggestions });
      });
      return true;
    }

    const suggestions = getAICorrections(request.word, request.context, request.mode);
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
});

// Initialize on startup
initializeModels();

console.log('✅ AutoCorrect background service worker ready');