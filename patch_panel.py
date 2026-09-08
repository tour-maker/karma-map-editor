import re

with open('src/index.css', 'r') as f:
    css = f.read()

target = r"""  \.whatsapp-cta-button \{
    display: flex !important;
  \}
\}"""

repl = """  .whatsapp-cta-button {
    display: flex !important;
  }

  /* Property Info Panel in Landscape */
  .responsive-info-panel {
    transform: scale(0.65) !important;
    transform-origin: center right !important;
    right: 76px !important;
    max-height: 140vh !important; 
  }
}"""

css = re.sub(target, repl, css)

with open('src/index.css', 'w') as f:
    f.write(css)

