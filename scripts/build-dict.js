#!/usr/bin/env node

/**
 * Dictionary Shard Builder
 *
 * Generates 702 gzip-compressed dictionary shards from a plain text word list.
 * Shards are organized by first two letters of each word (e.g., 'ab.txt.gz' for words starting with 'ab').
 *
 * Usage: node scripts/build-dict.js [input-file]
 *   - input-file: Path to plain text word list (one word per line)
 *   - If no input file, generates a comprehensive English dictionary from common sources
 *
 * Output: assets/shards/*.txt.gz (702 sharded files)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'shards');
const COMPRESSION_LEVEL = 9; // Maximum compression

/**
 * Generate a comprehensive English word list
 * Combines multiple sources for maximum coverage (~100,000+ words)
 */
function generateComprehensiveWordList() {
  console.log('Generating comprehensive English dictionary...');

  const words = new Set();

  // Try multiple dictionary sources
  const sources = [
    '/usr/share/dict/words',
    '/usr/share/dict/american-english',
    '/usr/share/dict/british-english',
    '/usr/dict/words'
  ];

  let foundSource = false;
  for (const source of sources) {
    if (fs.existsSync(source)) {
      console.log(`  Loading from ${source}...`);
      const content = fs.readFileSync(source, 'utf8');
      const sourceWords = content.split(/\r?\n/)
        .map(w => w.trim().toLowerCase())
        .filter(w => /^[a-z]+$/.test(w) && w.length > 0);

      sourceWords.forEach(w => words.add(w));
      foundSource = true;
      console.log(`    Added ${sourceWords.length} words (total: ${words.size})`);
    }
  }

  if (!foundSource) {
    console.log('  No system dictionary found, generating from common words...');
    // Add comprehensive base word list
    addCommonWords(words);
  }

  // Add essential words for autocorrect
  addEssentialWords(words);

  console.log(`Total unique words: ${words.size}`);
  return Array.from(words).sort();
}

/**
 * Add common English words (most frequently used)
 */
