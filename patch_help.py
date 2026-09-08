import re

with open('src/components/ui/HelpInstructionOverlay.jsx', 'r') as f:
    code = f.read()

# Add isMobileLandscape state
target_state = r"const \[isMobile, setIsMobile\] = useState\(window.innerWidth <= 768\);"
repl_state = """const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isMobileLandscape, setIsMobileLandscape] = useState(
    window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches
  );"""
code = re.sub(target_state, repl_state, code)

# Update handleResize
target_resize = r"""    const handleResize = \(\) => \{
      setIsMobile\(window\.innerWidth <= 768\);
    \};"""
repl_resize = """    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsMobileLandscape(window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches);
    };"""
code = re.sub(target_resize, repl_resize, code)

# Update return JSX
target_jsx = r"\{isMobile \? \("
repl_jsx = """{isMobileLandscape ? (
        <>
          {/* LEFT SIDEBAR: TABS */}
          <div style={{
            position: 'absolute', top: 120, left: 235,
            display: 'flex', alignItems: 'flex-start', gap: 6
          }}>
            <div style={{ fontSize: 20, color: '#ffffff' }}>←</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Sidebar Tabs</span>
              <span style={{ fontSize: 10, color: '#cbd5e1', maxWidth: 130, lineHeight: 1.35 }}>
                Browse <b style={{ color: '#f59e0b' }}>Projects</b>, <b style={{ color: '#f59e0b' }}>Landmarks</b>, and <b style={{ color: '#f59e0b' }}>Areas</b>
              </span>
            </div>
          </div>

          {/* LEFT SIDEBAR: Add Area / Project */}
          <div style={{
            position: 'absolute', top: 58, left: 215,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: '#cbd5e1', maxWidth: 140, lineHeight: 1.35 }}>
                ↙ Add new project
              </span>
            </div>
          </div>

          {/* RIGHT DOCK: SHARE & SETTINGS */}
          <div style={{
            position: 'absolute', top: '35%', right: 48,
            textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Tools</span>
            <span style={{ fontSize: 10, color: '#cbd5e1', maxWidth: 120, lineHeight: 1.35, textAlign: 'right' }}>
              Share & Settings
            </span>
            <div style={{ fontSize: 18, color: '#ffffff' }}>→</div>
          </div>

          {/* BOTTOM RIGHT: WHATSAPP CTA */}
          <div style={{
            position: 'absolute', bottom: 58, right: 48,
            textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Contact</span>
            </div>
            <div style={{ fontSize: 18, color: '#ffffff' }}>↘</div>
          </div>

          {/* BOTTOM FILTER BAR: FILTERS */}
          <div style={{
            position: 'absolute', bottom: 50, left: '46%',
            transform: 'translateX(-50%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Filters</span>
            <span style={{ fontSize: 10, color: '#cbd5e1', maxWidth: 200, lineHeight: 1.35, margin: '2px 0 4px 0' }}>
              Filter by Location & Category
            </span>
            <div style={{ fontSize: 16, color: '#ffffff', marginBottom: 2 }}>↓</div>
          </div>
        </>
      ) : isMobile ? ("""
code = re.sub(target_jsx, repl_jsx, code)

with open('src/components/ui/HelpInstructionOverlay.jsx', 'w') as f:
    f.write(code)

