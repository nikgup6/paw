const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/context/AuthContext.jsx',
  'src/pages/AdminDashboard.jsx',
  'src/pages/Profile.jsx',
  'src/pages/Results.jsx',
  'src/pages/Signup.jsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add API_URL definition if it doesn't exist
    if (!content.includes('const API_URL =')) {
      // Find the last import statement
      const importMatches = [...content.matchAll(/import .* from .*/g)];
      if (importMatches.length > 0) {
        const lastImportIndex = importMatches[importMatches.length - 1].index + importMatches[importMatches.length - 1][0].length;
        content = content.slice(0, lastImportIndex) + '\n\nconst API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";\n' + content.slice(lastImportIndex);
      }
    }

    // Replace all instances
    content = content.replace(/http:\/\/localhost:8000/g, '${API_URL}');
    // Fix string interpolation syntax where it was a regular string
    content = content.replace(/'\$\{API_URL\}([^']*)'/g, '`${API_URL}$1`');

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
