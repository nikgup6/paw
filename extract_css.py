import re

def extract_css():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    if match:
        css = match.group(1)
        with open('frontend/src/styles/index.css', 'w', encoding='utf-8') as out:
            out.write(css)
        print("CSS extracted successfully!")
    else:
        print("No style tag found.")

if __name__ == "__main__":
    extract_css()
