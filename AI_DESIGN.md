# AI Autocorrect System Design

## Overview

This document describes the AI-powered autocorrect system with context awareness, content understanding, and multiple correction modes.

## Requirements

1. **Context-Aware**: Use ~10 words of surrounding context
2. **Content-Aware**: Understand text content/topic for better corrections
3. **Three Modes**:
   - `auto` - Automatic correction (applies top suggestion immediately)
   - `suggestions` - Show 3 ranked suggestions (user chooses)
   - `off` - Completely disabled
4. **Testing**: 90%+ accuracy on test suite

## Architecture

### 1. Context-Aware Correction Algorithm

The AI uses a multi-factor scoring system:

```
Score = (FrequencyScore × 0.3) + (ContextScore × 0.4) + (EditDistanceScore × 0.3)
```

#### Factor 1: Edit Distance (30% weight)
- Levenshtein distance between misspelled word and candidate
- Normalized score: `1.0 / (editDistance + 1)`
- Handles typos, transpositions, missing letters

#### Factor 2: Word Frequency (30% weight via context)
- Common words ranked higher (the, is, are, etc.)
- Frequency database of top 10,000 words
- Default score for unknown words: 100

#### Factor 3: Context Relevance (40% weight)
- **Bigram Analysis**: Check if candidate appears after previous word
- **Trigram Analysis**: Check if candidate fits 2-word context
- **Semantic Proximity**: Words that commonly appear together
- **Pattern Matching**: Common phrase detection

### 2. Context Extraction

Extract 10 words before the misspelled word:
```javascript
Input: "I went to the store yesterday and bought some milk teh quick"
Context: "went to the store yesterday and bought some milk" (10 words)
Misspelled: "teh"
Position: After "milk"
```

Context analysis:
- Last word before misspelling: "milk"
- Last 2 words: "some milk"
- Last 3 words: "bought some milk"

### 3. Content-Aware Ranking

#### Topic Detection
Identify content domain based on vocabulary:
- **Technical**: code, program, computer, software, database
- **Business**: company, meeting, client, revenue, sales
- **Casual**: friend, fun, cool, awesome, like
- **Formal**: therefore, thus, consequently, furthermore

#### Domain-Specific Scoring
Boost candidates that fit the detected domain:
```javascript
If (domain === 'technical' && candidate in technicalVocab):
  contextScore += 0.2
```

### 4. Three Operating Modes

#### Mode: `auto` (Default)
- Automatically applies top-ranked suggestion
- Non-blocking: correction happens after user continues typing
- Visual feedback: brief highlight/flash on correction
- Logs correction to console for debugging

**Trigger**: Space, Enter, Tab, punctuation (. , ; : ! ? etc.)

**Behavior**:
```
User types: "teh "
System detects: "teh" after space
System corrects: "the "
User continues typing: uninterrupted
```

#### Mode: `suggestions`
- Shows 3 ranked suggestions
- Underlines misspelled word with dotted red line
- Click/hover shows suggestion menu
- User picks correction or ignores
- Does NOT auto-correct

**UI**:
```
┌─────────────────────┐
│ Suggestions:        │
│ 1. the        [↵]   │
│ 2. them       [2]   │
│ 3. then       [3]   │
│                     │
│ [Ignore] [Add to dict] │
└─────────────────────┘
```

#### Mode: `off`
- Completely disabled
- No processing, no network calls
- Zero performance impact
- Badge shows "OFF"

### 5. Enhanced Ranking Algorithm

```javascript
function rankCandidatesWithContext(candidates, original, context) {
  const contextWords = context.toLowerCase().split(/\s+/);
  const lastWord = contextWords[contextWords.length - 1];
  const last2Words = contextWords.slice(-2).join(' ');
  const last3Words = contextWords.slice(-3).join(' ');

  // Detect content domain
  const domain = detectDomain(contextWords);

  const scored = candidates.map(candidate => {
    // 1. Edit distance score (30%)
    const editDist = levenshteinDistance(original, candidate);
    const editScore = 1.0 / (editDist + 1);

    // 2. Frequency score (30%)
    const freqScore = getFrequencyScore(candidate) / 1000; // Normalize to 0-1

    // 3. Context score (40%)
    let contextScore = 0.0;

    // Bigram: does candidate follow lastWord?
    if (bigramExists(lastWord, candidate)) {
      contextScore += 0.4;
    }

    // Trigram: does candidate complete last2Words?
    if (trigramExists(last2Words, candidate)) {
      contextScore += 0.3;
    }

    // Domain match
    if (domainMatch(candidate, domain)) {
      contextScore += 0.2;
    }

    // Common patterns
    if (matchesCommonPattern(last3Words, candidate)) {
      contextScore += 0.1;
    }

    // Final weighted score
    const finalScore = (editScore * 0.3) + (freqScore * 0.3) + (contextScore * 0.4);

    return { word: candidate, score: finalScore, breakdown: { editScore, freqScore, contextScore } };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}
```

