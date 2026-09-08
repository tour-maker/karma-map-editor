import re

with open('src/services/googleSheets.js', 'r') as f:
    code = f.read()

# Add to cleanRow
target_cleanRow = r"""    const remarksVal = d\.remarks \|\| feature\.remarks \|\| '';

    const cleanRow = \[
      feature\.id \|\| '',
      tpVal,
      opVal,
      fpVal,
      areaVal,
      loc,
      parentLoc,
      landmarkVal,
      typeVal,
      remarksVal,"""
repl_cleanRow = """    const remarksVal = d.remarks || feature.remarks || '';
    const partyNameVal = d.partyName || feature.partyName || '';
    const partyPhoneVal = d.partyPhone || feature.partyPhone || '';
    const brokerNameVal = d.brokerName || feature.brokerName || '';
    const brokerPhoneVal = d.brokerPhone || feature.brokerPhone || '';

    const cleanRow = [
      feature.id || '',
      tpVal,
      opVal,
      fpVal,
      areaVal,
      loc,
      parentLoc,
      landmarkVal,
      typeVal,
      remarksVal,
      partyNameVal,
      partyPhoneVal,
      brokerNameVal,
      brokerPhoneVal,"""
code = re.sub(target_cleanRow, repl_cleanRow, code)

# Update A:J to A:N in appendSheetRow and updateSheetRow for Polygons
code = re.sub(r"'Polygons!A:J'", "'Polygons!A:N'", code)
code = re.sub(r"`Polygons!A\$\{targetRowIndex\}:J\$\{targetRowIndex\}`", r"`Polygons!A${targetRowIndex}:N${targetRowIndex}`", code)

with open('src/services/googleSheets.js', 'w') as f:
    f.write(code)

