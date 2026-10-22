#!/usr/bin/env python3
"""Draw the Phase T staff portraits as SVG, in the house style of the v3d2 trainer portraits:
512x512, thick #15131b outlines, flat fills, one hard shadow on the right, one soft highlight."""
import sys, math, os

INK = '#15131b'
OUT = sys.argv[1]


import re as _re


def _ink(extra):
    """A stroke colour given in `extra` replaces the ink, so no element carries two strokes."""
    m = _re.search(r' stroke="([^"]+)"', extra)
    if not m:
        return INK, extra
    return m.group(1), extra[:m.start()] + extra[m.end():]


def P(d, fill, sw=7, extra=''):
    ink, extra = _ink(extra)
    if not sw and ink != INK:
        sw = 4
    stroke = f' stroke="{ink}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"' if sw else ''
    return f'<path d="{d}" fill="{fill}"{stroke}{extra}/>'


def C(cx, cy, r, fill, sw=5, extra=''):
    ink, extra = _ink(extra)
    stroke = f' stroke="{ink}" stroke-width="{sw}"' if sw else ''
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{stroke}{extra}/>'


def E(cx, cy, rx, ry, fill, sw=5, extra=''):
    stroke = f' stroke="{INK}" stroke-width="{sw}"' if sw else ''
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}"{stroke}{extra}/>'


def L(x1, y1, x2, y2, sw=4, col=INK):
    return f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{col}" stroke-width="{sw}" stroke-linecap="round"/>'


