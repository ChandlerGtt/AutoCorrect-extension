# Testing Guide - AI AutoCorrect Extension

## Prerequisites Checklist

✅ All files in place:
- background.js (AI engine)
- content.js (page interaction)
- popup.html/js (UI)
- manifest.json (extension config)
- 586 dictionary shards in assets/shards/

## Step-by-Step Testing Instructions

### Step 1: Load Extension in Chrome

1. Open Chrome browser
2. Navigate to: `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"** button
5. Select this directory: `/home/user/AutoCorrect-extension`
6. Verify extension loads without errors

**Expected Result:**
- Extension icon appears in toolbar
- No errors in console
- Badge shows no text (enabled state)

### Step 2: Configure Extension Mode

1. Click the extension icon in toolbar
2. Select **"Auto Correct"** mode (should be default)
3. Verify status shows: "✨ Auto-correcting on..."
4. Close popup

**Why?** The test suite requires auto-correct mode to automatically apply corrections.

### Step 3: Open Test Suite

1. In Chrome, open: `file:///home/user/AutoCorrect-extension/Testing/test_suite.html`

   **Or** right-click `test_suite.html` → "Open with" → Chrome

2. You should see the AutoCorrect Test Suite interface with:
   - Purple gradient header
   - "Run All Tests" button
   - Test statistics (0/0 initially)
   - Empty results table

### Step 4: Run Tests

1. Click the **"▶️ Run All Tests"** button
2. Watch the progress bar fill up
3. Tests will run automatically (takes ~10-20 seconds for 47 tests)
4. Results will populate in real-time

**What's happening:**
- Test suite types misspelled words into hidden input field
- Extension detects and corrects them
- Suite verifies corrections match expected values
- Each test shows: Misspelled → Corrected → Expected → Pass/Fail

### Step 5: Analyze Results

**Target: 90%+ Accuracy (42+ out of 47 tests passing)**

#### Check Overall Metrics:
- **Total Tests**: Should show 47
- **Passed**: Look for 42+ (90%+)
- **Failed**: Should be 5 or fewer
- **Accuracy**: Should show 90.0% or higher

#### Review Individual Results:
Scroll through results table to see:
- ✅ Green rows: Successful corrections
- ❌ Red rows: Failed corrections

#### Common Expected Failures:
Some tests may fail due to dictionary variations:
1. **Phonetic variants** (if not in dictionary):
   - nite → night
   - lite → light
   - rite → right
   - thru → through

2. **Less common words**:
   - Some technical or specialized terms

### Step 6: Verify Context Awareness

1. Open Chrome DevTools (F12)
2. Go to **Console** tab
3. Look for logs showing context analysis:

```
🔍 Context analysis: 3 words, domain: general, prev: "the"
📊 Top suggestions for "teh":
  1. "the" (score: 0.850, edit: 0.500, freq: 1.000, ctx: 0.500)
  2. "ten" (score: 0.420, edit: 0.333, freq: 0.100, ctx: 0.000)
  3. "tea" (score: 0.383, edit: 0.333, freq: 0.150, ctx: 0.000)
```

**What to verify:**
- Context words are extracted (10-word window)
- Domain detection working (technical, business, casual, etc.)
- Multi-factor scoring visible (edit, freq, context)
- Context score influences ranking

### Step 7: Export Results (Optional)

1. Click **"📥 Export Results (CSV)"** button
2. Download will contain all test results
3. Open in spreadsheet for detailed analysis

**CSV Format:**
```
Misspelled,Corrected To,Expected,Context,Result
teh,the,the,teh quick brown,PASS
recieve,receive,receive,I will recieve it,PASS
...
```

### Step 8: Test Custom Words

Use the custom test input field:
1. Type a misspelled word (e.g., "teh")
2. Press space or punctuation
3. Watch it auto-correct in real-time
4. Check console for correction logs

**Example Test Cases:**
- `teh` → should correct to `the`
- `recieve` → should correct to `receive`
- `occured` → should correct to `occurred`
- `seperate` → should correct to `separate`

## Expected Test Results

### 47 Test Cases Breakdown:

| Category | Count | Expected Pass Rate |
|----------|-------|-------------------|
| Common typos | 16 | 95-100% (15-16) |
| Double letters | 5 | 90-100% (4-5) |
| Transpositions | 5 | 95-100% (4-5) |
| Phonetic errors | 4 | 75-100% (3-4) |
| Missing letters | 5 | 90-100% (4-5) |
| Extra letters | 1 | 100% (1) |
| Other mistakes | 11 | 85-95% (9-10) |
| **TOTAL** | **47** | **90%+ (42+)** |

### Known Challenging Cases:

1. **"succesful" → "successful"** (double 's')
   - May suggest "successful" or "successful"
   - Depends on edit distance calculation

