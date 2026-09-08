with open('src/components/ui/RightActionDock.jsx', 'r') as f:
    jsx = f.read()

# Replace BiShare import with FiExternalLink (if it's not already in the main react-icons/fi import)
jsx = jsx.replace("import { BiShare } from 'react-icons/bi';\n", "")

# Ensure FiExternalLink is imported
if 'FiExternalLink' not in jsx:
    # Find the react-icons/fi import and add it
    import_fi = "import { FiShare2, FiSliders, FiX, FiMap, FiLayers "
    if import_fi in jsx:
        jsx = jsx.replace(import_fi, "import { FiShare2, FiSliders, FiX, FiMap, FiLayers, FiExternalLink ")
    else:
        # Just fallback to a new import
        jsx = "import { FiExternalLink } from 'react-icons/fi';\n" + jsx

jsx = jsx.replace('<BiShare size={26} />', '<FiExternalLink size={26} />')

with open('src/components/ui/RightActionDock.jsx', 'w') as f:
    f.write(jsx)
