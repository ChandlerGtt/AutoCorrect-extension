# Grammar & Sentence Cohesion Enhancement Design

## Overview

This document describes the enhanced AI autocorrect system with grammar correction, sentence cohesion analysis, correction memory, and improved accuracy testing.

## Architecture Enhancements

### 1. Grammar Correction System

#### Subject-Verb Agreement
```javascript
Rules:
- "I am" / "he is" / "they are"
- "he goes" / "they go"
- "she was" / "they were"
- Singular subjects → singular verbs
- Plural subjects → plural verbs
```

#### Tense Consistency
```javascript
Detect and maintain:
- Past tense: walked, ran, went
- Present tense: walk, run, go
- Future tense: will walk, will run
- Present perfect: have walked, has run
```

#### Article Usage
```javascript
Rules:
- "a" before consonant sounds: a car, a house
- "an" before vowel sounds: an apple, an hour
- "the" for specific items: the car (already mentioned)
```

#### Common Grammar Patterns
```javascript
Examples:
- "should of" → "should have"
- "could of" → "could have"
- "would of" → "would have"
- "there is many" → "there are many"
- "he don't" → "he doesn't"
- "she don't" → "she doesn't"
```

### 2. Correction Memory System

#### Data Structure
```javascript
const correctionMemory = {
  sentenceId: "unique-id-per-sentence",
  corrections: [
    {
      originalWord: "teh",
      correctedTo: "the",
      position: 5,
      timestamp: Date.now(),
      context: "I saw teh cat",
      confidence: 0.95,
      revalidated: false
    }
  ],
  sentenceText: "I saw the cat",
  isComplete: false,
  completionTimestamp: null
};
```

#### Memory Operations
- **Store**: Track each correction with full context
- **Retrieve**: Get corrections for current sentence
- **Revalidate**: Re-check corrections after sentence completion
- **Expire**: Remove old corrections (>5 minutes)
- **Rollback**: Undo incorrect corrections if needed

### 3. Sentence-Wide Analysis

#### Sentence Detection
```javascript
Sentence boundaries:
- Period (.)
- Question mark (?)
- Exclamation point (!)
- Multiple spaces
- Line breaks

Start sentence analysis when:
- User types sentence-ending punctuation
- After 2-second typing pause
- On Enter/Return key
```

#### Full Sentence Re-evaluation
```javascript
Process:
1. Identify sentence boundaries
2. Extract complete sentence text
3. Retrieve all corrections made in sentence
4. Re-analyze with full context
5. Check grammar patterns across sentence
6. Verify correction cohesion
7. Apply additional corrections if needed
8. Update confidence scores
```

#### Sentence Cohesion Checks
```javascript
Verify:
- Subject-verb agreement throughout
- Tense consistency
- Pronoun agreement
- Article appropriateness
- Preposition usage
- Word order (basic)
- Redundancy detection
```

### 4. Enhanced Word Frequency Weighting

#### Frequency Tiers
```javascript
Tier 1 - Ultra Common (weight: 10.0):
  the, be, to, of, and, a, in, that, have, it, for, not, on, with, he, as, you, do, at, this

Tier 2 - Very Common (weight: 5.0):
  but, his, by, from, they, we, say, her, she, or, an, will, my, one, all, would, there, their

Tier 3 - Common (weight: 3.0):
  what, so, up, out, if, about, who, get, which, go, me, when, make, can, like, time

Tier 4 - Frequent (weight: 1.5):
  no, just, him, know, take, people, into, year, your, good, some, could, them, see, other

Tier 5 - Regular (weight: 1.0):
  All other dictionary words

Based on Corpus of Contemporary American English (COCA) frequencies
```

#### Frequency Scoring Update
```javascript
Old formula:
  frequencyScore = baseFrequency / 1000

New formula:
  frequencyScore = (tierWeight * baseFrequency) / 1000

  With context boost:
  if (word in previous sentence):
    frequencyScore *= 1.2  // Word repetition bonus

  With grammar boost:
  if (grammarCorrect):
    frequencyScore *= 1.3  // Grammar correctness bonus
```

### 5. Improved Scoring Algorithm

#### Multi-Pass Scoring
```javascript
Pass 1: Initial word correction (existing)
  Score = (editDistance × 0.3) + (frequency × 0.3) + (context × 0.4)

Pass 2: Grammar validation (new)
  grammarScore = 0.0

  Check:
  - Subject-verb agreement: +0.4
  - Tense consistency: +0.3
  - Article correctness: +0.2
  - Preposition correctness: +0.1

  finalScore = Pass1Score × (1 + grammarScore)

Pass 3: Sentence cohesion (new)
  cohesionScore = 0.0

  Check:
  - Sentence flow: +0.3
  - Word order: +0.2
  - No redundancy: +0.2
  - Logical progression: +0.3

  finalScore = Pass2Score × (1 + cohesionScore)
```

