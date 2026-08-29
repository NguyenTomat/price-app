const fs = require('fs');
const readline = require('readline');
const path = 'C:\\Users\\Acer\\.gemini\\antigravity\\brain\\6982e481-3b93-4b51-8987-5dbd13af03e0\\.system_generated\\logs\\transcript.jsonl';

async function search() {
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT') {
        // Look for timestamp
        const timeMatch = obj.content.match(/local time is:\s*2026-07-31T([0-9]{2}):[0-9]{2}:[0-9]{2}/);
        if (timeMatch) {
          const hour = parseInt(timeMatch[1]);
          if (hour >= 6 && hour <= 13) {
            console.log(`[Hour ${hour}] User: ${obj.content}`);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}
search();
