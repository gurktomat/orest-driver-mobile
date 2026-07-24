"""Regenerate the Route Relay Driver app icon from the Driver Portal ("Driver Browser") artwork.

Master art: tms-frontend-next/public/driver-login-logo.png (1024x1024 RGBA) — the same
R-swoosh + map-pin + "Driver App" mark the driver portal serves as its browser/PWA icon,
at the highest resolution available on this host.

Framing matches the icons being replaced so visual weight is unchanged:
  iOS AppIcon / Android legacy -> content 0.93 of canvas width, opaque white
  Android adaptive foreground  -> content FG_RATIO of canvas width (the XML insets it 16.7%)
Apple rejects app icons carrying an alpha channel, so opaque outputs are saved as RGB.

Use THIS, not `npm run icons`: capacitor-assets rewrites mipmap-anydpi-v26/*.xml back to
insetting the *background* layer, which leaves the outer 16.7% of an adaptive icon
transparent — the launcher then draws a small white square instead of a full-bleed icon.

    python3 scripts/generate-icons.py     # falls back to resources/icon.png if the
                                          # TMS checkout isn't beside this repo
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

DRIVER = Path(__file__).resolve().parent.parent
MASTER = DRIVER.parent / "app/orest_tms_full/tms-frontend-next/public/driver-login-logo.png"
if not MASTER.exists():                       # standalone checkout: reuse the committed master
    MASTER = DRIVER / "resources/icon.png"
RES = DRIVER / "android/app/src/main/res"

WHITE = (255, 255, 255)
DENSITIES = {"ldpi": 36, "mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

# The adaptive-icon XML insets the foreground 16.7%, so art at FG_RATIO of this canvas
# ends up at FG_RATIO * 0.666 of the 108dp layer — 0.53, inside the 0.611 safe zone.
FG_RATIO = 0.80

def _trim(im):
    """Crop to the artwork. Transparent masters trim on alpha, flattened ones on non-white
    pixels — without the second path a re-run off resources/icon.png would keep the baked-in
    white margin and shrink the logo a little every time."""
    alpha = im.getchannel("A")
    if alpha.getextrema()[0] < 255:
        box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    else:
        flat = Image.new("RGB", im.size, WHITE)
        box = ImageChops.difference(im.convert("RGB"), flat).convert("L") \
                        .point(lambda v: 255 if v > 12 else 0).getbbox()
    return im.crop(box)


ART = _trim(Image.open(MASTER).convert("RGBA"))


def compose(size, width_ratio, *, opaque=True, circle=False):
    """Center the artwork on a `size` square canvas at `width_ratio` of its width."""
    w = max(1, round(size * width_ratio))
    h = max(1, round(w * ART.height / ART.width))
    if h > size * 0.94:                       # never let a tall crop overflow
        h = round(size * 0.94)
        w = round(h * ART.width / ART.height)
    scaled = ART.resize((w, h), Image.LANCZOS)

    if circle:
        canvas = Image.new("RGBA", (size, size), WHITE + (0,))
        mask = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        canvas.paste(Image.new("RGBA", (size, size), WHITE + (255,)), (0, 0),
                     mask.resize((size, size), Image.LANCZOS))
    elif opaque:
        canvas = Image.new("RGBA", (size, size), WHITE + (255,))
    else:
        canvas = Image.new("RGBA", (size, size), WHITE + (0,))

    canvas.alpha_composite(scaled, ((size - w) // 2, (size - h) // 2))
    return canvas.convert("RGB") if (opaque and not circle) else canvas


written = []


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    written.append(f"{img.mode:4s} {img.size[0]:>4}x{img.size[1]:<4} {path}")


# --- master sources kept in the repo (capacitor-assets convention) -------------
save(compose(1024, 0.93), DRIVER / "resources/icon.png")
save(compose(1024, 0.93), DRIVER / "resources/icon-only.png")
save(compose(1024, FG_RATIO, opaque=False), DRIVER / "resources/icon-foreground.png")

# --- iOS: single 1024 universal slot declared in Contents.json ----------------
save(compose(1024, 0.93),
     DRIVER / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")

# --- Android: legacy launcher + round + adaptive foreground, per density ------
for name, px in DENSITIES.items():
    save(compose(px, 0.93), RES / f"mipmap-{name}/ic_launcher.png")
    save(compose(px, 0.93, circle=True), RES / f"mipmap-{name}/ic_launcher_round.png")
    save(compose(px, FG_RATIO), RES / f"mipmap-{name}/ic_launcher_foreground.png")

# --- Play Store listing icon (must match the launcher icon) -------------------
save(compose(512, 0.93), DRIVER / "play-store-assets/icon-512.png")

print(f"artwork crop: {ART.size[0]}x{ART.size[1]} (aspect {ART.width / ART.height:.3f})")
print(f"{len(written)} files written")
for line in written:
    print("  " + line)
