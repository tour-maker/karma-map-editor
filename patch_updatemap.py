import re

with open('src/components/GoogleSheetsConnect.jsx', 'r') as f:
    code = f.read()

target = r"""  // ─── Update Map \(Sheet → Map\) ────────────────────────────────────────────────
  const updateMap = async \(silent = false\) => \{
    if \(!silent\) setIsUpdatingMap\(true\);
    try \{
      if \(spreadsheetId\) \{
        await repairSheet1Headers\(spreadsheetId\);
      \}
      const updatedCount = await fetchAndMergeSheetUpdates\(spreadsheetId\);
      if \(updatedCount > 0\) \{
        toast\.success\(`Map updated! \$\{updatedCount\} change\(s\) pulled from Google Sheets\.`\);
      \} else if \(!silent\) \{
        toast\.success\('Map is already up to date with Google Sheets!'\);
      \}
    \} catch \(err\) \{
      console\.error\(err\);
      if \(!silent\) \{
        toast\.error\('Failed to fetch updates from Google Sheets: ' \+ err\.message\);
      \}
    \}
    if \(!silent\) setIsUpdatingMap\(false\);
  \};"""

repl = """  // ─── Update Map (Sheet → Map) ────────────────────────────────────────────────
  const updateMap = async (silent = false) => {
    if (!silent) setIsUpdatingMap(true);
    let toastId = null;
    
    if (!silent) {
      toastId = toast.loading('Loading polygons...', { id: 'loading-polygons' });
    }

    try {
      if (spreadsheetId) {
        await repairSheet1Headers(spreadsheetId);
      }
      await fetchAndMergeSheetUpdates(spreadsheetId);
      
      if (toastId) {
        toast.dismiss(toastId);
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error('Failed to connect: ' + err.message, { id: toastId || 'error-polygons' });
      }
    }
    if (!silent) setIsUpdatingMap(false);
  };"""

code = re.sub(target, repl, code)

with open('src/components/GoogleSheetsConnect.jsx', 'w') as f:
    f.write(code)

