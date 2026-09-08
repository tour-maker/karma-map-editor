with open('src/index.css', 'r') as f:
    css = f.read()
css = '.mobile-share-floating-btn { display: none; }\n' + css
with open('src/index.css', 'w') as f:
    f.write(css)
