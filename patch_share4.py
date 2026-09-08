with open('src/components/ui/RightActionDock.jsx', 'r') as f:
    jsx = f.read()

# Replace FiExternalLink import with RiShareBoxLine
jsx = jsx.replace("import { FiExternalLink } from 'react-icons/fi';\n", "import { RiShareBoxLine } from 'react-icons/ri';\n")
if "import { RiShareBoxLine } from 'react-icons/ri';" not in jsx:
    jsx = "import { RiShareBoxLine } from 'react-icons/ri';\n" + jsx
    
# Remove FiExternalLink if it was injected into the Fi import block
jsx = jsx.replace(", FiExternalLink }", " }")

# Replace the component
jsx = jsx.replace('<FiExternalLink size={26} />', '<RiShareBoxLine size={26} />')

with open('src/components/ui/RightActionDock.jsx', 'w') as f:
    f.write(jsx)
