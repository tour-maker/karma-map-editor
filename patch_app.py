import re

with open('src/App.jsx', 'r') as f:
    code = f.read()

# Add import
code = code.replace(
    "import GoogleSheetsConnect from './components/GoogleSheetsConnect'",
    "import GoogleSheetsConnect from './components/GoogleSheetsConnect'\nimport AdminAuthOverlay from './components/ui/AdminAuthOverlay'"
)

# Add logic
target_return = r"""  return \(
    <GoogleMapProvider>"""
repl_return = """  const appMode = useMapStore(state => state.appMode);
  const isAdminAuthenticated = useMapStore(state => state.isAdminAuthenticated);

  return (
    <GoogleMapProvider>
      {appMode === 'edit' && !isAdminAuthenticated && <AdminAuthOverlay />}"""

code = re.sub(target_return, repl_return, code)

with open('src/App.jsx', 'w') as f:
    f.write(code)