### 6. Grammar Rules Engine

#### Rule Categories

**A. Subject-Verb Agreement**
```javascript
const subjectVerbRules = [
  { pattern: /\b(I)\s+(is|was)\b/gi, correction: "$1 am/was", score: 0.9 },
  { pattern: /\b(he|she|it)\s+(are|were)\b/gi, correction: "$1 is/was", score: 0.9 },
  { pattern: /\b(they|we|you)\s+(is|was)\b/gi, correction: "$1 are/were", score: 0.9 },
  { pattern: /\b(he|she|it)\s+don't\b/gi, correction: "$1 doesn't", score: 0.95 },
  { pattern: /\b(I|we|you|they)\s+doesn't\b/gi, correction: "$1 don't", score: 0.95 }
];
```

**B. Common Grammar Mistakes**
```javascript
const commonGrammarFixes = [
  { wrong: "should of", correct: "should have", confidence: 1.0 },
  { wrong: "could of", correct: "could have", confidence: 1.0 },
  { wrong: "would of", correct: "would have", confidence: 1.0 },
  { wrong: "alot", correct: "a lot", confidence: 1.0 },
  { wrong: "alright", correct: "all right", confidence: 0.8 },
  { wrong: "aswell", correct: "as well", confidence: 1.0 },
  { wrong: "your welcome", correct: "you're welcome", confidence: 0.9 },
  { wrong: "its okay", correct: "it's okay", confidence: 0.8 },
  { wrong: "there are", correct: "their/they're", confidence: 0.7 }  // context dependent
];
```

**C. Article Rules**
```javascript
const articleRules = [
  // 'a' before consonant sounds
  { pattern: /\ba\s+(?=[aeiou])/gi, check: needsAn, correction: "an" },
  // 'an' before consonant sounds
  { pattern: /\ban\s+(?=[^aeiou])/gi, check: needsA, correction: "a" },

  // Special cases
  { pattern: /\ba\s+hour/gi, correction: "an hour" },
  { pattern: /\ban\s+university/gi, correction: "a university" },
  { pattern: /\ban\s+European/gi, correction: "a European" }
];
```

**D. Tense Consistency**
```javascript
function detectSentenceTense(sentence) {
  const pastMarkers = ['yesterday', 'ago', 'last', 'was', 'were', 'had', 'did'];
  const presentMarkers = ['today', 'now', 'currently', 'is', 'are', 'am'];
  const futureMarkers = ['tomorrow', 'will', 'going to', 'shall'];

  // Count markers
  // Return dominant tense
  // Flag tense inconsistencies
}
```

### 7. Correction Memory & Re-evaluation

#### Memory Storage
```javascript
class CorrectionMemory {
  constructor() {
    this.sentences = new Map();  // sentenceId → CorrectionData
    this.maxAge = 5 * 60 * 1000;  // 5 minutes
  }

  addCorrection(sentenceId, correction) {
    if (!this.sentences.has(sentenceId)) {
      this.sentences.set(sentenceId, {
        corrections: [],
        text: "",
        startTime: Date.now(),
        isComplete: false
      });
    }

    this.sentences.get(sentenceId).corrections.push(correction);
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

  async revalidateSentence(sentenceId) {
    const data = this.sentences.get(sentenceId);
    if (!data || !data.isComplete) return;

    // Re-analyze with full sentence context
    const issues = await analyzeFullSentence(data.text);

    // Check if previous corrections are still valid
    for (const correction of data.corrections) {
      const stillValid = validateCorrectionInContext(
        correction,
        data.text,
        issues
      );

      correction.revalidated = true;
      correction.validAfterCompletion = stillValid;

      if (!stillValid) {
        // Log for potential rollback
        console.warn(`Correction may be incorrect: ${correction.originalWord} → ${correction.correctedTo}`);
      }
    }
  }

  cleanupOld() {
    const now = Date.now();
    for (const [id, data] of this.sentences.entries()) {
      if (now - data.startTime > this.maxAge) {
        this.sentences.delete(id);
      }
    }
  }
}
```

#### Re-evaluation Trigger
```javascript
// Trigger re-evaluation when:
1. Sentence ends (., ?, !)
2. User pauses typing (2 seconds)
3. New sentence starts
4. User manually requests (future feature)

async function onSentenceComplete(sentenceId, fullText) {
  // Mark complete
  correctionMemory.markSentenceComplete(sentenceId, fullText);

  // Re-validate all corrections
  await correctionMemory.revalidateSentence(sentenceId);

  // Run full sentence grammar check
  const grammarIssues = checkGrammar(fullText);

  // Apply additional corrections if needed
  if (grammarIssues.length > 0) {
    applySentenceLevelCorrections(grammarIssues);
  }

  // Update statistics
  updateAccuracyMetrics(sentenceId);
}
```