def R(x, y, w, h, fill, rx=3, sw=5, extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"{extra}/>'


def ell_path(cx, cy, rx, ry):
    return f'M{cx-rx} {cy}a{rx} {ry} 0 1 0 {2*rx} 0a{rx} {ry} 0 1 0 {-2*rx} 0Z'


def body_path(w=196, top=372):
    l, r = 256 - w, 256 + w
    return f'M{l} 520C{l} 432 {256-w*0.6:.1f} {top} 256 {top}C{256+w*0.6:.1f} {top} {r} 432 {r} 520Z'


class Face:
    def __init__(self, name, label):
        self.name = name
        self.label = label
        self.back = []  # behind the body
        self.parts = []
        self.defs = []

    def body(self, col, w=196, top=372):
        d = body_path(w, top)
        self.defs.append(f'<clipPath id="c1"><path d="{d}"/></clipPath>')
        self.parts += [
            P(d, col, 0),
            P(f'M256 {top-10}C{256+w*0.7:.1f} {top} {256+w+20} 432 {256+w+20} 520H{256+w*0.45:.1f}Z', '#000', 0,
              ' opacity=".2" clip-path="url(#c1)"'),
            P(d, 'none', 8),
        ]

    def neck(self, col, w=32, y0=300, y1=390):
        self.parts += [P(f'M{256-w} {y0}L{256-w-4} {y1}H{256+w+4}L{256+w} {y0}Z', col),
                       P(f'M{256+w*0.2:.1f} {y0}L{256+w*0.2:.1f} {y1}H{256+w+4}L{256+w} {y0}Z', '#000', 0, ' opacity=".18"')]

    def head(self, col, cx=256, cy=228, rx=92, ry=96, d=None):
        d = d or ell_path(cx, cy, rx, ry)
        self.defs.append(f'<clipPath id="c2"><path d="{d}"/></clipPath>')
        self.parts += [
            P(d, col, 0),
            P(f'M{cx+rx*0.25:.1f} {cy-ry*1.5:.1f}C{cx+rx*0.9:.1f} {cy-ry*0.7:.1f} {cx+rx*0.9:.1f} {cy+ry*0.6:.1f} {cx+rx*0.1:.1f} {cy+ry*1.4:.1f}H{cx+rx*2:.1f}V{cy-ry*1.5:.1f}Z',
              '#000', 0, ' opacity=".2" clip-path="url(#c2)"'),
            P(ell_path(cx - rx * 0.45, cy - ry * 0.55, rx * 0.22, ry * 0.14), '#fff', 0, ' opacity=".22" clip-path="url(#c2)"'),
            P(d, 'none', 8),
        ]

    def eye(self, x, y, r=14, look=3, lid=None, lidcol=None):
        self.parts += [C(x, y, r, '#fff', 5), C(x + look, y, r * 0.45, INK, 0), C(x + look + r * 0.18, y - r * 0.2, r * 0.14, '#fff', 0)]
        if lid:
            # a heavy upper lid: lid in 0..1 of the eye closed
            h = r * 2 * lid
            self.parts.append(P(f'M{x-r-2} {y-r+h}A{r+2} {r+2} 0 0 1 {x+r+2} {y-r+h}L{x+r+2} {y-r-4}L{x-r-2} {y-r-4}Z', lidcol))

    def add(self, *xs):
        self.parts += list(xs)

    def behind(self, *xs):
        self.back += list(xs)

    def svg(self):
        defs = '<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' + ''.join(self.defs) + '</defs>'
        body = '\n'.join(self.back + self.parts)
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="{self.label}">{defs}{body}\n</svg>\n'


def save(f):
    with open(os.path.join(OUT, f'staff-{f.name}.svg'), 'w') as fh:
        fh.write(f.svg())


def brows(f, y, col=INK, tilt=6, xs=(222, 290), w=20, sw=7):
    a, b = xs
    f.add(L(a - w, y - tilt, a + w, y + tilt, sw, col), L(b - w, y + tilt, b + w, y - tilt, sw, col))


def ledger(f, x, y, rot=-8):
    f.add(f'<g transform="rotate({rot} {x+60} {y+45})">' + R(x, y, 120, 92, '#7a3b2a', 4, 6) + R(x + 10, y + 8, 100, 76, '#f3eedf', 2, 4)
          + ''.join(L(x + 20, y + 22 + i * 14, x + 100 - (i % 2) * 24, y + 22 + i * 14, 3, '#9a9080') for i in range(4)) + '</g>')


# ---------------------------------------------------------------------------------------------
def brine():
    f = Face('brine', 'Hattie Brine')
    f.body('#2f4a6e', 200)
    f.add(P('M196 384L256 470L316 384L340 520H172Z', '#e8dcc0'))  # apron
    f.add(L(206, 430, 306, 430, 4, '#b8ab90'))
    f.neck('#7fa8a0', 34)
    f.head('#7fa8a0', 256, 236, 108, 86)
    for (x, y, r) in [(198, 182, 11), (214, 166, 8), (312, 178, 9), (296, 300, 7), (186, 276, 8)]:
        f.add(C(x, y, r, '#d9d2c0', 4), L(x - r * 0.5, y, x + r * 0.5, y, 2), L(x, y - r * 0.5, x, y + r * 0.5, 2))
    # headscarf
    f.add(P('M146 226Q146 118 256 114Q366 118 366 226Q334 184 256 180Q178 184 146 226Z', '#c0392b', 6))
    f.add(P('M352 196L404 214L388 244L360 226Z', '#c0392b', 5), P('M356 214L396 260L376 266Z', '#a02a20', 5))
    f.add(*[C(196 + i * 30, 152 - (2 - abs(2 - i)) * 8, 5, '#f3eedf', 0) for i in range(5)])
    f.eye(220, 232, 13, 2, 0.55, '#6a9088')
    f.eye(292, 232, 13, 2, 0.55, '#6a9088')
    brows(f, 210, tilt=-7)
    f.add(P('M244 262Q256 252 268 262Q262 280 256 282Q250 280 244 262Z', '#5f8a82', 5))
    f.add(P('M218 296Q256 284 294 300', 'none', 6))
    ledger(f, 300, 410, 8)
    save(f)


def tallow():
    f = Face('tallow', 'Mister Tallow')
    f.defs.append('<pattern id="chk" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#e8b23a"/><rect width="14" height="14" fill="#c46a1f"/><rect x="14" y="14" width="14" height="14" fill="#c46a1f"/></pattern>')
    f.body('url(#chk)', 196)
    f.add(P('M206 380L256 456L306 380L318 520H194Z', '#f3eedf'))
    f.add(P('M236 392L256 380L276 392L268 470H244Z', '#1f6f5c', 5))
    f.add(P('M180 386L230 384L256 456L210 520H160Z', 'url(#chk)', 6), P('M332 386L282 384L256 456L302 520H352Z', 'url(#chk)', 6))
    f.add(C(178, 430, 13, '#e0503a', 4), C(178, 430, 5, '#ffd36a', 0), L(178, 443, 182, 466, 4, '#3f8f3f'))
    f.neck('#f1e2a8', 30)
    f.head('#f1e2a8', 256, 214, 82, 104)
    # the wax drips, and the wick
    f.add(P('M196 140Q200 168 206 150Q212 186 220 150Q226 132 196 140Z', '#fff7d6', 4))
    f.add(L(256, 110, 256, 84, 5), P('M256 50Q272 72 256 86Q240 72 256 50Z', '#ffcf4a', 4, ' filter="url(#glow)"'), P('M256 58Q266 72 256 82Q246 72 256 58Z', '#fff2a8', 0))
    f.add(P('M188 168Q256 118 324 168Q300 140 256 140Q212 140 188 168Z', '#3a2a1a', 5))
    f.eye(226, 206, 14, 2)
    f.eye(288, 206, 14, 2)
    brows(f, 182, tilt=-5, xs=(226, 288))
    f.add(P('M250 228Q256 246 262 228', 'none', 5))
    f.add(P('M206 262Q256 316 306 262Q256 282 206 262Z', '#fff', 6), L(224, 270, 224, 282, 3), L(244, 274, 244, 290, 3), L(268, 274, 268, 290, 3), L(288, 270, 288, 282, 3))
    save(f)


def vosk():
    f = Face('vosk', 'Quartermaster Vosk')
    f.body('#5a5f3a', 206)
    f.add(P('M200 380L256 440L312 380', 'none', 6))
    f.add(*[C(256, 452 + i * 26, 6, '#c9a227', 3) for i in range(3)])
    f.neck('#6aa84f', 40)
    f.head('#6aa84f', 256, 240, 104, 90, 'M152 240C152 170 200 140 256 140C320 140 360 170 360 240C360 300 330 330 256 334C182 330 152 300 152 240Z')
    for (x, y) in [(200, 280), (222, 300), (300, 288), (320, 266), (190, 250)]:
        f.add(E(x, y, 8, 6, '#4f8a3a', 0))
    # peaked cap
    f.add(P('M160 196Q256 104 352 196Z', '#3d4428', 6), P('M150 196H362Q380 208 362 218H150Q132 208 150 196Z', '#2a2f1c', 6), C(256, 168, 12, '#c9a227', 4))
    for x in (218, 294):
        f.add(C(x, 238, 15, '#f2d64b', 5), E(x, 238, 3.5, 12, INK, 0))
    f.add(P('M180 290Q256 318 332 290', 'none', 6), C(236, 268, 4, INK, 0), C(276, 268, 4, INK, 0))
    # keys and clipboard
    f.add(C(170, 470, 22, 'none', 6), *[P(f'M{150+i*14} 488l-6 34h10l2-10h6l2-8', '#c9a227', 3) for i in range(3)])
    f.add(R(306, 410, 98, 120, '#a57c4a', 4, 6), R(318, 428, 74, 96, '#f3eedf', 2, 4), R(338, 402, 34, 16, '#9a9a9a', 3, 4),
          *[L(328, 446 + i * 16, 382, 446 + i * 16, 3, '#9a9080') for i in range(4)])
    save(f)


def clem():
    f = Face('clem', 'Cargo Clem')
    f.body('#3f6f8f', 196)
    f.add(P('M196 380V520M316 380V520', 'none', 10), P('M196 380V520M316 380V520', 'none', 6, ''))
    f.add(R(214, 440, 84, 60, '#355f7a', 4, 5))
    f.neck('#e0915a', 30)
    # crowbar over the shoulder, behind the head
    f.behind(P('M96 470L392 120L404 132L110 484Z', '#7a8288', 6), P('M392 120Q420 96 432 116', 'none', 8))
    f.head('#e0915a', 256, 226, 88, 94)
    f.add(P('M168 196Q170 120 256 118Q340 120 344 196Q326 160 300 170Q290 140 262 160Q240 136 220 166Q196 150 168 196Z', '#5a3a22', 6))
    f.add(P('M166 186Q256 160 346 186', 'none', 12), P('M166 186Q256 160 346 186', 'none', 6, ' stroke="#4a4a4a"'))
    f.add(C(220, 172, 20, '#9fd4e8', 6, ' fill-opacity=".7"'), C(292, 172, 20, '#9fd4e8', 6, ' fill-opacity=".7"'))
    f.eye(222, 230, 13, 3)
    f.eye(290, 230, 13, 3)
    f.add(*[C(x, y, 3, '#b8693a', 0) for x, y in [(200, 262), (210, 270), (300, 262), (312, 270), (306, 254)]])
    f.add(P('M228 282Q256 300 284 282', 'none', 6), P('M262 286L270 298L278 286', '#fff', 3))
    save(f)


def ninefingers():
    f = Face('ninefingers', 'Penny Ninefingers')
    f.body('#6b4a7a', 186)
    f.add(P('M206 380L256 430L306 380', 'none', 6))
    f.neck('#9b8373', 28)
    f.add(C(180, 150, 34, '#9b8373', 7), C(180, 150, 18, '#e8a0b0', 0), C(332, 150, 34, '#9b8373', 7), C(332, 150, 18, '#e8a0b0', 0))
    f.head('#9b8373', 256, 236, 86, 90)
    f.add(P('M206 266Q256 340 306 266Q300 306 256 318Q212 306 206 266Z', '#b8a090', 5))
    f.add(E(256, 268, 20, 14, '#f08aa8', 6), P('M246 300H266V316H246Z', '#fff', 4), L(256, 300, 256, 316, 3))
    for s in (-1, 1):
        for i in range(3):
            f.add(L(256 + s * 36, 276 + i * 8, 256 + s * 84, 264 + i * 12, 3))
    f.eye(224, 224, 12, 4)
    f.eye(288, 224, 12, 4)
    brows(f, 204, tilt=4, xs=(224, 288), w=16, sw=6)
    # a fingerless glove held up: four fingers, and a gap
    f.add(P('M346 520V420Q346 404 362 404H404Q420 404 420 420V520Z', '#3a3a4a', 6))
    for i, h in enumerate([46, 0, 54, 48, 40]):
        if h == 0:
            continue
        f.add(R(352 + i * 13, 404 - h, 12, h + 6, '#9b8373', 5, 4))
    f.add(C(178, 470, 22, '#e8c04a', 5), C(178, 470, 12, 'none', 3))
    save(f)


def abacus():
    f = Face('abacus', 'The Abacus')
    f.body('#b8862f', 200)
    f.add(R(176, 400, 160, 112, '#7a5520', 6, 6))
    for row in range(4):
        y = 420 + row * 24
        f.add(L(186, y, 326, y, 3, '#3a2a10'))
        for i in range(5):
            x = 196 + i * 18 + (row * 13) % 40
            f.add(C(x, y, 8, ['#e0503a', '#f2d64b', '#3f8fcf', '#7ac870'][row], 3))
    f.neck('#8a8a8a', 26)
    f.add(L(256, 120, 256, 84, 6), C(256, 78, 10, '#e0503a', 5, ' filter="url(#glow)"'), C(256, 78, 8, '#ff7a5a', 4))
    f.head('#c9973a', d='M168 132H344Q360 132 360 148V300Q360 316 344 316H168Q152 316 152 300V148Q152 132 168 132Z')
    f.add(R(178, 158, 156, 128, '#1f3a2f', 8, 6))
    f.add(P('M262 160L250 196L272 214L256 252L268 284', 'none', 4, ' stroke-opacity=".9"'))
    f.add(R(206, 196, 26, 22, '#7aff9a', 2, 0), R(280, 196, 26, 22, '#7aff9a', 2, 0), P('M214 250H298', 'none', 0), R(214, 248, 84, 8, '#7aff9a', 2, 0))
    f.add(C(168, 224, 10, '#9a9a9a', 5), C(344, 224, 10, '#9a9a9a', 5))
    for x, y in [(170, 144), (342, 144), (170, 304), (342, 304)]:
        f.add(C(x, y, 4, '#7a5520', 0))
    save(f)


def morrow():
    f = Face('morrow', 'Dray Morrow')
    f.body('#6b4a2a', 230, 360)
    f.add(P('M150 400L362 520M362 400L150 520', 'none', 12), P('M150 400L362 520M362 400L150 520', 'none', 4, ' stroke="#c9a227"'), C(256, 460, 14, '#9a9a9a', 5))
    f.add(P('M108 160Q60 120 70 70Q100 120 150 140Z', '#e8dcc0', 6), P('M404 160Q452 120 442 70Q412 120 362 140Z', '#e8dcc0', 6))
    f.head('#8a5a32', 256, 236, 116, 108)
    for i in range(9):
        x = 160 + i * 24
        f.add(P(f'M{x} 160Q{x+12} {222 + (i % 3) * 6} {x+24} 160', '#6b4220', 4))
    f.add(E(220, 236, 11, 6, INK, 0), E(292, 236, 11, 6, INK, 0), C(224, 234, 2.5, '#fff', 0), C(296, 234, 2.5, '#fff', 0))
    f.add(E(256, 296, 56, 36, '#b07a4a', 6), E(236, 296, 8, 10, INK, 0), E(276, 296, 8, 10, INK, 0))
    f.add(C(256, 330, 12, 'none', 5, ' stroke="#c9a227"'))
    for i in range(7):
        x = 166 + i * 30
        f.add(P(f'M{x} 318Q{x+15} {360 + (i % 2) * 10} {x+30} 318', '#6b4220', 4))
    save(f)


def kelp():
    f = Face('kelp', 'Auntie Kelp')
    f.body('#d0607a', 190)
    f.add(*[C(x, y, 7, '#f3eedf', 0) for x, y in [(160, 450), (200, 420), (300, 430), (340, 470), (250, 490), (210, 500)]])
    f.neck('#8fd0a0', 30)
    for i, x in enumerate([150, 172, 196, 316, 340, 362]):
        f.behind(P(f'M{x} 170Q{x-20 if i<3 else x+20} 260 {x} 330Q{x+16 if i<3 else x-16} 380 {x-6 if i<3 else x+6} 420', 'none', 14, ' stroke="#2f7a3a"'))
    f.head('#8fd0a0', 256, 232, 88, 92)
    f.add(P('M164 210Q170 120 256 116Q342 120 348 210Q320 150 290 168Q270 132 248 162Q226 136 204 170Q186 156 164 210Z', '#3f9a4a', 6))
    f.add(*[C(x, y, 6, '#e0503a', 3) for x, y in [(210, 140), (300, 146)]])
    for x in (222, 290):
        f.add(C(x, 232, 24, '#fff', 6, ' fill-opacity=".35"'))
        f.eye(x, 232, 11, 0)
    f.add(L(246, 232, 266, 232, 5))
    f.add(E(196, 270, 14, 9, '#ff8aa0', 0, ' opacity=".7"'), E(316, 270, 14, 9, '#ff8aa0', 0, ' opacity=".7"'))
    f.add(P('M222 286Q256 314 290 286', 'none', 6))
    # the trolley
    f.add(P('M344 400H440L428 480H356Z', '#c0c0c8', 6), *[L(360 + i * 18, 404, 362 + i * 16, 476, 3) for i in range(5)],
          L(440, 400, 460, 370, 6), C(366, 498, 12, '#2a2a3a', 5), C(420, 498, 12, '#2a2a3a', 5),
          P('M352 400Q370 360 392 392Q410 356 430 398Z', '#3f9a4a', 5))
    save(f)


def stroud():
    f = Face('stroud', 'Fennick Stroud')
    f.body('#4a5560', 184)
    f.add(P('M206 380L256 440L306 380', 'none', 6), C(212, 430, 8, '#c9a227', 4), C(300, 430, 8, '#c9a227', 4), R(272, 456, 44, 26, '#c9a227', 3, 4))
    f.neck('#a8b0b4', 26)
    f.head('#a8b0b4', 256, 236, 74, 110)
    f.add(P('M168 170Q256 70 344 170Z', '#2f3a44', 6), P('M160 170H352Q372 182 352 194H160Q140 182 160 170Z', '#1a2026', 6), P('M178 194H334Q320 214 256 214Q192 214 178 194Z', '#1a2026', 5), R(240, 128, 32, 28, '#c9a227', 4, 4))
    f.eye(228, 244, 11, 2, 0.4, '#8a9296')
    f.add(C(290, 244, 26, '#cfe8ff', 7, ' fill-opacity=".45"'), C(290, 244, 9, INK, 0), C(294, 240, 3, '#fff', 0), P('M310 262Q330 300 322 340', 'none', 3, ' stroke="#c9a227"'))
    f.add(L(206, 222, 246, 228, 5), L(270, 218, 312, 212, 5))
    f.add(P('M248 262L240 300L262 300', 'none', 5), P('M226 322H286', 'none', 6))
    save(f)


def oduya():
    f = Face('oduya', 'Odds-On Oduya')
    f.body('#2a3a5a', 194)
    f.add(P('M206 380L256 456L306 380L318 520H194Z', '#f3eedf'))
    f.add(P('M226 386L256 400L286 386L286 414L256 400L226 414Z', '#c0392b', 5))
    f.add(P('M180 386L230 384L256 456L210 520H160Z', '#2a3a5a', 6), P('M332 386L282 384L256 456L302 520H352Z', '#2a3a5a', 6))
    f.add(L(200, 420, 214, 440, 3, '#f3eedf'), L(208, 416, 222, 436, 3, '#f3eedf'))
    f.neck('#8a5030', 30)
    f.head('#8a5030', 256, 232, 86, 96)
    # trilby with a slip in the band
    f.add(P('M140 178Q256 150 372 178Q380 192 356 192H156Q132 192 140 178Z', '#3a3a3a', 6), P('M180 180Q182 104 256 102Q330 104 332 180Z', '#4a4a4a', 6),
          P('M182 160H330V176H182Z', '#c0392b', 4), f'<g transform="rotate(-14 300 150)">' + R(286, 120, 30, 40, '#f3eedf', 2, 4) + L(292, 132, 310, 132, 2) + L(292, 142, 306, 142, 2) + '</g>')
    f.eye(224, 230, 13, 3, 0.3, '#7a4428')
    f.eye(290, 230, 13, 3, 0.3, '#7a4428')
    f.add(L(206, 210, 240, 206, 5), L(274, 206, 308, 210, 5))
    f.add(P('M222 280Q256 270 290 280', 'none', 4), P('M226 292Q256 314 286 292', 'none', 6), P('M240 296Q256 304 272 296', '#fff', 0))
    save(f)


def marchetti():
    f = Face('marchetti', 'Velvet Marchetti')
    f.body('#5a1a6a', 196)
    f.add(P('M196 384Q256 460 316 384', 'none', 6), *[C(216 + i * 20, 404 + abs(2 - i) * -6 + 18, 7, '#f3eedf', 3) for i in range(5)])
    f.neck('#9a6ac0', 26)
    f.head('#9a6ac0', 256, 232, 84, 98)
    for i in range(10):
        a = math.pi * (0.9 + i * 0.13)
        x, y = 256 + 96 * math.cos(a), 220 + 104 * math.sin(a)
        f.add(P(f'M{x:.1f} {y:.1f}l{8*math.cos(a+0.6):.1f} {8*math.sin(a+0.6):.1f}l{6*math.cos(a-0.6):.1f} {6*math.sin(a-0.6):.1f}', 'none', 4, ' stroke="#7a4aa0"'))
    f.add(P('M170 200Q180 120 256 112Q332 120 342 200Q330 150 256 146Q182 150 170 200Z', '#3a0a4a', 6))
    for x in (224, 290):
        f.eye(x, 228, 13, 2, 0.45, '#7a4aa0')
        f.add(*[L(x - 12 + i * 8, 222, x - 16 + i * 9, 210, 3) for i in range(4)])
    f.add(C(170, 268, 8, '#f2d64b', 4), C(342, 268, 8, '#f2d64b', 4))
    f.add(P('M234 288Q256 302 278 288Q256 296 234 288Z', '#c0185a', 5))
    f.add(L(274, 294, 420, 250, 6, '#1a1a1a'), L(380, 262, 420, 250, 6, '#c9a227'), C(424, 248, 5, '#ff7a3a', 0, ' filter="url(#glow)"'),
          P('M428 236Q420 214 436 200Q452 186 444 166', 'none', 4, ' stroke="#cfcfd8" stroke-opacity=".7"'))
    save(f)


def pargeter():
    f = Face('pargeter', 'Snitch Pargeter')
    f.body('#5a5040', 176)
    f.add(P('M210 380L256 420L302 380', 'none', 6))
    f.neck('#c8a070', 24)
    f.add(P('M180 210Q100 150 110 230Q120 290 186 262Z', '#c8a070', 6), P('M332 210Q412 150 402 230Q392 290 326 262Z', '#c8a070', 6),
          P('M170 222Q130 200 136 236Q142 262 176 252Z', '#e8a0b0', 0), P('M342 222Q382 200 376 236Q370 262 336 252Z', '#e8a0b0', 0))
    f.head('#c8a070', 256, 244, 70, 92)
    f.add(P('M170 186Q256 120 342 186Q350 200 330 202H182Q162 200 170 186Z', '#6a6050', 6), P('M180 196Q256 180 360 214Q340 222 300 214Q256 204 180 206Z', '#5a5040', 5))
    f.eye(232, 244, 11, 7)
    f.eye(282, 244, 11, 7)
    f.add(L(218, 226, 246, 230, 5), L(268, 230, 296, 226, 5))
    f.add(P('M256 252L270 284H250', 'none', 5), P('M234 304Q262 296 284 308', 'none', 5))
    f.add(L(206, 330, 202, 346, 3), L(300, 330, 306, 346, 3))
    save(f)


def tumbler():
    f = Face('tumbler', 'Tumbler')
    f.body('#1f4a3a', 200)
    f.add(P('M206 380L256 440L306 380', 'none', 6))
    f.neck('#5a8ac8', 30)

    def card(x, y, rot, suit):
        col = '#c0392b' if suit in '♥♦' else INK
        return f'<g transform="rotate({rot} {x+20} {y+28})">' + R(x, y, 40, 56, '#f3eedf', 4, 4) + f'<text x="{x+20}" y="{y+36}" font-size="22" text-anchor="middle" fill="{col}">{suit}</text></g>'
    for side, x0 in ((-1, 120), (1, 392)):
        f.add(P(f'M{256+side*150} 470Q{256+side*210} 420 {x0} 340', 'none', 22, ' stroke="#5a8ac8"'), P(f'M{256+side*150} 470Q{256+side*210} 420 {x0} 340', 'none', 0))
        f.add(P(f'M{256+side*170} 500Q{256+side*230} 470 {256+side*228} 410', 'none', 22, ' stroke="#4a7ab8"'))
    f.add(card(96, 290, -12, '♠'), card(112, 300, -4, '♥'), card(372, 290, 10, '♦'), card(388, 300, 18, '♣'),
          card(440, 380, 6, '♠'), card(40, 380, -8, '♥'))
    f.head('#5a8ac8', 256, 232, 84, 92)
    f.add(P('M160 180Q256 150 352 180L372 206Q256 186 140 206Z', '#3fbf7a', 6, ' fill-opacity=".85"'), P('M176 180Q256 120 336 180', 'none', 6))
    f.eye(224, 236, 12, 0, 0.5, '#4a7ab8')
    f.eye(288, 236, 12, 0, 0.5, '#4a7ab8')
    f.add(L(230, 296, 282, 296, 6))
    save(f)


def dice():
    f = Face('dice', 'Professor Dice')
    f.body('#6a4a30', 192)
    f.add(P('M206 380L256 456L306 380L318 520H194Z', '#f3eedf'), P('M238 392L256 380L274 392L256 410Z', '#2a3a6a', 5))
    f.add(P('M180 386L230 384L256 456L210 520H160Z', '#6a4a30', 6), P('M332 386L282 384L256 456L302 520H352Z', '#6a4a30', 6))
    f.neck('#b08a5a', 30)
    f.add(P('M172 150L150 96L206 136Z', '#8a6a40', 6), P('M340 150L362 96L306 136Z', '#8a6a40', 6))
    f.head('#b08a5a', 256, 232, 96, 92)
    f.add(E(256, 236, 84, 70, '#e8d4a8', 0))
    for i in range(10):
        a = math.pi * 2 * i / 10
        f.add(L(256 + 64 * math.cos(a), 236 + 54 * math.sin(a), 256 + 80 * math.cos(a), 236 + 66 * math.sin(a), 3, '#c8a878'))
    for x in (222, 290):
        f.add(C(x, 228, 26, '#f6b33a', 6), C(x, 228, 12, INK, 0), C(x + 4, 223, 4, '#fff', 0), C(x, 228, 30, 'none', 5))
    f.add(L(252, 228, 260, 228, 5), P('M244 262L268 262L256 292Z', '#e0a030', 5))
    f.add(P('M170 160H342L330 140H182Z', '#1a1a22', 5), R(190, 108, 132, 34, '#1a1a22', 4, 5), L(316, 126, 340, 176, 4, '#c9a227'))

    def die(x, y, rot, pips):
        s = f'<g transform="rotate({rot} {x+22} {y+22})">' + R(x, y, 44, 44, '#f3eedf', 8, 5)
        for px, py in pips:
            s += C(x + px, y + py, 4.5, '#c0392b', 0)
        return s + '</g>'
    f.add(die(120, 450, -14, [(11, 11), (22, 22), (33, 33)]), die(350, 452, 12, [(12, 12), (32, 12), (12, 32), (32, 32), (22, 22)]))
    save(f)


def longshot():
    f = Face('longshot', 'Lady Longshot')
    f.body('#2a5a5a', 184)
    f.add(P('M196 384Q256 430 316 384', 'none', 6), C(256, 400, 10, '#f2d64b', 4))
    f.neck('#d0c0e0', 22)
    f.head('#d0c0e0', 256, 246, 70, 98)
    # the hat
    f.add(E(256, 164, 164, 34, '#2a5a5a', 7), P('M180 160Q190 80 256 76Q322 80 332 160Z', '#1f4a4a', 7), P('M184 140H328', 'none', 10, ' stroke="#c0392b"'))
    for i, (x, col) in enumerate([(330, '#f3eedf'), (350, '#e0503a'), (312, '#f2d64b')]):
        f.add(P(f'M{x} 136Q{x+60} {40+i*14} {x+96} {60+i*26}Q{x+50} {84+i*10} {x} 140Z', col, 5))
    f.add(*[L(330 + i * 10, 136, 380 + i * 14, 74 + i * 6, 2, '#9a9080') for i in range(3)])
    f.eye(230, 248, 11, 2, 0.5, '#b0a0c8')
    f.eye(282, 248, 11, 2, 0.5, '#b0a0c8')
    f.add(L(214, 226, 244, 222, 4), L(268, 222, 298, 226, 4))
    f.add(P('M240 304Q256 312 272 304', 'none', 6, ' stroke="#9a3060"'))
    # binoculars
    f.add(R(320, 400, 46, 70, '#3a3a44', 10, 6), R(372, 400, 46, 70, '#3a3a44', 10, 6), R(358, 414, 22, 22, '#2a2a30', 3, 5),
          C(343, 474, 18, '#9fd4e8', 6), C(395, 474, 18, '#9fd4e8', 6))
    save(f)


def ferrety():
    f = Face('ferrety', 'Mags Ferrety')
    f.body('#7a5a3a', 200)
    f.add(P('M200 380L256 520L312 380', 'none', 7))
    for x, y in [(170, 440), (300, 440), (180, 480), (310, 486)]:
        f.add(R(x, y, 40, 30, '#6a4a2a', 3, 5), L(x + 4, y + 8, x + 36, y + 8, 3))
    f.neck('#e8d8c0', 24)
    f.add(C(190, 160, 22, '#5a4030', 6), C(322, 160, 22, '#5a4030', 6), C(190, 160, 10, '#e8a0b0', 0), C(322, 160, 10, '#e8a0b0', 0))
    f.head('#5a4030', 256, 228, 82, 84, 'M174 220C174 166 212 140 256 140C300 140 338 166 338 220C338 262 300 296 256 320C212 296 174 262 174 220Z')
    f.add(P('M196 218Q256 186 316 218Q300 280 256 314Q212 280 196 218Z', '#e8d8c0', 0))
    f.add(P('M190 216Q222 196 250 222Q222 236 190 216Z', '#2a1a10', 0), P('M322 216Q290 196 262 222Q290 236 322 216Z', '#2a1a10', 0))
    f.eye(222, 216, 10, 3)
    f.eye(290, 216, 10, 3)
    f.add(E(256, 296, 12, 8, '#2a1a10', 4), P('M234 274Q246 284 256 280Q266 284 278 272', 'none', 4))
    f.add(*[L(256 + s * 20, 290 + i * 6, 256 + s * 62, 278 + i * 10, 2) for s in (-1, 1) for i in range(3)])
    save(f)


def evens():
    f = Face('evens', 'The Count of Evens')
    f.behind(P('M120 520L150 330Q256 300 362 330L392 520Z', '#4a0a1a', 7), P('M150 330L120 250L210 310Z', '#6a1a2a', 6), P('M362 330L392 250L302 310Z', '#6a1a2a', 6))
    f.body('#1f1a26', 186)
    f.add(P('M210 380L256 440L302 380', 'none', 6), C(300, 450, 18, '#8a7a4a', 5), P('M292 420L300 400L308 420', '#6a1a2a', 4), C(300, 450, 8, '#5a5030', 0))
    f.neck('#b8c4d0', 24)
    f.head('#b8c4d0', 256, 236, 78, 104)
    f.add(P('M178 196Q186 118 256 116Q326 118 334 196Q316 156 284 156L256 192L228 156Q196 156 178 196Z', '#1a1a22', 6))
    f.eye(226, 232, 12, 2, 0.4, '#98a4b0')
    f.eye(288, 232, 12, 2, 0.4, '#98a4b0')
    f.add(C(288, 232, 22, 'none', 5), P('M306 248Q320 300 300 360', 'none', 3, ' stroke="#c9a227"'))
    f.add(L(206, 208, 242, 214, 5), L(270, 214, 306, 208, 5))
    f.add(P('M224 296Q256 310 288 296', 'none', 5), P('M236 300L240 316L246 302Z', '#fff', 3), P('M266 302L272 316L276 300Z', '#fff', 3))
    save(f)


for fn in [brine, tallow, vosk, clem, ninefingers, abacus, morrow, kelp, stroud,
           oduya, marchetti, pargeter, tumbler, dice, longshot, ferrety, evens]:
    fn()
print('17 portraits')
