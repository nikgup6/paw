const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  console.log('Navigating to http://localhost:5174/quiz');
  await page.goto('http://localhost:5174/quiz');
  
  try {
    console.log('Waiting for Next button...');
    await page.waitForSelector('.btn-next', { timeout: 5000 });
    
    // Attempt to click through 10 questions
    for (let i = 0; i < 10; i++) {
      console.log('Answering Q' + (i+1));
      await page.click('.option-btn'); // click the first option
      await page.click('.btn-next');
      await page.waitForTimeout(500);
    }
    
    console.log('Waiting for Results...');
    await page.waitForSelector('.top-match', { timeout: 5000 });
    console.log('SUCCESS! Results loaded.');
  } catch (e) {
    console.error('TEST FAILED:', e.message);
  }
  
  await browser.close();
})();
