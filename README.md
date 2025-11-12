# AutoCorrect Extension (Chrome MV3)

## Setup
1) Install deps and copy pako:
   npm init -y
   npm i pako
   copy .\node_modules\pako\dist\pako.min.js .\libs\pako.min.js

2) Generate dictionary shards:
   node scripts/build-dict.js "C:\path\to\words.txt"

3) Load in Chrome:
   chrome://extensions → Developer mode → Load unpacked → select this folder
