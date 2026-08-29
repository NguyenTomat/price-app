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
        console.log(`User says: ${obj.content}`);
      }
    } catch (e) {
      // ignore
    }
  }
}
search();