2. **Phonetic variants** (if not in 370K dictionary):
   - "nite" → "night"
   - "lite" → "light"
   - May return no correction if phonetic rules don't match

3. **Context-dependent homonyms**:
   - "read" (past) vs "read" (present)
   - Requires context analysis

## Troubleshooting

### Tests Not Running
**Problem:** Clicking "Run All Tests" does nothing

**Solutions:**
1. Check extension is loaded: `chrome://extensions`
2. Verify extension is enabled (not paused)
3. Check browser console for errors (F12)
4. Reload extension: `chrome://extensions` → Reload button
5. Refresh test_suite.html page

### Low Accuracy (<90%)
**Problem:** Many tests failing

**Solutions:**
1. Verify dictionary loaded:
   - Open extension background console: `chrome://extensions` → Inspect service worker
   - Look for: "✅ Loaded 370105 words from shards"
   - If error, regenerate shards: `node scripts/build-dict.js`

2. Check extension mode:
   - Click extension icon
   - Ensure "Auto Correct" mode is selected
   - Not "Off" or "Suggestions"

3. Clear extension cache:
   - `chrome://extensions` → Remove extension
   - Reload extension
   - Run tests again

### Extension Not Correcting
**Problem:** No corrections happening during tests

**Solutions:**
1. Check site isn't paused:
   - Extension icon → verify status
   - Should show "Active" not "Paused"

2. Verify content script loaded:
   - F12 → Console tab
   - Should see: "✅ AutoCorrect AI ready - Context-aware with multiple modes"

3. Check for JavaScript errors:
   - F12 → Console
   - Look for red error messages

### Dictionary Not Loading
**Problem:** Console shows "Using fallback dictionary"

**Solutions:**
1. Verify shards exist:
   ```bash
   ls assets/shards/ | wc -l
   # Should show: 586
   ```

2. Regenerate shards:
   ```bash
   node scripts/build-dict.js
   ```

3. Check file permissions:
   ```bash
   ls -la assets/shards/ | head
   # All files should be readable
   ```

## Success Criteria

✅ **90%+ Accuracy**: 42+ out of 47 tests passing
✅ **Context Awareness**: Console shows context analysis logs
✅ **Domain Detection**: Logs show domain identification
✅ **Multi-Factor Scoring**: Edit, frequency, and context scores visible
✅ **Fast Performance**: Tests complete in <30 seconds
✅ **No Errors**: Clean console, no red error messages

## Performance Benchmarks

When running tests, you should observe:
- **Dictionary Load**: 500-1000ms (logged in background console)
- **Per-Correction Time**: <50ms average
- **Memory Usage**: Check `chrome://extensions` → Details → "Inspect service worker" → Memory tab
  - Should be 15-20 MB
- **Test Suite Completion**: ~10-20 seconds for all 47 tests

## Next Steps After Testing

### If Tests Pass (90%+):
1. ✅ System is working as designed
2. Try real-world usage in text fields
3. Test different websites
4. Export results for documentation

### If Tests Fail (<90%):
1. Review console logs for patterns
2. Check which categories are failing
3. Verify dictionary completeness
4. Consider adjusting scoring weights in `background.js`
5. Report issues with specific test case details

## Advanced Testing

### Test Different Modes:

1. **Auto Mode** (default):
   - Run test suite as described
   - Should show 90%+ accuracy

2. **Suggestions Mode**:
   - Change mode in popup
   - Type in custom input field
   - Check console for suggestion logs
   - Verify 3 suggestions appear

3. **Off Mode**:
   - Change mode to "Off"
   - Type misspellings
   - Verify NO corrections happen

### Test Context Awareness:

Type these examples in custom input field and watch console:

```
Technical context:
"The funciton returns data" → should boost "function"

Business context:
"Meeting with clent tomorrow" → should boost "client"

Casual context:
"Had fun with frend yesterday" → should boost "friend"
```

### Test Domain Detection:

Check console logs for domain identification:
- "code, program, data" → should detect "technical"
- "meeting, sales, client" → should detect "business"
- "study, research, paper" → should detect "academic"

## Manual Verification

Beyond automated tests, manually verify:

1. **Real websites**: Try in Gmail, Google Docs, Facebook, Twitter
2. **Different text fields**: Textarea, input, contenteditable
3. **Edge cases**: Very long words, numbers, mixed case
4. **Performance**: Typing should feel smooth and responsive
5. **Visual feedback**: In auto mode, corrections should be seamless

## Reporting Results

When sharing test results, include:
1. Overall accuracy percentage
2. Number of passed/failed tests
3. List of failed test cases
4. Screenshots of results table
5. Console logs showing context analysis
6. Performance metrics (load time, correction time)

---

**Ready to test?** Follow steps 1-5 above and verify your AI autocorrect achieves 90%+ accuracy! 🎯
