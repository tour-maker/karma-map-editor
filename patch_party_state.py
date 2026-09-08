import re

with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

# Let's find where useState is called at the top of PropertyInfoPanel
target = r"export default function PropertyInfoPanel\(\{([^}]+)\}\) \{"
repl = r"export default function PropertyInfoPanel({\1}) {\n  const [showPartyDetails, setShowPartyDetails] = useState(false);"

code = re.sub(target, repl, code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)

