with open('src/index.css', 'r') as f:
    css = f.read()

target = r"""  /* 3. Opts Button Top Right */
  .responsive-right-dock {
    position: fixed !important;
    top: 16px !important;
    right: 16px !important;"""

repl = """  /* 3. Opts Button Top Right */
  .responsive-right-dock {
    position: fixed !important;
    top: 20px !important;
    right: 16px !important;"""

css = css.replace(target, repl)

with open('src/index.css', 'w') as f:
    f.write(css)
