import re

with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

target = r"""      if \(navigator\.share\) \{
        navigator\.share\(\{
          title: `Karma Realtors - Selected Plot Details`,
          text: shareText,
          url: shareUrl\.toString\(\)
        \}\)\.then"""

repl = """      if (navigator.share) {
        navigator.share({
          title: `Karma Realtors - Selected Plot Details`,
          text: shareText
        }).then"""

code = re.sub(target, repl, code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)

