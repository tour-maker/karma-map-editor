import re

with open('src/store/useMapStore.js', 'r') as f:
    code = f.read()

code = code.replace(
    "appMode: 'viewer',",
    "appMode: 'viewer',\n        isAdminAuthenticated: false,"
)

code = code.replace(
    "setAppMode: (mode) => set({ appMode: mode }),",
    "setAppMode: (mode) => set({ appMode: mode }),\n        setIsAdminAuthenticated: (auth) => set({ isAdminAuthenticated: auth }),"
)

with open('src/store/useMapStore.js', 'w') as f:
    f.write(code)

