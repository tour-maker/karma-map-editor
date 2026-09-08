import re

with open('src/index.css', 'r') as f:
    css = f.read()

target = r"""  /\* Property Info Panel in Landscape \*/
  \.responsive-info-panel \{
    transform-origin: center right !important;
    right: 76px !important;
    max-height: 140vh !important; 
    transform: scale\(0\.65\) translateX\(150%\) !important;
  \}
  \.responsive-info-panel\.is-open \{
    transform: scale\(0\.65\) translateX\(0\) !important;
  \}"""

repl = """  /* Property Info Panel in Landscape */
  .responsive-info-panel {
    top: 50% !important;
    transform-origin: center right !important;
    right: 76px !important;
    max-height: 140vh !important;
    overflow-y: auto !important;
    transform: scale(0.65) translate(150%, -50%) !important;
  }
  .responsive-info-panel.is-open {
    transform: scale(0.65) translate(0, -50%) !important;
  }"""

new_css = re.sub(target, repl, css)

with open('src/index.css', 'w') as f:
    f.write(new_css)
