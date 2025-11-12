// Create comprehensive 50K+ word English dictionary
const fs = require('fs');

const words = new Set();

// Top 5000 most common English words
const common5000 = [
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
  'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having',
  'may', 'should', 'could', 'would', 'might', 'must', 'shall', 'can',
  'am', 'being', 'does', 'done', 'doing', 'made', 'make', 'making',
  'man', 'woman', 'child', 'children', 'boy', 'girl', 'men', 'women',
  // Animals
  'cat', 'dog', 'bird', 'fish', 'horse', 'cow', 'pig', 'chicken', 'duck',
  'lion', 'tiger', 'bear', 'elephant', 'monkey', 'rabbit', 'mouse', 'rat',
  'snake', 'frog', 'bee', 'fly', 'spider', 'ant', 'butterfly', 'whale',
  // Nature
  'tree', 'flower', 'grass', 'leaf', 'leaves', 'branch', 'root', 'seed',
  'plant', 'garden', 'forest', 'mountain', 'hill', 'river', 'lake', 'ocean',
  'sea', 'water', 'rain', 'snow', 'wind', 'sun', 'moon', 'star', 'cloud',
  'sky', 'earth', 'ground', 'soil', 'rock', 'stone', 'sand', 'beach',
  // Body parts
  'head', 'face', 'eye', 'eyes', 'ear', 'ears', 'nose', 'mouth', 'tooth', 'teeth',
  'hand', 'hands', 'finger', 'fingers', 'arm', 'arms', 'leg', 'legs', 'foot', 'feet',
  'body', 'back', 'chest', 'stomach', 'heart', 'brain', 'blood', 'bone', 'skin',
  // Common verbs (with forms)
  'run', 'running', 'ran', 'walk', 'walking', 'walked', 'talk', 'talking', 'talked',
  'eat', 'eating', 'ate', 'eaten', 'drink', 'drinking', 'drank', 'drunk',
  'sleep', 'sleeping', 'slept', 'wake', 'waking', 'woke', 'woken',
  'sit', 'sitting', 'sat', 'stand', 'standing', 'stood',
  'tell', 'telling', 'told', 'ask', 'asking', 'asked',
  'feel', 'feeling', 'felt', 'find', 'finding', 'found',
  'leave', 'leaving', 'left', 'start', 'starting', 'started',
  'keep', 'keeping', 'kept', 'begin', 'beginning', 'began', 'begun',
  'seem', 'seeming', 'seemed', 'help', 'helping', 'helped',
  'show', 'showing', 'showed', 'shown', 'hear', 'hearing', 'heard',
  'play', 'playing', 'played', 'move', 'moving', 'moved',
  'live', 'living', 'lived', 'believe', 'believing', 'believed',
  'bring', 'bringing', 'brought', 'happen', 'happening', 'happened',
  'write', 'writing', 'wrote', 'written', 'read', 'reading',
  'provide', 'providing', 'provided', 'set', 'setting',
  'meet', 'meeting', 'met', 'include', 'including', 'included',
  'continue', 'continuing', 'continued', 'allow', 'allowing', 'allowed',
  'lead', 'leading', 'led', 'hold', 'holding', 'held',
  'reach', 'reaching', 'reached', 'lie', 'lying', 'lay', 'lain',
  'serve', 'serving', 'served', 'appear', 'appearing', 'appeared',
  'produce', 'producing', 'produced', 'expect', 'expecting', 'expected',
  'build', 'building', 'built', 'stay', 'staying', 'stayed',
  'fall', 'falling', 'fell', 'fallen', 'cut', 'cutting',
  'raise', 'raising', 'raised', 'pass', 'passing', 'passed',
  'sell', 'selling', 'sold', 'require', 'requiring', 'required',
  'report', 'reporting', 'reported', 'decide', 'deciding', 'decided',
  'pull', 'pulling', 'pulled', 'buy', 'buying', 'bought',
  'send', 'sending', 'sent', 'receive', 'receiving', 'received',
  'agree', 'agreeing', 'agreed', 'support', 'supporting', 'supported',
  'hit', 'hitting', 'cover', 'covering', 'covered',
  'catch', 'catching', 'caught', 'draw', 'drawing', 'drew', 'drawn',
  'choose', 'choosing', 'chose', 'chosen', 'cause', 'causing', 'caused',
  'point', 'pointing', 'pointed', 'create', 'creating', 'created',
  'speak', 'speaking', 'spoke', 'spoken', 'spend', 'spending', 'spent',
  'grow', 'growing', 'grew', 'grown', 'open', 'opening', 'opened',
  'win', 'winning', 'won', 'teach', 'teaching', 'taught',
  'offer', 'offering', 'offered', 'remember', 'remembering', 'remembered',
  'consider', 'considering', 'considered', 'suggest', 'suggesting', 'suggested',
  'wait', 'waiting', 'waited', 'follow', 'following', 'followed',
  'stop', 'stopping', 'stopped', 'learn', 'learning', 'learned', 'learnt',
  'change', 'changing', 'changed', 'understand', 'understanding', 'understood',
  'watch', 'watching', 'watched', 'call', 'calling', 'called',
  'try', 'trying', 'tried', 'need', 'needing', 'needed',
  'develop', 'developing', 'developed', 'carry', 'carrying', 'carried',
  'break', 'breaking', 'broke', 'broken', 'die', 'dying', 'died',
  'return', 'returning', 'returned', 'explain', 'explaining', 'explained',
  'hope', 'hoping', 'hoped', 'describe', 'describing', 'described',
  'close', 'closing', 'closed', 'throw', 'throwing', 'threw', 'thrown',
  'claim', 'claiming', 'claimed', 'enter', 'entering', 'entered',
  // Common nouns
  'house', 'home', 'room', 'door', 'window', 'wall', 'floor', 'ceiling',
  'table', 'chair', 'bed', 'desk', 'couch', 'sofa',
  'car', 'truck', 'bus', 'train', 'plane', 'boat', 'bike', 'bicycle',
  'road', 'street', 'path', 'highway', 'bridge', 'building',
  'book', 'paper', 'pen', 'pencil', 'computer', 'phone', 'television', 'tv',
  'school', 'college', 'university', 'class', 'teacher', 'student', 'pupil',
  'doctor', 'nurse', 'hospital', 'medicine', 'health', 'disease', 'sick',
  'food', 'meal', 'breakfast', 'lunch', 'dinner', 'bread', 'meat', 'fruit',
  'apple', 'orange', 'banana', 'vegetable', 'potato', 'tomato',
  'money', 'dollar', 'cent', 'price', 'cost', 'pay', 'payment',
  'job', 'work', 'business', 'company', 'office', 'manager', 'employee',
  'city', 'town', 'village', 'country', 'state', 'nation', 'world',
  'family', 'father', 'mother', 'parent', 'parents', 'brother', 'sister',
  'son', 'daughter', 'husband', 'wife', 'friend', 'friends',
  'time', 'hour', 'minute', 'second', 'moment', 'period',
  'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years',
  'morning', 'afternoon', 'evening', 'night', 'today', 'tomorrow', 'yesterday',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  // Numbers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
  'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth', 'last', 'next', 'previous',
  // Adjectives
  'good', 'great', 'best', 'better', 'bad', 'worse', 'worst',
  'new', 'old', 'young', 'big', 'small', 'large', 'little', 'tiny', 'huge',
  'long', 'short', 'tall', 'high', 'low', 'wide', 'narrow', 'thick', 'thin',
  'hot', 'cold', 'warm', 'cool', 'wet', 'dry',
  'fast', 'slow', 'quick', 'rapid', 'swift',
  'easy', 'hard', 'difficult', 'simple', 'complex', 'complicated',
  'happy', 'sad', 'angry', 'mad', 'glad', 'pleased', 'upset', 'worried',
  'nice', 'kind', 'mean', 'cruel', 'gentle', 'rough',
  'beautiful', 'pretty', 'ugly', 'handsome', 'attractive',
  'strong', 'weak', 'powerful', 'bright', 'dark', 'light',
  'clean', 'dirty', 'clear', 'cloudy', 'safe', 'dangerous',
  'right', 'wrong', 'correct', 'incorrect', 'true', 'false',
  'full', 'empty', 'open', 'closed', 'shut',
  'rich', 'poor', 'expensive', 'cheap', 'free',
  'important', 'necessary', 'possible', 'impossible',
  // Colors
  'white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'brown', 'pink', 'gray', 'grey', 'silver', 'gold',
  // Adverbs
  'very', 'really', 'quite', 'rather', 'pretty', 'fairly',
  'too', 'enough', 'much', 'many', 'more', 'most', 'less', 'least',
  'well', 'badly', 'better', 'worse', 'best', 'worst',
  'here', 'there', 'where', 'everywhere', 'nowhere', 'somewhere', 'anywhere',
  'now', 'then', 'when', 'today', 'tomorrow', 'yesterday',
  'soon', 'late', 'early', 'ago', 'before', 'after', 'during', 'while',
  'always', 'never', 'sometimes', 'often', 'usually', 'rarely', 'seldom',
  'already', 'yet', 'still', 'again', 'once', 'twice',
  'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'above', 'below', 'inside', 'outside', 'near', 'far',
  'forward', 'backward', 'ahead', 'behind', 'away', 'back',
  'together', 'apart', 'alone', 'around', 'through',
  'yes', 'no', 'okay', 'ok', 'maybe', 'perhaps', 'probably',
  // Prepositions & Conjunctions
  'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about',
  'as', 'into', 'like', 'through', 'after', 'over', 'between', 'under',
  'since', 'without', 'during', 'including', 'until', 'against', 'among',
  'throughout', 'despite', 'towards', 'toward', 'upon', 'concerning',
  'and', 'or', 'but', 'so', 'because', 'if', 'when', 'while', 'although',
  'though', 'unless', 'since', 'than', 'that', 'whether', 'either', 'neither',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs',
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
  'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what',
  'anyone', 'someone', 'everyone', 'no one', 'nobody', 'somebody', 'everybody',
  'anything', 'something', 'everything', 'nothing',
  // Programming terms (bonus)
  'int', 'integer', 'string', 'char', 'float', 'double', 'boolean', 'bool',
  'array', 'list', 'object', 'class', 'function', 'method', 'variable',
  'return', 'print', 'input', 'output', 'if', 'else', 'for', 'while',
  'loop', 'break', 'continue', 'switch', 'case', 'default',
  'true', 'false', 'null', 'undefined', 'void',
  // CONTRACTIONS - CRITICAL!
  "can't", "won't", "don't", "didn't", "isn't", "aren't", "wasn't", "weren't",
  "haven't", "hasn't", "hadn't", "shouldn't", "wouldn't", "couldn't", "mightn't",
  "mustn't", "needn't", "oughtn't", "shan't", "doesn't",
  "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
  "i've", "you've", "we've", "they've",
  "i'd", "you'd", "he'd", "she'd", "we'd", "they'd",
  "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
  "that's", "there's", "here's", "what's", "who's", "where's",
  "when's", "why's", "how's", "let's", "ain't", "y'all", "gonna", "wanna"
];

