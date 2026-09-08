with open('src/index.css', 'r') as f:
    css = f.read()

target = r"""  .whatsapp-cta-wrapper .desktop-only-text {
    display: none !important;
  }"""

css = css.replace(target, "")

with open('src/index.css', 'w') as f:
    f.write(css)
