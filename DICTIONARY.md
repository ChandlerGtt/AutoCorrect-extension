# Sharded English Dictionary

## Overview

This AutoCorrect extension uses a comprehensive sharded English dictionary containing **370,105 words** distributed across **586 compressed shard files**.

## Dictionary Statistics

- **Total Words**: 370,105 unique English words
- **Shard Files**: 586 files (out of 702 possible shards)
- **Total Size**: 1.3 MB compressed (~1.07 MB data + filesystem overhead)
- **Average Shard Size**: ~1,867 bytes compressed
- **Compression**: gzip level 9 (maximum compression)
- **Source**: English Words dataset (public domain)

## Shard Structure

Words are distributed into shards based on their first two letters:

### Single-letter prefixes (26 shards)
- `a_.txt.gz` - words starting with 'a' only (single letter)
- `b_.txt.gz` - words starting with 'b' only
- ... through `z_.txt.gz`

### Two-letter prefixes (676 shards)
- `aa.txt.gz` - words starting with 'aa'
- `ab.txt.gz` - words starting with 'ab'
- `th.txt.gz` - words starting with 'th' (2,712 words including "the", "their", "through")
- `un.txt.gz` - largest shard with 20,146 words
- ... through `zz.txt.gz`

## File Format

Each shard file contains:
- Plain text with one word per line
- Lowercase alphabetic characters only (`[a-z]+`)
- Sorted alphabetically
- Compressed with gzip

Example content (decompressed):
```
the
theater
theatre
theatrical
thee
theft
their
theirs
them
theme
...
```

## Building the Dictionary

To rebuild or update the dictionary:

```bash
# Using a custom word list
node scripts/build-dict.js /path/to/words.txt

# Using built-in common words (generates ~2000 words)
node scripts/build-dict.js
```

### Requirements
- Node.js (v12+)
- Input file: plain text, one word per line

### Build Process
1. Loads and validates words (lowercase, alphabetic only)
2. Distributes words into 702 possible shards by prefix
3. Sorts and deduplicates within each shard
4. Compresses with gzip level 9
5. Writes to `assets/shards/*.txt.gz`

## Dictionary Loading (Runtime)

The extension loads dictionary shards dynamically:

1. **Background Service Worker** (`background.js`)
   - Attempts to load all 702 possible shards on startup
   - Uses native `DecompressionStream` API for efficient decompression
   - Stores words in a JavaScript `Set` for O(1) lookup
   - Falls back to 94-word hardcoded dictionary if shards unavailable

2. **Loading Performance**
   - ~500-1000ms to load all shards on first launch
   - ~370,105 words loaded into memory
   - ~15-20 MB memory footprint (in-memory Set)

3. **Fallback Behavior**
   - If `assets/shards/` is unavailable, uses minimal hardcoded dictionary
   - Logs progress every 50 shards during loading
   - Continues loading remaining shards even if some fail

## Dictionary Coverage

The dictionary includes:

### Common Words
- Top 1000+ most frequently used English words
- Articles, pronouns, conjunctions, prepositions
- Essential verbs, adjectives, and nouns

### Technical Terms
- Computer and technology vocabulary
- Software development terms
- Internet and web-related words

### Time and Date
- Days of the week
- Months of the year
- Common time expressions

### Numbers
- Number words (zero through billion)
- Ordinal numbers

### Spelling Corrections
All commonly misspelled words and their corrections:
- ✓ "receive" (not "recieve")
- ✓ "occurred" (not "occured")
- ✓ "separate" (not "seperate")
- ✓ "definitely" (not "definately")
- ✓ "necessary" (not "neccessary")
- And many more...

### Phonetic Alternatives
- "night" (phonetic: "nite")
- "light" (phonetic: "lite")
- "right" (phonetic: "rite")
- "through" (phonetic: "thru")
- And others...

## File Locations

```
AutoCorrect-extension/
├── assets/
│   └── shards/              # Dictionary shard files (586 files)
│       ├── a_.txt.gz
│       ├── aa.txt.gz
│       ├── ab.txt.gz
│       ├── ...
│       └── zz.txt.gz
├── scripts/
│   └── build-dict.js        # Dictionary builder script
└── DICTIONARY.md            # This file
```

## Maintenance

### Updating the Dictionary

To add new words or update the dictionary:

1. Edit or replace the source word list file
2. Run the build script: `node scripts/build-dict.js /path/to/updated-words.txt`
3. New shards will overwrite existing ones in `assets/shards/`

### Adding Custom Words

To add specific words without rebuilding:

1. Determine the shard (first two letters of word)
2. Decompress the shard: `gunzip assets/shards/[prefix].txt.gz`
3. Add word(s) to the text file
4. Sort and recompress: `sort -u [prefix].txt | gzip -9 > [prefix].txt.gz`

### Git Ignore

The `assets/shards/` directory is in `.gitignore` to keep the repository clean. Generate shards locally using the build script.

## Performance Considerations

### Memory Usage
- **Runtime**: ~15-20 MB for full dictionary in memory
- **Storage**: ~1.3 MB compressed, ~3-4 MB decompressed

### Lookup Performance
- **Dictionary check**: O(1) - JavaScript Set lookup
- **Not in dictionary**: ~1-5ms for edit distance calculations
- **Suggestion generation**: ~5-20ms depending on word complexity

### Optimization Opportunities
1. **Lazy Loading**: Load only needed shards on demand (currently loads all)
2. **Web Worker**: Move dictionary to worker (alternative implementation exists)
3. **LRU Cache**: Cache frequently used shards (implemented in worker.js)
4. **Indexing**: Pre-compute common misspellings for faster lookup

## Testing

Test the dictionary with the test suite:

1. Open `Testing/test_suite.html` in Chrome
2. Load the extension with updated dictionary
3. Run all 47 test cases
4. Expected: 44+ passing tests (93.6%+ accuracy)

### Key Test Words
The dictionary includes all test case corrections:
- ✓ "the" (from "teh")
- ✓ "receive" (from "recieve")
- ✓ "successful" (from "succesful")
- ✓ "night" (from "nite")
- ✓ "light" (from "lite")
- ✓ "right" (from "rite")
- ✓ "through" (from "thru")

## Troubleshooting

### Dictionary not loading
1. Check browser console for error messages
2. Verify `assets/shards/` directory exists
3. Verify at least some `.txt.gz` files exist
4. Check file permissions (files should be readable)

### Poor autocorrect accuracy
1. Verify dictionary loaded successfully (check console logs)
2. Ensure shards were generated from quality word list
3. Test specific failing words with test suite
4. Consider adding custom words for domain-specific vocabulary

### High memory usage
- Expected: ~15-20 MB for full dictionary
- If higher: Check for duplicate word loading or memory leaks
- Consider lazy-loading optimization for memory-constrained environments

## References

- **Word List Source**: [dwyl/english-words](https://github.com/dwyl/english-words) (public domain)
- **Algorithm**: Edit distance (Levenshtein) with frequency-based ranking
- **Compression**: gzip (RFC 1952)
- **Browser API**: [DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream)

---

Last updated: 2025-11-12
Dictionary version: 1.0
Total words: 370,105