### 8. Robust Accuracy Testing System

#### Advanced Metrics

**A. Precision, Recall, F1 Score**
```javascript
const metrics = {
  truePositives: 0,   // Correct corrections
  falsePositives: 0,  // Incorrect corrections
  falseNegatives: 0,  // Missed errors
  trueNegatives: 0,   // Correctly left unchanged

  precision: TP / (TP + FP),
  recall: TP / (TP + FN),
  f1Score: 2 × (precision × recall) / (precision + recall)
};
```

**B. Error Categories**
```javascript
const errorTypes = {
  spelling: { detected: 0, missed: 0, false: 0 },
  grammar: { detected: 0, missed: 0, false: 0 },
  article: { detected: 0, missed: 0, false: 0 },
  tense: { detected: 0, missed: 0, false: 0 },
  agreement: { detected: 0, missed: 0, false: 0 },
  cohesion: { detected: 0, missed: 0, false: 0 }
};
```

**C. Confidence Calibration**
```javascript
// Measure: How well do confidence scores match accuracy?
const calibration = {
  highConfidence: { correct: 0, total: 0 },   // >0.9
  medConfidence: { correct: 0, total: 0 },    // 0.7-0.9
  lowConfidence: { correct: 0, total: 0 }     // <0.7
};
```

**D. Context Sensitivity**
```javascript
// Measure: Does context improve accuracy?
const contextImpact = {
  withContext: { correct: 0, total: 0 },
  withoutContext: { correct: 0, total: 0 },
  improvement: 0
};
```

#### Enhanced Test Suite

**New Test Categories:**

1. **Grammar Tests** (50 cases)
   - Subject-verb agreement
   - Tense consistency
   - Article usage
   - Pronoun agreement
   - Preposition correction

2. **Sentence Cohesion Tests** (30 cases)
   - Multi-word corrections
   - Context-dependent choices
   - Sentence flow
   - Logical consistency

3. **Re-evaluation Tests** (20 cases)
   - Corrections that change with more context
   - Ambiguous cases resolved by full sentence
   - Word order corrections

4. **Edge Cases** (25 cases)
   - Proper nouns
   - Technical terms
   - Slang and informal language
   - Mixed languages
   - Incomplete sentences

**Test Format:**
```javascript
{
  input: "he dont like apples",
  expected: "he doesn't like apples",
  errorType: "grammar",
  category: "subject-verb-agreement",
  difficulty: "easy",
  contextRequired: false,
  sentenceLevel: true
}
```

### 9. Performance Considerations

#### Memory Management
```javascript
- Correction memory: Max 100 sentences
- Auto-cleanup: Every 30 seconds
- Max age: 5 minutes per sentence
- Estimated memory: 5-10 MB additional
```

#### Processing Time
```javascript
- Word correction: <50ms (existing)
- Grammar check: <20ms per word
- Sentence analysis: <100ms per sentence
- Re-evaluation: <150ms per sentence
- Total overhead: ~200ms per sentence
```

#### Optimization Strategies
```javascript
1. Debounce sentence analysis (2-second pause)
2. Cache grammar rule matches
3. Lazy-load grammar patterns
4. Limit re-evaluation to changed sentences
5. Use Web Worker for heavy analysis (future)
```

### 10. Success Metrics

#### Target Improvements

| Metric | Current | Target | How to Achieve |
|--------|---------|--------|----------------|
| Overall Accuracy | 93% | 95%+ | Grammar + cohesion |
| Grammar Detection | N/A | 85%+ | Grammar rules engine |
| False Positives | ~5% | <3% | Sentence re-evaluation |
| Context Utilization | ~40% | 60%+ | Enhanced weighting |
| F1 Score | N/A | 0.90+ | Balanced precision/recall |

#### User Experience Goals
- No noticeable performance degradation
- Fewer incorrect corrections
- Better multi-word corrections
- Smoother typing experience
- Transparent re-evaluation

---

## Implementation Priority

1. **Phase 1** (High Priority):
   - Enhanced frequency weighting
   - Correction memory system
   - Basic grammar rules (subject-verb, common mistakes)
   - Sentence completion detection

2. **Phase 2** (Medium Priority):
   - Full sentence re-evaluation
   - Advanced grammar rules (articles, tense)
   - Improved testing metrics

3. **Phase 3** (Future):
   - Machine learning integration
   - Advanced cohesion analysis
   - Multi-sentence context
   - User correction learning

---

## Testing Strategy

1. **Unit Tests**: Individual grammar rules
2. **Integration Tests**: Memory + re-evaluation
3. **Performance Tests**: Timing and memory usage
4. **Accuracy Tests**: New comprehensive test suite
5. **Real-world Tests**: Manual testing on various content

Target: 95%+ accuracy with <200ms additional latency per sentence.
