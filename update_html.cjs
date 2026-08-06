const fs = require('fs');
const path = 'paw_buddy.html';

let content = fs.readFileSync(path, 'utf8');

// 1. Remove all emojis from the file
const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu;
content = content.replace(emojiRegex, '');

// Clean up left over objects like icon:"" or emoji:""
content = content.replace(/emoji:"\s*"/g, 'emoji:""');
content = content.replace(/icon:"\s*"/g, 'icon:""');
content = content.replace(/<span class="opt-icon">\s*<\/span>/g, '');
content = content.replace(/<span class="breed-emoji">\s*<\/span>/g, '');

// 2. Insert Admin Login Section
const adminLoginHTML = `
<!-- ADMIN LOGIN -->
<section id="admin-login-section" style="display:none;">
  <div class="admin-wrap" style="max-width: 400px; margin: 100px auto; padding: 40px; background: white; border-radius: 20px; box-shadow: var(--shadow-lg); text-align: center;">
    <h2 style="margin-bottom: 20px;">Admin Login</h2>
    <input type="password" id="admin-pwd" placeholder="Enter Password" style="width: 100%; padding: 15px; border-radius: 10px; border: 1px solid #ccc; margin-bottom: 20px; font-size: 16px;">
    <button onclick="checkAdminLogin()" class="btn-primary" style="width: 100%; padding: 15px; font-size: 16px;">Login</button>
    <button onclick="showHero()" style="margin-top: 15px; background: none; border: none; color: #888; cursor: pointer;">Cancel</button>
  </div>
</section>
`;

content = content.replace('<!-- ADMIN (hidden) -->', adminLoginHTML + '\n<!-- ADMIN (hidden) -->');

// Update showSection to include admin-login-section
content = content.replace("['hero-section','quiz-section','results-section','compare-section','admin-section']", "['hero-section','quiz-section','results-section','compare-section','admin-section','admin-login-section']");

// Update showAdmin and checkAdminLogin logic
const adminScript = `
function showAdminLogin() {
  showSection('admin-login-section');
  document.getElementById('main-footer').style.display = 'block';
}

async function checkAdminLogin() {
  const pwd = document.getElementById('admin-pwd').value;
  if (pwd !== "pawbuddy123") {
    alert("Incorrect password.");
    return;
  }
  await loadAdminData();
}

async function loadAdminData() {
  // Fetch from Supabase
  try {
    const { data, error } = await supabaseClient.from('survey_responses').select('response');
    if (!error && data) {
      adminData.yes = data.filter(r => r.response === 'yes').length;
      adminData.no = data.filter(r => r.response === 'no').length;
    }
  } catch (err) {
    console.error('Error fetching admin data:', err);
  }

  document.getElementById('admin-yes').textContent = adminData.yes;
  document.getElementById('admin-no').textContent = adminData.no;
  const total = adminData.yes + adminData.no;
  const rate = total > 0 ? Math.round((adminData.yes/total)*100) : 0;
  document.getElementById('admin-rate').textContent = total > 0
    ? \`\${rate}% of visitors said YES (\${total} total responses)\`
    : 'No responses yet';
  showSection('admin-section');
  document.getElementById('main-footer').style.display = 'block';
}
`;

// Replace old showAdmin
const oldShowAdminRegex = /async function showAdmin\(\) \{[\s\S]*?showSection\('admin-section'\);\n  document\.getElementById\('main-footer'\)\.style\.display = 'block';\n\}/;
content = content.replace(oldShowAdminRegex, adminScript);

// Update footer link to point to showAdminLogin
content = content.replace('onclick="showAdmin();', 'onclick="showAdminLogin();');

// 3. Update shareNative to include Canvas Image
const nativeShareScript = `
async function shareNative() {
  const top = topBreeds[0];
  const others = topBreeds.slice(1,4).map(b=>b.name).join(', ');
  const txt = \`I just found my perfect dog match on Paw Buddy!\\n\\n#1 Match: \${top.name}\\nAlso great: \${others}\\n\\nFind YOUR perfect dog breed → https://pawbuddy.in\`;
  
  if (navigator.share) {
    try {
      // Create canvas image
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      
      const grd = ctx.createLinearGradient(0,0,1080,1080);
      grd.addColorStop(0,'#FF6B2B'); grd.addColorStop(1,'#FFB347');
      ctx.fillStyle = grd; ctx.fillRect(0,0,1080,1080);
      
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRect(ctx, 80, 80, 920, 920, 40);
      
      ctx.fillStyle = '#FF6B2B';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAW BUDDY', 540, 170);
      
      ctx.fillStyle = '#3D1F00';
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('My Perfect Dog Match!', 540, 260);
      
      ctx.fillStyle = '#FF6B2B';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText(top.name, 540, 480);
      
      ctx.fillStyle = '#7A4010';
      ctx.font = '28px sans-serif';
      const reason = top.reason.split('·')[0].trim();
      ctx.fillText(reason, 540, 560);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'paw-buddy-match.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Perfect Dog Match',
          text: txt,
          files: [file]
        });
      } else {
        await navigator.share({
          title: 'My Perfect Dog Match',
          text: txt,
          url: 'https://pawbuddy.in'
        });
      }
    } catch(e) {
      console.error(e);
    }
  }
}
`;

const oldNativeShareRegex = /function shareNative\(\) \{[\s\S]*?\}\n\}\n/g;
content = content.replace(oldNativeShareRegex, nativeShareScript);

// Remove the initial check for window.location.hash
content = content.replace(/if\(window\.location\.hash === '#admin'\) showAdmin\(\);/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Update successful');
