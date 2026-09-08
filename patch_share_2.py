import re

with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

target = r"""      const landmarkStr = d\.landmark \|\| '';
      const remarkStr = d\.remarks \|\| d\.remark \|\| '';

      const shareTextParts = \[\];
      if \(tpFpOpStr\) shareTextParts\.push\(`📐 \$\{tpFpOpStr\}`\);
      if \(areaStr\) shareTextParts\.push\(`📏 Area: \$\{areaStr\}`\);
      if \(landmarkStr\) shareTextParts\.push\(`📍 Landmark: \$\{landmarkStr\}`\);
      if \(remarkStr\) shareTextParts\.push\(`📝 Remark: \$\{remarkStr\}`\);

      const shareText = \(shareTextParts\.length > 0 \? shareTextParts\.join\('\\n'\) \+ '\\n\\n' : ''\) \+ `🔗 View on Map:\\n\$\{shareUrl\.toString\(\)\}`;"""

repl = """      const categoryStr = d.type ? d.type.toUpperCase() : 'LAND';
      const landmarkStr = d.landmark || '';
      const remarkStr = d.remarks || d.remark || '';

      const shareTextParts = [];
      if (tpFpOpStr) shareTextParts.push(`📐 *TP/FP/OP*: ${tpFpOpStr}`);
      if (areaStr) shareTextParts.push(`📏 *Area*: ${areaStr}`);
      if (categoryStr) shareTextParts.push(`🏷️ *Category*: ${categoryStr}`);
      if (landmarkStr) shareTextParts.push(`📍 *Landmark*: ${landmarkStr}`);
      if (remarkStr) shareTextParts.push(`📝 *Remark*: ${remarkStr}`);

      const body = shareTextParts.length > 0 ? '\\n' + shareTextParts.join('\\n') + '\\n\\n\\n' : '\\n\\n';
      const shareText = `📍 *Karma Realtors - Selected Plot Details*\\n${body}🔗 *View on Interactive Map*:\\n${shareUrl.toString()}`;"""

code = re.sub(target, repl, code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)

