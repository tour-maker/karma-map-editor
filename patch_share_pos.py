import re

with open('src/index.css', 'r') as f:
    css = f.read()

target = r"""  \.mobile-share-floating-btn \{
    display: flex !important;
    position: fixed !important;
    bottom: 130px !important;"""

repl = """  .mobile-share-floating-btn {
    display: flex !important;
    position: fixed !important;
    bottom: 152px !important;"""

css = re.sub(target, repl, css)

with open('src/index.css', 'w') as f:
    f.write(css)