function addCommonWords(wordSet) {
  const commonWords = [
    // Top 1000 most common English words
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',

    // Additional common words
    'able', 'about', 'above', 'accept', 'according', 'account', 'across', 'act', 'action', 'activity',
    'actually', 'add', 'address', 'administration', 'admit', 'adult', 'affect', 'after', 'again', 'against',
    'age', 'agency', 'agent', 'ago', 'agree', 'agreement', 'ahead', 'air', 'all', 'allow',
    'almost', 'alone', 'along', 'already', 'also', 'although', 'always', 'american', 'among', 'amount',
    'analysis', 'and', 'animal', 'another', 'answer', 'any', 'anyone', 'anything', 'appear', 'apply',
    'approach', 'area', 'argue', 'arm', 'around', 'arrive', 'art', 'article', 'artist', 'as',
    'ask', 'assume', 'at', 'attack', 'attention', 'attorney', 'audience', 'author', 'authority', 'available',
    'avoid', 'away', 'baby', 'back', 'bad', 'bag', 'ball', 'bank', 'bar', 'base',
    'be', 'beat', 'beautiful', 'because', 'become', 'bed', 'before', 'begin', 'behavior', 'behind',
    'believe', 'benefit', 'best', 'better', 'between', 'beyond', 'big', 'bill', 'billion', 'bit',
    'black', 'blood', 'blue', 'board', 'body', 'book', 'born', 'both', 'box', 'boy',
    'break', 'bring', 'brother', 'budget', 'build', 'building', 'business', 'but', 'buy', 'by',
    'call', 'camera', 'campaign', 'can', 'cancer', 'candidate', 'capital', 'car', 'card', 'care',
    'career', 'carry', 'case', 'catch', 'cause', 'cell', 'center', 'central', 'century', 'certain',
    'certainly', 'chair', 'challenge', 'chance', 'change', 'character', 'charge', 'check', 'child', 'choice',
    'choose', 'church', 'citizen', 'city', 'civil', 'claim', 'class', 'clear', 'clearly', 'close',
    'coach', 'cold', 'collection', 'college', 'color', 'come', 'commercial', 'common', 'community', 'company',
    'compare', 'computer', 'concern', 'condition', 'conference', 'congress', 'consider', 'consumer', 'contain', 'continue',
    'control', 'cost', 'could', 'country', 'couple', 'course', 'court', 'cover', 'create', 'crime',
    'cultural', 'culture', 'cup', 'current', 'customer', 'cut', 'dark', 'data', 'daughter', 'day',
    'dead', 'deal', 'death', 'debate', 'decade', 'decide', 'decision', 'deep', 'defense', 'degree',
    'democrat', 'democratic', 'describe', 'design', 'despite', 'detail', 'determine', 'develop', 'development', 'die',
    'difference', 'different', 'difficult', 'dinner', 'direction', 'director', 'discover', 'discuss', 'discussion', 'disease',
    'do', 'doctor', 'dog', 'door', 'down', 'draw', 'dream', 'drive', 'drop', 'drug',
    'during', 'each', 'early', 'east', 'easy', 'eat', 'economic', 'economy', 'edge', 'education',
    'effect', 'effort', 'eight', 'either', 'election', 'else', 'employee', 'end', 'energy', 'enjoy',
    'enough', 'enter', 'entire', 'environment', 'environmental', 'especially', 'establish', 'even', 'evening', 'event',
    'ever', 'every', 'everybody', 'everyone', 'everything', 'evidence', 'exactly', 'example', 'executive', 'exist',
    'expect', 'experience', 'expert', 'explain', 'eye', 'face', 'fact', 'factor', 'fail', 'fall',
    'family', 'far', 'fast', 'father', 'fear', 'federal', 'feel', 'feeling', 'few', 'field',
    'fight', 'figure', 'fill', 'film', 'final', 'finally', 'financial', 'find', 'fine', 'finger',
    'finish', 'fire', 'firm', 'first', 'fish', 'five', 'floor', 'fly', 'focus', 'follow',
    'food', 'foot', 'for', 'force', 'foreign', 'forget', 'form', 'former', 'forward', 'four',
    'free', 'friend', 'from', 'front', 'full', 'fund', 'future', 'game', 'garden', 'gas',
    'general', 'generation', 'get', 'girl', 'give', 'glass', 'go', 'goal', 'good', 'government',
    'great', 'green', 'ground', 'group', 'grow', 'growth', 'guess', 'gun', 'guy', 'hair',
    'half', 'hand', 'hang', 'happen', 'happy', 'hard', 'have', 'he', 'head', 'health',
    'hear', 'heart', 'heat', 'heavy', 'help', 'her', 'here', 'herself', 'high', 'him',
    'himself', 'his', 'history', 'hit', 'hold', 'home', 'hope', 'hospital', 'hot', 'hotel',
    'hour', 'house', 'how', 'however', 'huge', 'human', 'hundred', 'husband', 'i', 'idea',
    'identify', 'if', 'image', 'imagine', 'impact', 'important', 'improve', 'in', 'include', 'including',
    'increase', 'indeed', 'indicate', 'individual', 'industry', 'information', 'inside', 'instead', 'institution', 'interest',
    'interesting', 'international', 'interview', 'into', 'investment', 'involve', 'issue', 'it', 'item', 'its',
    'itself', 'job', 'join', 'just', 'keep', 'key', 'kid', 'kill', 'kind', 'kitchen',
    'know', 'knowledge', 'land', 'language', 'large', 'last', 'late', 'later', 'laugh', 'law',
    'lawyer', 'lay', 'lead', 'leader', 'learn', 'least', 'leave', 'left', 'leg', 'legal',
    'less', 'let', 'letter', 'level', 'lie', 'life', 'light', 'like', 'likely', 'line',
    'list', 'listen', 'little', 'live', 'local', 'long', 'look', 'lose', 'loss', 'lot',
    'love', 'low', 'machine', 'magazine', 'main', 'maintain', 'major', 'majority', 'make', 'man',
    'manage', 'management', 'manager', 'many', 'market', 'marriage', 'material', 'matter', 'may', 'maybe',
    'me', 'mean', 'measure', 'media', 'medical', 'meet', 'meeting', 'member', 'memory', 'mention',
    'message', 'method', 'middle', 'might', 'military', 'million', 'mind', 'minute', 'miss', 'mission',
    'model', 'modern', 'moment', 'money', 'month', 'more', 'morning', 'most', 'mother', 'mouth',
    'move', 'movement', 'movie', 'mr', 'mrs', 'much', 'music', 'must', 'my', 'myself',
    'name', 'nation', 'national', 'natural', 'nature', 'near', 'nearly', 'necessary', 'need', 'network',
    'never', 'new', 'news', 'newspaper', 'next', 'nice', 'night', 'no', 'none', 'nor',
    'north', 'not', 'note', 'nothing', 'notice', 'now', 'number', 'occur', 'of', 'off',
    'offer', 'office', 'officer', 'official', 'often', 'oh', 'oil', 'ok', 'old', 'on',
    'once', 'one', 'only', 'onto', 'open', 'operation', 'opportunity', 'option', 'or', 'order',
    'organization', 'other', 'others', 'our', 'out', 'outside', 'over', 'own', 'owner', 'page',
    'pain', 'painting', 'paper', 'parent', 'part', 'participant', 'particular', 'particularly', 'partner', 'party',
    'pass', 'past', 'patient', 'pattern', 'pay', 'peace', 'people', 'per', 'perform', 'performance',
    'perhaps', 'period', 'person', 'personal', 'phone', 'physical', 'pick', 'picture', 'piece', 'place',
    'plan', 'plant', 'play', 'player', 'pm', 'point', 'police', 'policy', 'political', 'politics',
    'poor', 'popular', 'population', 'position', 'positive', 'possible', 'power', 'practice', 'prepare', 'present',
    'president', 'pressure', 'pretty', 'prevent', 'price', 'private', 'probably', 'problem', 'process', 'produce',
    'product', 'production', 'professional', 'professor', 'program', 'project', 'property', 'protect', 'prove', 'provide',
    'public', 'pull', 'purpose', 'push', 'put', 'quality', 'question', 'quickly', 'quite', 'race',
    'radio', 'raise', 'range', 'rate', 'rather', 'reach', 'read', 'ready', 'real', 'reality',
    'realize', 'really', 'reason', 'receive', 'recent', 'recently', 'recognize', 'record', 'red', 'reduce',
    'reflect', 'region', 'relate', 'relationship', 'religious', 'remain', 'remember', 'remove', 'report', 'represent',
    'republican', 'require', 'research', 'resource', 'respond', 'response', 'responsibility', 'rest', 'result', 'return',
    'reveal', 'rich', 'right', 'rise', 'risk', 'road', 'rock', 'role', 'room', 'rule',
    'run', 'safe', 'same', 'save', 'say', 'scene', 'school', 'science', 'scientist', 'score',
    'sea', 'season', 'seat', 'second', 'section', 'security', 'see', 'seek', 'seem', 'sell',
    'send', 'senior', 'sense', 'series', 'serious', 'serve', 'service', 'set', 'seven', 'several',
    'sex', 'sexual', 'shake', 'share', 'she', 'shoot', 'short', 'shot', 'should', 'shoulder',
    'show', 'side', 'sign', 'significant', 'similar', 'simple', 'simply', 'since', 'sing', 'single',
    'sister', 'sit', 'site', 'situation', 'six', 'size', 'skill', 'skin', 'small', 'smile',
    'so', 'social', 'society', 'soldier', 'some', 'somebody', 'someone', 'something', 'sometimes', 'son',
    'song', 'soon', 'sort', 'sound', 'source', 'south', 'southern', 'space', 'speak', 'special',
    'specific', 'speech', 'spend', 'sport', 'spring', 'staff', 'stage', 'stand', 'standard', 'star',
    'start', 'state', 'statement', 'station', 'stay', 'step', 'still', 'stock', 'stop', 'store',
    'story', 'strategy', 'street', 'strong', 'structure', 'student', 'study', 'stuff', 'style', 'subject',
    'success', 'successful', 'such', 'suddenly', 'suffer', 'suggest', 'summer', 'support', 'sure', 'surface',
    'system', 'table', 'take', 'talk', 'task', 'tax', 'teach', 'teacher', 'team', 'technology',
    'television', 'tell', 'ten', 'tend', 'term', 'test', 'than', 'thank', 'that', 'the',
    'their', 'them', 'themselves', 'then', 'theory', 'there', 'these', 'they', 'thing', 'think',
    'third', 'this', 'those', 'though', 'thought', 'thousand', 'threat', 'three', 'through', 'throughout',
    'throw', 'thus', 'time', 'to', 'today', 'together', 'tonight', 'too', 'top', 'total',
    'tough', 'toward', 'town', 'trade', 'traditional', 'training', 'travel', 'treat', 'treatment', 'tree',
    'trial', 'trip', 'trouble', 'true', 'truth', 'try', 'turn', 'tv', 'two', 'type',
    'under', 'understand', 'unit', 'until', 'up', 'upon', 'us', 'use', 'usually', 'value',
    'various', 'very', 'victim', 'view', 'violence', 'visit', 'voice', 'vote', 'wait', 'walk',
    'wall', 'want', 'war', 'watch', 'water', 'way', 'we', 'weapon', 'wear', 'week',
    'weight', 'well', 'west', 'western', 'what', 'whatever', 'when', 'where', 'whether', 'which',
    'while', 'white', 'who', 'whole', 'whom', 'whose', 'why', 'wide', 'wife', 'will',
    'win', 'wind', 'window', 'wish', 'with', 'within', 'without', 'woman', 'wonder', 'word',
    'work', 'worker', 'world', 'worry', 'would', 'write', 'writer', 'wrong', 'yard', 'yeah',
    'year', 'yes', 'yet', 'you', 'young', 'your', 'yourself'
  ];

  commonWords.forEach(w => wordSet.add(w));
}

