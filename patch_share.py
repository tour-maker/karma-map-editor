import re

with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

target = r"title: `Karma Realtors - \$\{title\}`,"
repl = r"title: `Karma Realtors - Selected Plot Details`,"

code = re.sub(target, repl, code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)

