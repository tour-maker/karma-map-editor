import re

# 1. Update MapEditor.jsx
with open('src/components/MapEditor.jsx', 'r') as f:
    jsx = f.read()

target_options = r"""          options=\{\{
            backgroundColor: '#000000',
            disableDefaultUI: true, // we use custom zoom control now"""

repl_options = """          options={{
            gestureHandling: 'greedy',
            backgroundColor: '#000000',
            disableDefaultUI: true, // we use custom zoom control now"""

jsx = re.sub(target_options, repl_options, jsx)

with open('src/components/MapEditor.jsx', 'w') as f:
    f.write(jsx)

# 2. Update index.css
with open('src/index.css', 'r') as f:
    css = f.read()

target_bottom = r"""bottom: 136px !important;"""
repl_bottom = """bottom: 130px !important;"""

css = re.sub(target_bottom, repl_bottom, css)

with open('src/index.css', 'w') as f:
    f.write(css)

