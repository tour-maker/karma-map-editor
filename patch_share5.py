with open('src/components/ui/RightActionDock.jsx', 'r') as f:
    jsx = f.read()

# Replace RiShareBoxLine import with FaRegShareSquare
jsx = jsx.replace("import { RiShareBoxLine } from 'react-icons/ri';\n", "import { FaRegShareSquare } from 'react-icons/fa';\n")
if "import { FaRegShareSquare } from 'react-icons/fa';" not in jsx:
    jsx = "import { FaRegShareSquare } from 'react-icons/fa';\n" + jsx
    
# Replace the component
jsx = jsx.replace('<RiShareBoxLine size={26} />', '<FaRegShareSquare size={22} />')

with open('src/components/ui/RightActionDock.jsx', 'w') as f:
    f.write(jsx)
