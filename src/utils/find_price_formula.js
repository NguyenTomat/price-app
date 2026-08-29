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
      const content = obj.content || '';
      if (content.includes('công thức') || content.includes('giá bán') || content.includes('giá niêm yết') || content.includes('giá gốc') || content.includes('giá web')) {
        console.log(`Type: ${obj.type}`);
        console.log(`Content: ${content}`);
        console.log('---');
      }
    } catch (e) {
      // ignore
    }
  }
}
search();