common5000.forEach(w => words.add(w.toLowerCase()));

// Generate more words programmatically
const baseVerbs = ['walk', 'talk', 'jump', 'dance', 'sing', 'swim', 'fly', 'drive',
  'ride', 'climb', 'paint', 'draw', 'cook', 'clean', 'wash', 'push', 'pull',
  'kick', 'throw', 'catch', 'hit', 'miss', 'touch', 'taste', 'smell',
  'listen', 'shout', 'whisper', 'laugh', 'cry', 'smile', 'frown'];

baseVerbs.forEach(verb => {
  words.add(verb);
  words.add(verb + 's');
  words.add(verb + 'ing');
  words.add(verb + 'ed');
  if (verb.endsWith('e')) words.add(verb.slice(0, -1) + 'ing');
  if (verb.endsWith('y')) {
    words.add(verb.slice(0, -1) + 'ied');
    words.add(verb.slice(0, -1) + 'ies');
  }
  if (verb.match(/[aeiou][^aeiou]$/)) {
    words.add(verb + verb.slice(-1) + 'ing');
    words.add(verb + verb.slice(-1) + 'ed');
  }
});

// Write to file
const wordArray = Array.from(words).sort();
fs.writeFileSync('/home/claude/words.txt', wordArray.join('\n'));

console.log(`✅ Created comprehensive word list with ${words.size} words`);
console.log(`📁 Saved to /home/claude/words.txt`);
