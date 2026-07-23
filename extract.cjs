const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Find the script block containing 'const breeds ='
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
let extracted = false;

while ((match = scriptRegex.exec(html)) !== null) {
  const code = match[1];
  if (code.includes('const breeds =') && code.includes('const questions =')) {
    
    // We will evaluate the code but stub out document, window, etc.
    const sandboxCode = `
      let window = {};
      let document = {
        getElementById: () => ({ style: {}, addEventListener: () => {} }),
        querySelectorAll: () => ([]),
        querySelector: () => ({ addEventListener: () => {} }),
        addEventListener: () => {}
      };
      let localStorage = { getItem: () => null, setItem: () => {} };
      let supabaseClient = { from: () => ({ select: () => ({ order: () => ({}) }) }) };
      
      ${code.replace(/document\.addEventListener/g, '//').replace(/window\./g, 'window_mock.')}
      
      return { breeds: typeof breeds !== 'undefined' ? breeds : [], questions: typeof questions !== 'undefined' ? questions : [] };
    `;
    
    try {
      const func = new Function(sandboxCode);
      const data = func();
      fs.writeFileSync('backend/breeds.json', JSON.stringify(data.breeds, null, 2));
      fs.writeFileSync('backend/questions.json', JSON.stringify(data.questions, null, 2));
      console.log('Successfully extracted breeds and questions!');
      extracted = true;
      break;
    } catch (e) {
      console.error('Error during eval:', e.message);
      
      // Fallback: extract using pure text slicing
      try {
          const breedsStart = code.indexOf('const breeds = [');
          const breedsEnd = code.indexOf('];', breedsStart) + 1;
          const questionsStart = code.indexOf('const questions = [');
          const questionsEnd = code.indexOf('];', questionsStart) + 1;
          
          if (breedsStart > -1 && questionsStart > -1) {
              const bCode = code.substring(breedsStart, breedsEnd).replace('const breeds = ', '');
              const qCode = code.substring(questionsStart, questionsEnd).replace('const questions = ', '');
              
              // This is dirty but can work if evaluated directly
              const func2 = new Function('return { breeds: ' + bCode + ', questions: ' + qCode + ' };');
              const data2 = func2();
              fs.writeFileSync('backend/breeds.json', JSON.stringify(data2.breeds, null, 2));
              fs.writeFileSync('backend/questions.json', JSON.stringify(data2.questions, null, 2));
              console.log('Successfully extracted using fallback!');
              extracted = true;
          }
      } catch (e2) {
          console.error('Fallback error:', e2);
      }
    }
  }
}

if (!extracted) {
  console.log('Failed to extract data.');
}
