import re
import json

def extract_js_array(html_content, var_name):
    # Regex to find const/let/var var_name = [ ... ];
    pattern = rf"(?:const|let|var)\s+{var_name}\s*=\s*(\[.*?\]);"
    match = re.search(pattern, html_content, re.DOTALL)
    if match:
        array_str = match.group(1)
        # Because the JS array might not be strictly valid JSON (e.g. single quotes, missing quotes around keys, trailing commas), 
        # doing this purely with regex/json is hard. Let's try an alternative using PyMiniRacer or simply write the JS array 
        # out to a node script that logs it as JSON.
        pass
    return None

def extract_with_node():
    # Write a Node.js script that reads index.html, extracts the <script> tags, evaluates the relevant parts, and writes JSON.
    node_script = """
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Find the script tag containing 'const breeds'
const scriptRegex = /<script>([\\s\\S]*?const breeds[\\s\\S]*?)<\\/script>/;
const match = html.match(scriptRegex);

if (match) {
    const code = match[1];
    
    // We only want to execute up to where breeds and questions are defined
    // Let's create a sandbox-like execution by replacing window variables
    
    let breeds = [];
    let questions = [];
    
    // Instead of full execution, let's extract via regex for the JSON-like structures
    // Or just write the code to a file and append `console.log(JSON.stringify({breeds, questions}));`
    
    const lines = code.split('\\n');
    let outCode = '';
    for (let line of lines) {
        if (line.includes('document.getElementById') || line.includes('function ')) {
            // skip DOM manipulations
        } else {
            outCode += line + '\\n';
        }
    }
    
    // Safer: Just extract the string blocks if possible
}
"""

if __name__ == "__main__":
    extract_with_node()
