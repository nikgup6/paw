const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'styles', 'index.css');
let content = fs.readFileSync(cssPath, 'utf8');

content = content.replace(/'Outfit',\s*'Outfit',\s*sans-serif/g, "'Fredoka', sans-serif");
content = content.replace(/'Outfit',\s*sans-serif/g, "'Fredoka', sans-serif");

fs.writeFileSync(cssPath, content, 'utf8');
console.log('Fonts updated in index.css');
