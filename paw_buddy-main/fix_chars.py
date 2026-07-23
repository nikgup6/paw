import json

with open('frontend/src/constants/breeds.json', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('â€“', '-').replace('â‚¹', '₹')

with open('frontend/src/constants/breeds.json', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done fixing special characters.")
