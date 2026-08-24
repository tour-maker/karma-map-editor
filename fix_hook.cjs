const fs = require('fs');
const file = 'src/components/GoogleSheetsConnect.jsx';
let content = fs.readFileSync(file, 'utf8');

// Undo the nested useEffect
const badHook = `    useEffect(() => {
    const handleGlobalSync = () => {
      if (googleSheetsConnected || spreadsheetId) {
        syncData();
      }
    };
    window.addEventListener('trigger-global-sync', handleGlobalSync);
    return () => window.removeEventListener('trigger-global-sync', handleGlobalSync);
  }); // Run on every render so it captures the latest syncData closure

  return (`;

content = content.replace(badHook, 'return (');

// Now inject it right before the component's actual return (
// To find the component's actual return (, it's usually at the end of the file.
// Let's find the last occurrence of 'return ('
const lastReturnIndex = content.lastIndexOf('return (');
if (lastReturnIndex !== -1) {
  const goodHook = `  useEffect(() => {
    const handleGlobalSync = () => {
      if (googleSheetsConnected || spreadsheetId) {
        syncData();
      }
    };
    window.addEventListener('trigger-global-sync', handleGlobalSync);
    return () => window.removeEventListener('trigger-global-sync', handleGlobalSync);
  });

  `;
  content = content.slice(0, lastReturnIndex) + goodHook + content.slice(lastReturnIndex);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed hook location');
