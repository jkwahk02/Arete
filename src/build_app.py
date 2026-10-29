"""Build the static Arete Pro app (index.html) from the mockup artboards.

Each artboard (project/<Name>.dc.html) becomes one page of a single-page app:
its helmet <style> becomes the page's CSS (swapped in on navigation), its
<x-dc> markup becomes a <template>, and its Component class runs on a small
runtime (app-runtime.js) that understands {{path}}, <sc-for>, <sc-if>,
onClick / onChange and setState.  Links to other artboards become #routes.

usage: python -I src/build_app.py src/pages .
"""
import html, json, re, sys
from pathlib import Path

PAGES = [  # route, artboard, page title
    ('home', 'Overview.dc.html', 'Home'),
    ('al0', 'AL0.dc.html', 'AL0 Assessment'),
    ('al1', 'AL1.dc.html', 'AL1 Student'),
    ('al2', 'AL2.dc.html', 'AL2 Course'),
    ('al3', 'AL3.dc.html', 'AL3 Program'),
    ('al4', 'AL4.dc.html', 'AL4 Institution'),
]
ROUTE_OF = {a: r for r, a, _ in PAGES}
ROUTE_OF['SignIn.dc.html'] = 'signout'


def parts(src):
    helmet = re.search(r'<helmet>(.*?)</helmet>', src, re.S).group(1)
    css = '\n'.join(re.findall(r'<style>(.*?)</style>', helmet, re.S)).strip()
    fonts = re.findall(r'<link href="(https://fonts\.googleapis\.com/css2[^"]*)"', helmet)
    body = re.search(r'</helmet>(.*?)</x-dc>', src, re.S).group(1).strip()
    m = re.search(r"<script type=\"text/x-dc\" data-dc-script data-props='(.*?)'>(.*?)</script>", src, re.S)
    props = {k: v.get('default') for k, v in json.loads(m.group(1)).items() if not k.startswith('$')}
    return css, fonts, body, props, m.group(2).strip()


def convert(body):
    # sc-for / sc-if -> <template> so the HTML parser keeps them inside tables and selects
    body = re.sub(r'<sc-for list="\{\{\s*([\w.]+)\s*\}\}" as="(\w+)"[^>]*>', r'<template data-for="\1" data-as="\2">', body)
    body = re.sub(r'<sc-if value="\{\{\s*([\w.]+)\s*\}\}"[^>]*>', r'<template data-if="\1">', body)
    body = re.sub(r'</sc-(?:for|if)>', '</template>', body)
    body = re.sub(r'\s+hint-placeholder-\w+="[^"]*"', '', body)
    # links between artboards -> routes
    body = re.sub(r'href="([A-Za-z0-9]+\.dc\.html)"', lambda m: 'href="#%s"' % ROUTE_OF.get(m.group(1), 'home'), body)
    assert '<sc-' not in body, 'unconverted sc- tag'
    return body


def main(proj, out):
    proj, out = Path(proj), Path(out)
    fonts, styles, tpls, scripts = set(), [], [], []
    for route, art, title in PAGES:
        css, f, body, props, code = parts((proj / art).read_text(encoding='utf-8'))
        code = re.sub(r"'([A-Za-z0-9]+\.dc\.html)'", lambda m: "'#%s'" % ROUTE_OF.get(m.group(1), 'home'), code)
        fonts.update(f)
        styles.append('<style type="text/x-page-css" data-page="%s">\n%s\n</style>' % (route, css))
        tpls.append('<template id="tpl-%s">\n%s\n</template>' % (route, convert(body)))
        scripts.append('ARETE.page(%s, %s, %s, function (DCLogic) {\n%s\nreturn Component;\n});'
                       % (json.dumps(route), json.dumps(title), json.dumps(props), code))
    # one Google Fonts request with every family the pages use
    fam = sorted({x for u in fonts for x in re.findall(r'family=([^&]+)', html.unescape(u))})
    font_url = 'https://fonts.googleapis.com/css2?' + '&amp;'.join('family=' + x for x in fam) + '&amp;display=swap'
    shell = (Path(__file__).parent / 'shell.html').read_text(encoding='utf-8')
    page = (shell.replace('{{FONT_URL}}', font_url)
                 .replace('{{PAGE_CSS}}', '\n'.join(styles))
                 .replace('{{TEMPLATES}}', '\n'.join(tpls))
                 .replace('{{PAGE_SCRIPTS}}', '\n\n'.join(scripts)))
    (out / 'index.html').write_text(page, encoding='utf-8', newline='\n')
    print('index.html', len(page), 'bytes,', len(PAGES), 'pages')


if __name__ == '__main__':
    main(*sys.argv[1:3])
