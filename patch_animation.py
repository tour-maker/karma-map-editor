import re

# 1. Update PropertyInfoPanel.jsx
with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

# Remove keyframes injection
target_keyframes = r"""    // Inject Keyframes for Panel Slide-In Animation
    if \(typeof document !== 'undefined' && !document\.getElementById\('panel-slide-keyframes'\)\) \{
      const styleEl = document\.createElement\('style'\);
      styleEl\.id = 'panel-slide-keyframes';
      styleEl\.innerHTML = `
    @keyframes panelSlideInRight \{
      0% \{
        transform: translateX\(85%\);
        opacity: 0;
      \}
      100% \{
        transform: translateX\(0\);
        opacity: 1;
      \}
    \}
  `;
      document\.head\.appendChild\(styleEl\);
    \}"""

code = re.sub(target_keyframes, "", code)

# Update className
code = code.replace('className="responsive-info-panel"', 'className={`responsive-info-panel ${isOpen ? \'is-open\' : \'\'}`}')

# Remove inline transform, opacity, pointerEvents, animation
code = re.sub(r"transform:\s*isOpen\s*\?\s*'[^']*'\s*:\s*'[^']*',", "", code)
code = re.sub(r"opacity:\s*isOpen\s*\?\s*1\s*:\s*0,", "", code)
code = re.sub(r"pointerEvents:\s*isOpen\s*\?\s*'auto'\s*:\s*'none',", "", code)
code = re.sub(r"animation:\s*isOpen\s*\?\s*'[^']*'\s*:\s*'none'", "", code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)


# 2. Update index.css
with open('src/index.css', 'r') as f:
    css = f.read()

# Add transition to base responsive-info-panel
target_base = r"""\.responsive-info-panel \{
  position: absolute;
  top: 76px;
  right: 24px;
  width: 360px;
  z-index: 2000;
\}"""

repl_base = """.responsive-info-panel {
  position: absolute;
  top: 76px;
  right: 24px;
  width: 360px;
  z-index: 2000;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
  transform: translateX(120%) !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
.responsive-info-panel.is-open {
  transform: translateX(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}"""

css = re.sub(target_base, repl_base, css)

# Update mobile portrait responsive-info-panel
target_portrait = r"""  \.responsive-info-panel \{
    position: fixed !important;
    width: calc\(100vw - 24px\) !important;
    right: 12px !important;
    left: 12px !important;
    bottom: 12px !important;
    top: auto !important;
    max-height: 75vh !important;
    border-radius: 24px !important;
    z-index: 2000 !important;
  \}"""

repl_portrait = """  .responsive-info-panel {
    position: fixed !important;
    width: calc(100vw - 24px) !important;
    right: 12px !important;
    left: 12px !important;
    bottom: 12px !important;
    top: auto !important;
    max-height: 75vh !important;
    border-radius: 24px !important;
    z-index: 2000 !important;
    transform: translateY(120%) !important;
  }
  .responsive-info-panel.is-open {
    transform: translateY(0) !important;
  }"""

css = re.sub(target_portrait, repl_portrait, css)

# Update landscape responsive-info-panel
target_landscape = r"""  /\* Property Info Panel in Landscape \*/
  \.responsive-info-panel \{
    transform: scale\(0\.65\) !important;
    transform-origin: center right !important;
    right: 76px !important;
    max-height: 140vh !important; 
  \}"""

repl_landscape = """  /* Property Info Panel in Landscape */
  .responsive-info-panel {
    transform-origin: center right !important;
    right: 76px !important;
    max-height: 140vh !important; 
    transform: scale(0.65) translateX(150%) !important;
  }
  .responsive-info-panel.is-open {
    transform: scale(0.65) translateX(0) !important;
  }"""

css = re.sub(target_landscape, repl_landscape, css)

with open('src/index.css', 'w') as f:
    f.write(css)

