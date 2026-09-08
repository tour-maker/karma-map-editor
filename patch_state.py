import re

with open('src/components/ui/HelpInstructionOverlay.jsx', 'r') as f:
    code = f.read()

target_state = r"const \[isMobile, setIsMobile\] = React\.useState\(typeof window !== 'undefined' && window\.innerWidth <= 768\);"
repl_state = """const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isMobileLandscape, setIsMobileLandscape] = React.useState(
    typeof window !== 'undefined' && window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches
  );"""
code = re.sub(target_state, repl_state, code)

target_resize = r"const handleResize = \(\) => setIsMobile\(window\.innerWidth <= 768\);"
repl_resize = """const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsMobileLandscape(window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches);
    };"""
code = re.sub(target_resize, repl_resize, code)

with open('src/components/ui/HelpInstructionOverlay.jsx', 'w') as f:
    f.write(code)

