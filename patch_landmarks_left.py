import re

with open('src/components/ui/HelpInstructionOverlay.jsx', 'r') as f:
    code = f.read()

target = r"position: 'absolute', bottom: 7, left: 'calc\(50% - 270px\)',"
repl = r"position: 'absolute', bottom: 7, left: 'calc(50% - 415px)',"

code = re.sub(target, repl, code)

with open('src/components/ui/HelpInstructionOverlay.jsx', 'w') as f:
    f.write(code)

