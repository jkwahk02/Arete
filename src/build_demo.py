"""Build the Arete demo (demo.html) from the built app (index.html).

The demo is the real app with one change: src/demo/demo.js replaces the Supabase
data layer with a generated sample university held in memory, signed in as the
DS&AI chair. Every page then shows what Arete looks like with full data.
A small label says it is a demo with sample data; nothing is saved.

usage: python -I src/build_demo.py      (after src/build_app.py)
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
app = (ROOT / 'index.html').read_text(encoding='utf-8')
demo = (ROOT / 'src' / 'demo' / 'demo.js').read_text(encoding='utf-8')

hook = '<script>\nARETE.db = window.ARETE_DB;'
assert app.count(hook) == 1, 'data layer hook not found'
app = app.replace(hook, '<script>\n' + demo + '\n</script>\n' + hook, 1)

label = ('<div role="note" style="position:fixed;left:16px;bottom:16px;z-index:50;padding:8px 14px;border-radius:18px;'
         'background:#2E1648;color:#FFFFFF;font:500 12px Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18)">'
         'Demo · sample data, as at the end of Fall 2026 · nothing is saved</div>\n</body>')
assert app.count('</body>') == 1
app = app.replace('</body>', label, 1)
app = app.replace('<title>Arete Pro</title>', '<title>Arete Pro Demo</title>', 1)

(ROOT / 'demo.html').write_text(app, encoding='utf-8', newline='\n')
print('demo.html', len(app.encode('utf-8')), 'bytes')
