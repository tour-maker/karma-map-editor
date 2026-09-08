import re

# 1. Update index.css
with open('src/index.css', 'r') as f:
    css = f.read()

target_wa = r"""  \.mobile-share-floating-btn \{
    display: flex !important;
    position: fixed !important;
    bottom: 136px !important;
    right: 20px !important;
    width: 44px !important;
    height: 44px !important;
    border-radius: 50% !important;
    background: rgba\(10, 14, 23, 0\.70\) !important;
    backdrop-filter: blur\(16px\) !important;
    -webkit-backdrop-filter: blur\(16px\) !important;
    border: 1px solid rgba\(255, 255, 255, 0\.22\) !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 10px 40px rgba\(0, 0, 0, 0\.65\) !important;
    z-index: 1050 !important;
    cursor: pointer !important;
  \}"""

repl_wa = """  .mobile-share-floating-btn {
    display: flex !important;
    position: fixed !important;
    bottom: 136px !important;
    right: 20px !important;
    width: 44px !important;
    height: 44px !important;
    border-radius: 50% !important;
    background: transparent !important;
    border: none !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: none !important;
    z-index: 1050 !important;
    cursor: pointer !important;
  }"""

css = re.sub(target_wa, repl_wa, css)
with open('src/index.css', 'w') as f:
    f.write(css)

# 2. Update RightActionDock.jsx
with open('src/components/ui/RightActionDock.jsx', 'r') as f:
    jsx = f.read()

# Add BiShare import
if 'BiShare' not in jsx:
    jsx = "import { BiShare } from 'react-icons/bi';\n" + jsx

# Replace FiShare2 with BiShare for the mobile-share-floating-btn ONLY
target_btn = r"""<FiShare2 size=\{20\} />"""
repl_btn = """<BiShare size={24} />"""

# Be careful, FiShare2 is also used inside the main dock
# So we only replace it where it's inside mobile-share-floating-btn
# Let's just do a string replace for the specific block
target_block = """      <button
        type="button"
        className="mobile-share-floating-btn btn-hover-effect"
        onClick={handleShare}
        title="Share map view"
      >
        <FiShare2 size={20} />
      </button>"""

repl_block = """      <button
        type="button"
        className="mobile-share-floating-btn btn-hover-effect"
        onClick={handleShare}
        title="Share map view"
      >
        <BiShare size={26} />
      </button>"""

jsx = jsx.replace(target_block, repl_block)

with open('src/components/ui/RightActionDock.jsx', 'w') as f:
    f.write(jsx)
