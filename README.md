# AI-Powered AutoCorrect Chrome Extension

An intelligent, context-aware autocorrect Chrome extension with 370,000+ word dictionary and multiple correction modes.

## ✨ Features

### 🧠 AI Context Awareness
- **10-Word Context Window**: Analyzes surrounding text for better corrections
- **Content Domain Detection**: Understands technical, business, academic, and casual writing
- **Bigram/Trigram Analysis**: Uses common word patterns to rank suggestions
- **Smart Ranking**: Multi-factor scoring (edit distance + frequency + context)

### 🎯 Three Correction Modes

1. **Auto Correct** (Default)
   - Automatically applies top suggestion as you type
   - Non-blocking, smooth typing experience
   - Instant corrections on space, punctuation, Enter

2. **Suggestions Only**
   - Shows 3 ranked suggestions
   - You choose which correction to apply
   - Helpful for learning and verification

3. **Off**
   - Completely disabled
   - Zero performance impact

### 📚 Extensive Dictionary
- **370,105 words** from public domain sources
- **586 compressed shards** (1.3 MB total)
- **O(1) lookup** using JavaScript Set
- **Common misspellings database** (30+ rules)
- **Phonetic alternatives** (nite→night, lite→light, etc.)

## 🚀 Installation

### Quick Start

```bash
# 1. Install dependencies
npm init -y
npm i pako
cp node_modules/pako/dist/pako.min.js libs/pako.min.js

# 2. Generate dictionary shards (already done if using git)
node scripts/build-dict.js

# 3. Load in Chrome
# Navigate to: chrome://extensions
# Enable "Developer mode" (top right)
# Click "Load unpacked"
# Select this directory
```

### From Source

```bash
git clone https://github.com/ChandlerGtt/AutoCorrect-extension.git
cd AutoCorrect-extension
node scripts/build-dict.js  # Generate dictionary shards
# Then load in Chrome as above
```

## 📖 Usage

### Basic Usage

1. **Type in any text field** across the web
2. **Misspell a word** (e.g., "teh")
3. **Press space** or punctuation
4. **Watch the magic** ✨ - word is corrected to "the"

### Mode Selection

Click the extension icon in toolbar to:
- Choose **Auto Correct**, **Suggestions Only**, or **Off**
- Enable/disable globally
- Pause on specific websites

## 🧪 Testing

### Run Test Suite

1. Open `Testing/test_suite.html` in Chrome
2. Ensure extension is loaded and enabled in "Auto" mode
3. Click **"▶️ Run All Tests"**
4. View results and accuracy metrics

### Expected Accuracy

- **Target**: 90%+ overall accuracy
- **47 test cases** covering:
  - Common typos (teh → the)
  - Double letters (occured → occurred)
  - Transpositions (thsi → this)
  - Phonetic (nite → night)
  - Missing letters (becase → because)

## 🏗️ Architecture

### AI Algorithm

```javascript
Score = (EditDistance × 0.3) + (Frequency × 0.3) + (Context × 0.4)

Context Score factors:
  - Bigram match (0.5): "went" → "to" is common
  - Trigram match (0.4): "in order to" is a pattern
  - Domain boost (0.3): "code" fits technical domain
  - Repetition (0.2): word appears in context
```

### File Structure

```
AutoCorrect-extension/
├── manifest.json           # Chrome extension manifest (MV3)
├── background.js          # AI correction logic + dictionary loading
├── content.js             # Page interaction + mode handling
├── popup.html/js          # Extension UI
├── assets/
│   └── shards/            # 586 compressed dictionary files
├── scripts/
│   └── build-dict.js      # Dictionary builder
├── Testing/
│   └── test_suite.html    # Automated test suite
├── AI_DESIGN.md           # AI algorithm documentation
├── DICTIONARY.md          # Dictionary system docs
└── README.md              # This file
```

## 📊 Performance

- **Dictionary Load Time**: ~500-1000ms (first launch)
- **Correction Time**: <50ms average
- **Memory Usage**: ~15-20 MB
- **Storage**: 1.3 MB compressed
- **Test Accuracy**: 90%+ on 47 test cases

## 🐛 Troubleshooting

### Dictionary Not Loading

**Symptom**: Few or no corrections
**Solution**:
1. Check console: `chrome://extensions` → Details → Inspect service worker
2. Verify shards: `ls assets/shards/` should show 586 files
3. Regenerate: `node scripts/build-dict.js`

### Extension Not Working

**Solution**:
1. Check if site is paused (click extension icon)
2. Verify extension is enabled globally
3. Reload extension from chrome://extensions

## 📄 Documentation

- **AI Algorithm**: See [AI_DESIGN.md](AI_DESIGN.md) for detailed algorithm documentation
- **Dictionary System**: See [DICTIONARY.md](DICTIONARY.md) for dictionary architecture
- **Test Results**: Run test suite in `Testing/test_suite.html`

## 📞 Support

- **Issues**: https://github.com/ChandlerGtt/AutoCorrect-extension/issues
- **Repository**: https://github.com/ChandlerGtt/AutoCorrect-extension

---

| Context-Aware Autocorrection | 370K+ Words | 90%+ Accuracy
