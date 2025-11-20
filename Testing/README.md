# AutoCorrect Comprehensive Test Suite

## Quick Start

1. **Start your backend**:
   ```bash
   cd backend
   python run.py
   ```

2. **Open the test suite**:
   ```bash
   Testing/comprehensive_test.html
   ```

3. **Click "Run All Tests"** to start

---

## Features

### 📊 Test Categories

1. **Spelling Tests** (15 tests)
   - Common misspellings (teh, recieve, seperate, etc.)
   - Tests Levenshtein distance algorithm

2. **Grammar Tests** (4 tests)
   - Multi-word corrections (alot → a lot)
   - Grammar pattern fixes

3. **Edge Cases** (6 tests)
   - Single letters, empty strings
   - Mixed alphanumeric, punctuation
   - All caps, special characters

4. **Performance Tests** (2 tests)
   - Large context (50+ words)
   - Long words (50+ characters)

### 📈 Metrics Tracked

- **Accuracy**: % of tests passed
- **Avg Time**: Average correction time
- **P95 Time**: 95th percentile response time
- **Pass/Fail Count**: Visual breakdown

### 🎯 Test Modes

- **All Tests**: Run everything (default)
- **Spelling Only**: Just spelling corrections
- **Grammar Only**: Just grammar fixes
- **Performance Only**: Stress test
- **Edge Cases Only**: Boundary conditions

---

## Configuration

### Backend URL
Default: `http://localhost:8000`

Change this if your backend runs on a different port.

### Iterations
Run tests multiple times to check consistency.
- Default: 1
- Max: 10

---

## Expected Results

### Good Performance
- ✅ **Accuracy**: 95%+
- ✅ **Avg Time**: < 200ms
- ✅ **P95 Time**: < 500ms

### Warning Zone
- ⚠️ **Accuracy**: 80-95%
- ⚠️ **Avg Time**: 200-500ms
- ⚠️ **P95 Time**: 500-1000ms

### Needs Work
- ❌ **Accuracy**: < 80%
- ❌ **Avg Time**: > 500ms
- ❌ **P95 Time**: > 1000ms

---

## Export Results

Click **"Export Results (JSON)"** to save test results with:
- Timestamp
- Summary metrics
- Performance stats (min/max/avg/p95)
- List of failed tests

Example output:
```json
{
  "timestamp": "2025-11-20T10:30:00.000Z",
  "summary": {
    "total": 27,
    "passed": 26,
    "failed": 1,
    "accuracy": "96.30%"
  },
  "times": {
    "average": "145.23ms",
    "min": "89.12ms",
    "max": "423.56ms",
    "p95": "298.44ms"
  },
  "failures": [
    {
      "test": { "input": "teh", "expected": "the" },
      "result": { "corrected": "teh", "time": 145.2 }
    }
  ]
}
```

---

## Troubleshooting

### Backend Connection Failed
```
❌ Backend health check failed: Failed to fetch
```

**Solution**:
1. Check backend is running: `curl http://localhost:8000/health`
2. Check correct port in test suite config
3. Check CORS is enabled in backend

### Tests Timing Out
```
⚠️ Avg Time: 5000ms
```

**Solution**:
1. First request downloads model (~850MB) - takes 1-2 minutes
2. Subsequent requests should be < 200ms
3. Restart backend to reload models

### Low Accuracy
```
❌ Accuracy: 65%
```

**Solution**:
1. Check which tests are failing
2. Review model performance
3. Consider using smaller test dataset initially

---

## Adding Custom Tests

Edit `TEST_DATASETS` in `comprehensive_test.html`:

```javascript
const TEST_DATASETS = {
  spelling: [
    { input: 'your_misspelling', expected: 'correction', context: ['some', 'context'] },
    // Add more...
  ]
};
```

---

## Next Steps

Once tests pass consistently:
1. Add more test cases from real-world data
2. Test with actual Chrome extension
3. Benchmark against other spell checkers
4. Optimize based on performance metrics
