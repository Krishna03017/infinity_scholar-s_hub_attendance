"""Remove avatar and email fields from all student entries in mockData.ts"""
import re

filepath = r"c:\Users\LENOVO\Desktop\infinity-scholar's-hub\src\data\mockData.ts"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Remove email lines from student objects
content = re.sub(r'\n\s*email: "[^"]*",', '', content)

# Remove avatar lines from student objects  
content = re.sub(r'\n\s*avatar: "[^"]*",', '', content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

# Verify
remaining_email = len(re.findall(r'email:', content))
remaining_avatar = len(re.findall(r'avatar:', content))
print(f"Remaining email references: {remaining_email}")
print(f"Remaining avatar references: {remaining_avatar}")
print("Done! Removed email and avatar from all student entries.")
