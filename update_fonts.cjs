const fs = require('fs');
const path = 'paw_buddy.html';
let content = fs.readFileSync(path, 'utf8');

// Replace Google Fonts
content = content.replace(
  /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Syne[^>]+>/,
  '<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">'
);

// Replace font families
content = content.replace(/font-family:\s*'DM Sans',\s*sans-serif;/g, "font-family: Georgia, 'Times New Roman', Times, serif;");
content = content.replace(/font-family:\s*'Syne',\s*sans-serif;/g, "font-family: 'Lora', serif;");

// Ensure .hero p is centered
content = content.replace(/margin-bottom: 40px;\s*animation: fadeInDown/g, "margin: 0 auto 40px auto; text-align: center;\n  animation: fadeInDown");

fs.writeFileSync(path, content, 'utf8');
console.log('Fonts and alignment updated successfully.');
