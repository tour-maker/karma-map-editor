import re

old_url = "'https://script.google.com/macros/s/AKfycby6PYhg46pRnBkkcAfp-RkmreiGHIkwYLcNXI03eujyc1bSSTH0kZZ93auAm7XtcjI/exec'"

# Patch googleSheets.js
with open('src/services/googleSheets.js', 'r') as f:
    code = f.read()
code = re.sub(r"const APPS_SCRIPT_URL = .*", f"const APPS_SCRIPT_URL = {old_url};", code)
with open('src/services/googleSheets.js', 'w') as f:
    f.write(code)

# Patch GoogleSheetsConnect.jsx
with open('src/components/GoogleSheetsConnect.jsx', 'r') as f:
    code = f.read()
code = re.sub(r"const DEFAULT_SCRIPT_URL = .*", f"const DEFAULT_SCRIPT_URL = {old_url};", code)
with open('src/components/GoogleSheetsConnect.jsx', 'w') as f:
    f.write(code)
