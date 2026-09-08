import re

with open('src/components/ui/WhatsAppCTA.jsx', 'r') as f:
    code = f.read()

target = r"""const WhatsAppIcon = \(\{ color = "#f59e0b", size = 28 \}\) => \(
  <svg width=\{size\} height=\{size\} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17\.472"""

repl = """const WhatsAppIcon = ({ color = "#f59e0b", size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.39A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
      fill="rgba(20, 24, 33, 0.95)"
    />
    <path
      d="M17.472"""

code = re.sub(target, repl, code)

with open('src/components/ui/WhatsAppCTA.jsx', 'w') as f:
    f.write(code)