/**
 * Add essential words for autocorrect functionality
 */
function addEssentialWords(wordSet) {
  const essentialWords = [
    // Common misspellings corrections
    'the', 'receive', 'occurred', 'separate', 'definitely', 'government', 'environment',
    'beginning', 'believe', 'weird', 'friend', 'their', 'until', 'tomorrow', 'writing',
    'occurrence', 'basically', 'really', 'publicly', 'misspell', 'necessary', 'accommodate',
    'calendar', 'conscious', 'existence', 'gauge', 'happened', 'independent', 'knowledge',
    'maintenance', 'noticeable', 'occasion', 'parallel', 'recommend', 'surprise', 'truly',
    'unfortunately', 'vacuum', 'weather',

    // Phonetic corrections
    'night', 'light', 'right', 'through', 'photo', 'phone', 'cool', 'school',
    'though', 'thought', 'would', 'could', 'should',

    // Technical words
    'computer', 'software', 'hardware', 'program', 'code', 'data', 'system', 'file',
    'folder', 'download', 'upload', 'internet', 'website', 'email', 'password', 'login',
    'logout', 'username', 'database', 'server', 'client', 'network', 'wireless', 'browser',

    // Common adjectives
    'good', 'bad', 'great', 'small', 'big', 'large', 'little', 'important', 'useful',
    'beautiful', 'ugly', 'happy', 'sad', 'angry', 'excited', 'tired', 'hungry', 'thirsty',

    // Common verbs
    'run', 'walk', 'jump', 'sit', 'stand', 'eat', 'drink', 'sleep', 'wake', 'read',
    'write', 'speak', 'listen', 'watch', 'look', 'see', 'hear', 'feel', 'touch', 'smell',
    'taste', 'think', 'know', 'understand', 'remember', 'forget', 'learn', 'teach', 'study',

    // Days and months
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december',

    // Numbers
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
    'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion'
  ];

  essentialWords.forEach(w => wordSet.add(w));
}