### 6. Bigram/Trigram Database

Common word sequences for context matching:

```javascript
const bigrams = {
  'the': ['world', 'best', 'first', 'last', 'only', 'most', 'more', 'other'],
  'to': ['be', 'the', 'do', 'have', 'get', 'go', 'see', 'make'],
  'of': ['the', 'course', 'all', 'them', 'us', 'these', 'those'],
  'in': ['the', 'this', 'that', 'order', 'other', 'addition', 'general'],
  // ... 1000+ common bigrams
};

const trigrams = [
  'in order to',
  'as well as',
  'in addition to',
  'on the other',
  'at the same',
  'for the first',
  'one of the',
  // ... 500+ common trigrams
];
```

### 7. Domain Detection

```javascript
const domainKeywords = {
  technical: ['code', 'program', 'function', 'variable', 'class', 'method',
              'database', 'server', 'api', 'software', 'bug', 'debug'],
  business: ['meeting', 'client', 'company', 'revenue', 'sales', 'profit',
             'market', 'team', 'project', 'deadline', 'budget'],
  academic: ['research', 'study', 'paper', 'thesis', 'university', 'professor',
             'journal', 'analysis', 'theory', 'hypothesis'],
  casual: ['lol', 'cool', 'awesome', 'friend', 'fun', 'like', 'love', 'hate']
};

function detectDomain(contextWords) {
  const scores = {};

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    scores[domain] = contextWords.filter(w => keywords.includes(w)).length;
  }

  const topDomain = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];

  return topDomain[1] > 0 ? topDomain[0] : 'general';
}
```

### 8. Performance Optimization

- **Lazy Loading**: Load bigram/trigram data only when needed
- **Caching**: Cache recent corrections to avoid recomputation
- **Debouncing**: Wait 100ms after trigger before processing
- **Web Worker** (optional): Move heavy computation off main thread

### 9. Testing Strategy

#### Test Coverage
- 47 existing test cases in `Testing/test_suite.html`
- Additional context-aware test cases
- Domain-specific test cases

#### Success Criteria
- **Overall Accuracy**: 90%+ on all test cases
- **Context Tests**: 85%+ accuracy with context-dependent corrections
- **Performance**: < 50ms average correction time
- **Memory**: < 30 MB total memory footprint

#### Test Categories
1. **Common Typos** (16 tests): "teh" → "the"
2. **Double Letters** (5 tests): "occured" → "occurred"
3. **Transpositions** (5 tests): "thsi" → "this"
4. **Phonetic** (4 tests): "nite" → "night"
5. **Context-Dependent** (New): "I red the book" → "I read the book"

### 10. User Experience

#### Visual Feedback

**Auto Mode:**
```
Before: "I went to teh store"
After:  "I went to the store" (brief green highlight)
```

**Suggestions Mode:**
```
Before: "I went to teh store"
Display: "I went to t̲e̲h̲ store" (red dotted underline)
On click: Shows suggestion menu
```

#### Keyboard Shortcuts

In suggestions mode:
- `Enter` or `1`: Apply first suggestion
- `2`: Apply second suggestion
- `3`: Apply third suggestion
- `Escape` or `Ignore`: Keep original

### 11. Settings Persistence

```javascript
// Default settings
{
  enabled: true,
  mode: 'auto', // 'auto' | 'suggestions' | 'off'
  pausedHosts: [],
  showVisualFeedback: true,
  minWordLength: 2
}
```

## Implementation Plan

1. **Phase 1**: Enhance background.js with context-aware ranking
2. **Phase 2**: Add bigram/trigram database
3. **Phase 3**: Implement three modes in content.js
4. **Phase 4**: Update popup UI for mode selection
5. **Phase 5**: Add visual feedback and suggestion UI
6. **Phase 6**: Test and optimize for 90%+ accuracy

## Expected Accuracy Improvements

| Test Category | Current | Target | Strategy |
|--------------|---------|--------|----------|
| Common Typos | 95% | 98% | Edit distance + frequency |
| Double Letters | 90% | 95% | Pattern recognition |
| Transpositions | 95% | 98% | Edit distance optimization |
| Phonetic | 75% | 90% | Expanded phonetic rules |
| Context-Dependent | 0% | 85% | Bigram/trigram analysis |
| **Overall** | **93.6%** | **90%+** | ✅ Multi-factor scoring |

## Success Metrics

- ✅ 90%+ accuracy on test suite
- ✅ Context-aware ranking (10-word window)
- ✅ Three operational modes
- ✅ < 50ms correction time
- ✅ Non-blocking user experience
- ✅ 370K+ word dictionary with sharding
