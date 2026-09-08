import re

with open('src/index.css', 'r') as f:
    css = f.read()

# 1. Remove .whatsapp-cta-wrapper from hidden list
target_hidden = r"""  /\* 1. HIDE MOBILE ELEMENTS \*/
  \.mobile-filter-dock-bar,
  \.mobile-projects-dock-bar,
  \.whatsapp-cta-wrapper \{
    display: none !important;
  \}"""

repl_hidden = """  /* 1. HIDE MOBILE ELEMENTS */
  .mobile-filter-dock-bar,
  .mobile-projects-dock-bar {
    display: none !important;
  }"""

css = re.sub(target_hidden, repl_hidden, css)

# 2. Modify .responsive-filter-bar in landscape
target_filter = r"""  /\* Bottom Filter Bar \(Right Column Bottom\) \*/
  \.responsive-filter-bar \{
    transform: scale\(0\.68\) !important;
    transform-origin: bottom right !important;
    left: auto !important; 
    right: 12px !important;
    bottom: 12px !important;
  \}"""

repl_filter = """  /* Bottom Filter Bar (Right Column Bottom) */
  .responsive-filter-bar {
    transform: scale(0.68) !important;
    transform-origin: bottom right !important;
    left: auto !important; 
    right: 12px !important;
    bottom: 0px !important;
    border-radius: 20px 20px 0 0 !important;
  }"""

css = re.sub(target_filter, repl_filter, css)

# 3. Modify whatsapp-cta in landscape
target_wa = r"""  /\* WhatsApp button \*/
  \.whatsapp-cta-button \{
    display: flex !important;
    transform: scale\(0\.68\) !important;
    transform-origin: bottom right !important;
    bottom: 12px !important;
    right: 12px !important;
  \}"""

repl_wa = """  /* WhatsApp button */
  .whatsapp-cta-wrapper {
    display: flex !important;
    transform: scale(0.68) !important;
    transform-origin: bottom right !important;
    bottom: 50px !important;
    right: 12px !important;
  }
  .whatsapp-cta-button {
    display: flex !important;
  }"""

css = re.sub(target_wa, repl_wa, css)

with open('src/index.css', 'w') as f:
    f.write(css)