/**
 * Parse word list from file
 */
function parseWordList(filePath) {
  console.log(`Loading word list from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const words = raw.split(/\r?\n/)
    .map(w => w.trim().toLowerCase())
    .filter(w => /^[a-z]+$/.test(w) && w.length > 0);

  // Deduplicate
  const uniqueWords = Array.from(new Set(words)).sort();

  console.log(`Loaded ${uniqueWords.length} unique words`);
  return uniqueWords;
}

/**
 * Shard words by first two letters
 */
function shardWords(words) {
  console.log('\nSharding words by prefix...');

  const shards = new Map();

  // Initialize all possible shards
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  // Single letter shards: a_, b_, ..., z_
  for (const letter of alphabet) {
    shards.set(`${letter}_`, []);
  }

  // Two letter shards: aa, ab, ..., zz
  for (const first of alphabet) {
    for (const second of alphabet) {
      shards.set(`${first}${second}`, []);
    }
  }

  // Distribute words to shards
  for (const word of words) {
    if (word.length === 0) continue;

    let key;
    if (word.length === 1) {
      // Single letter word goes to letter_ shard (e.g., 'a' → 'a_')
      key = `${word[0]}_`;
    } else {
      // Multi-letter word goes to two-letter shard (e.g., 'apple' → 'ap')
      key = `${word[0]}${word[1]}`;
    }

    if (shards.has(key)) {
      shards.get(key).push(word);
    }
  }

  // Log shard statistics
  let totalShards = 0;
  let emptyShards = 0;
  let maxWords = 0;
  let maxShard = '';

  for (const [key, wordList] of shards) {
    totalShards++;
    if (wordList.length === 0) {
      emptyShards++;
    } else if (wordList.length > maxWords) {
      maxWords = wordList.length;
      maxShard = key;
    }
  }

  console.log(`  Total shards: ${totalShards}`);
  console.log(`  Non-empty shards: ${totalShards - emptyShards}`);
  console.log(`  Empty shards: ${emptyShards}`);
  console.log(`  Largest shard: ${maxShard} (${maxWords} words)`);

  return shards;
}

/**
 * Write compressed shards to disk
 */
function writeShards(shards) {
  console.log('\nWriting compressed shards...');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`  Created directory: ${OUTPUT_DIR}`);
  }

  let filesWritten = 0;
  let totalBytes = 0;
  let totalWordsWritten = 0;

  for (const [key, wordList] of shards) {
    // Sort and deduplicate
    wordList.sort();
    const dedup = wordList.filter((word, i) => i === 0 || word !== wordList[i - 1]);

    if (dedup.length === 0) {
      // Skip empty shards
      continue;
    }

    // Join words with newlines
    const content = dedup.join('\n');

    // Compress with gzip
    const compressed = zlib.gzipSync(content, { level: COMPRESSION_LEVEL });

    // Write to file
    const filename = `${key}.txt.gz`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, compressed);

    filesWritten++;
    totalBytes += compressed.length;
    totalWordsWritten += dedup.length;

    if (filesWritten % 50 === 0) {
      console.log(`  Progress: ${filesWritten} shards written...`);
    }
  }

  console.log(`\n✅ Success!`);
  console.log(`  Files written: ${filesWritten}`);
  console.log(`  Total words: ${totalWordsWritten}`);
  console.log(`  Total size: ${(totalBytes / 1024).toFixed(2)} KB`);
  console.log(`  Average shard size: ${(totalBytes / filesWritten).toFixed(0)} bytes`);
  console.log(`  Output directory: ${OUTPUT_DIR}`);
}

/**
 * Main execution
 */
function main() {
  console.log('='.repeat(60));
  console.log('Dictionary Shard Builder');
  console.log('='.repeat(60));
  console.log();

  const startTime = Date.now();

  // Get input file from command line or generate
  const inputFile = process.argv[2];

  let words;
  if (inputFile) {
    words = parseWordList(inputFile);
  } else {
    words = generateComprehensiveWordList();
  }

  // Shard the words
  const shards = shardWords(words);

  // Write compressed shards
  writeShards(shards);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nTotal time: ${elapsed}s`);
  console.log('='.repeat(60));
}

// Run the script
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { generateComprehensiveWordList, shardWords, writeShards };
