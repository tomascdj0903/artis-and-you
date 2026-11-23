"""Logo Artis & You — tuile en verre (version « du milieu »), en vectoriel.
Usage : python3 gen.py sortie.svg [--bleed]
  sans option : tuile avec marge transparente, comme desktop/build/icon.png (logiciel PC / Mac)
  --bleed     : tuile pleine, sans marge (favicon, .ico petites tailles, avatar)
Géométrie du A : celle de web/public/logo.svg (viewBox 132), tubes de 22 unités.
Mesures reprises de icon.png (512 px) : tuile 450 px, marge 31 px, coins ≈ 22 %, tubes 41 px.
"""
import sys

A_LEFT = "M14 122 C14 62 36 18 66 9"      # du bas vers le sommet
A_RIGHT = "M66 9 C96 18 118 62 118 122"   # du sommet vers le bas
MAHOGANY = "#4B2014"
CLAY = "#D3B49F"


def svg(bleed=False, size=1024):
    inset = 0 if bleed else size * 62 / 1024
    t = size - 2 * inset                     # côté de la tuile
    r = t * 0.222                            # rayon des coins
    k = t * 3.817 / 900                      # échelle du A (1 unité -> k px)
    ax = inset + t * (259.6 - 62) / 900      # origine du A dans la tuile
    ay = inset + t * (270.2 - 62) / 900
    f = lambda v: f"{v:.3f}"
    u = lambda px: f(px * size / 1024 / k)   # px (canevas 1024) -> unités du A

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
<title>Artis &amp; You</title>
<defs>
  <clipPath id="ay-tile"><rect x="{f(inset)}" y="{f(inset)}" width="{f(t)}" height="{f(t)}" rx="{f(r)}"/></clipPath>
  <linearGradient id="ay-body" x1=".35" y1="0" x2=".65" y2="1">
    <stop offset="0" stop-color="#C05E47"/>
    <stop offset=".4" stop-color="#B84F35"/>
    <stop offset="1" stop-color="#A13822"/>
  </linearGradient>
  <linearGradient id="ay-rim" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFE9E1" stop-opacity=".7"/>
    <stop offset=".3" stop-color="#FFE9E1" stop-opacity=".2"/>
    <stop offset=".7" stop-color="#FFE9E1" stop-opacity=".06"/>
    <stop offset="1" stop-color="#FFE9E1" stop-opacity=".28"/>
  </linearGradient>
  <radialGradient id="ay-pearl" cx=".4" cy=".35" r=".7">
    <stop offset="0" stop-color="#DFC3B0"/>
    <stop offset=".7" stop-color="{CLAY}"/>
    <stop offset="1" stop-color="#C4A28B"/>
  </radialGradient>
  <filter id="ay-shadow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="{u(3.4)}"/>
    <feOffset dy="{u(4.2)}"/>
    <feComponentTransfer><feFuncA type="linear" slope=".36"/></feComponentTransfer>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="ay-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{u(0.9)}"/></filter>
  <filter id="ay-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{u(4)}"/></filter>
  <clipPath id="ay-cap"><circle cx="66" cy="9" r="11.5"/></clipPath>
  <mask id="ay-capmask" maskUnits="userSpaceOnUse" x="-50" y="-50" width="250" height="250">
    <path d="{A_RIGHT}" stroke="#fff" stroke-width="22" stroke-linecap="round" fill="none" clip-path="url(#ay-cap)"/>
  </mask>
</defs>
<g clip-path="url(#ay-tile)">
  <rect x="{f(inset)}" y="{f(inset)}" width="{f(t)}" height="{f(t)}" fill="url(#ay-body)"/>
  <g transform="translate({f(ax)} {f(ay)}) scale({f(k)})" fill="none" stroke-linecap="round">
    <!-- tube gauche, acajou -->
    <path d="{A_LEFT}" stroke="{MAHOGANY}" stroke-width="22" filter="url(#ay-shadow)"/>
    <path d="{A_LEFT}" stroke="#F4D6CB" stroke-opacity=".34" stroke-width="3"
          stroke-dasharray="140 300" stroke-dashoffset="-5" transform="translate(-2.9 -1.4)" filter="url(#ay-soft)"/>
    <!-- point, perle d'argile -->
    <circle cx="66" cy="78" r="12" fill="url(#ay-pearl)" filter="url(#ay-shadow)"/>
    <ellipse cx="61.9" cy="73.7" rx="3.4" ry="3" fill="#fff" fill-opacity=".35" filter="url(#ay-soft)"/>
    <ellipse cx="61.9" cy="73.7" rx="2.4" ry="2.1" fill="#fff" fill-opacity=".9"/>
    <!-- tube droit, argile, posé sur le gauche -->
    <path d="{A_RIGHT}" stroke="{CLAY}" stroke-width="22" filter="url(#ay-shadow)"/>
    <path d="{A_RIGHT}" stroke="#fff" stroke-opacity=".26" stroke-width="8"
          stroke-dasharray="124 300" stroke-dashoffset="-1" transform="translate(-3.4 -1.8)" filter="url(#ay-glow)"/>
    <path d="{A_RIGHT}" stroke="#fff" stroke-opacity=".8" stroke-width="3.5"
          stroke-dasharray="124 300" stroke-dashoffset="-1" transform="translate(-3.4 -1.8)" filter="url(#ay-soft)"/>
    <g mask="url(#ay-capmask)">
      <path d="{A_LEFT}" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-dasharray="140 300" stroke-dashoffset="-5"
            transform="translate(-2.9 -1.4)" filter="url(#ay-soft)"/>
    </g>
    <circle cx="61.6" cy="6.4" r="1.9" fill="#fff" fill-opacity=".85" filter="url(#ay-soft)"/>
  </g>
</g>
<rect x="{f(inset + t * .004)}" y="{f(inset + t * .004)}" width="{f(t * .992)}" height="{f(t * .992)}" rx="{f(r * .985)}"
      fill="none" stroke="url(#ay-rim)" stroke-width="{f(t * .007)}"/>
</svg>
'''


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    open(args[0] if args else "logo.svg", "w").write(svg(bleed="--bleed" in sys.argv))
