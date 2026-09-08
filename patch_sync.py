import re

# 1. Update App.jsx
with open('src/App.jsx', 'r') as f:
    app_code = f.read()

# Add import
app_code = app_code.replace("import { useMapStore } from './store/useMapStore'", 
                            "import { useMapStore } from './store/useMapStore'\nimport GoogleSheetsConnect from './components/GoogleSheetsConnect'")

# Add component to render
target_render = r"""    <GoogleMapProvider>
      <Toaster position="top-center" />
      <MapEditor />
    </GoogleMapProvider>"""

repl_render = """    <GoogleMapProvider>
      <Toaster position="top-center" />
      <GoogleSheetsConnect />
      <MapEditor />
    </GoogleMapProvider>"""

app_code = re.sub(target_render, repl_render, app_code)

with open('src/App.jsx', 'w') as f:
    f.write(app_code)


# 2. Update ProjectsPanel.jsx
with open('src/components/ProjectsPanel.jsx', 'r') as f:
    pp_code = f.read()

# Remove component render
target_pp_render = r"""        \{/\* Google Sheets Sync Row \*/\}
        <div style=\{\{ marginTop: 2, marginBottom: 8 \}\}>
          <GoogleSheetsConnect />
        </div>"""

pp_code = re.sub(target_pp_render, "", pp_code)
# also replace duplicated comments if they exist
pp_code = re.sub(r"\{/\* Google Sheets Sync Row \*/\}\n?", "", pp_code)
pp_code = re.sub(r"<div style=\{\{ marginTop: 2, marginBottom: 8 \}\}>\s*<GoogleSheetsConnect />\s*</div>", "", pp_code)

with open('src/components/ProjectsPanel.jsx', 'w') as f:
    f.write(pp_code)

