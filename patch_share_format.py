import re

with open('src/components/PropertyInfoPanel.jsx', 'r') as f:
    code = f.read()

target = r"""      const tp = d\.tpNo \|\| d\.tp \|\| '';
      const fp = d\.fpNo \|\| d\.fp \|\| '';
      const op = d\.opNo \|\| d\.op \|\| '';
      const tpFpOpStr = \[
        tp \? `TP: \$\{tp\}` : '',
        fp \? `FP: \$\{fp\}` : '',
        op \? `OP: \$\{op\}` : ''
      \]\.filter\(Boolean\)\.join\(' \| '\);

      const categoryStr = d\.type \? d\.type\.toUpperCase\(\) : 'LAND';
      const landmarkStr = d\.landmark \|\| '';
      const remarkStr = d\.remarks \|\| d\.remark \|\| '';

      const shareTextParts = \[\];
      if \(tpFpOpStr\) shareTextParts\.push\(`📐 \*TP/FP/OP\*: \$\{tpFpOpStr\}`\);"""

repl = """      const tp = d.tpNo || d.tp || '-';
      const fp = d.fpNo || d.fp || '-';
      const op = d.opNo || d.op || '-';

      const categoryStr = d.type ? d.type.toUpperCase() : 'LAND';
      const landmarkStr = d.landmark || '';
      const remarkStr = d.remarks || d.remark || '';

      const shareTextParts = [];
      shareTextParts.push(`📐 TP: ${tp} | FP: ${fp} | OP: ${op}`);"""

code = re.sub(target, repl, code)

with open('src/components/PropertyInfoPanel.jsx', 'w') as f:
    f.write(code)

