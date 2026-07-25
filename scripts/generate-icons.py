"""Regenerate the Route Relay Driver app icon from the Driver Portal ("Driver Browser") artwork.

Master art: tms-frontend-next/public/driver-login-logo.png (1024x1024 RGBA) — the same
R-swoosh + map-pin mark the driver portal serves as its browser/PWA icon, at the highest
resolution available on this host. The "Driver App" / "TMS Orest Express" wordmark is
STRIPPED (_strip_wordmark): illegible at icon size, and the second line is stale branding.

Also emits the iOS 18 dark-appearance icon (transparent, ring flipped to white) and the
Android 13+ themed-icon monochrome layer (declared in mipmap-anydpi-v26/*.xml).

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

import numpy as np
from PIL import Image, ImageChops, ImageDraw
from scipy import ndimage

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


def _strip_wordmark(im):
    """Remove the "Driver App" / "TMS Orest Express" text, keeping only the mark.

    At home-screen size the two text lines are illegible, and the second one is
    stale branding ("TMS Orest Express" predates the Route Relay rename). The
    mark — swoosh ellipse + R + map-pin — is one large connected blob at the
    top of the canvas; every text glyph is a small separate component in the
    bottom band. So: connected-component label the ink, keep the biggest blob
    and anything in the upper half, drop small components whose centroid sits
    in the bottom band.

    Belt-and-braces: if the swoosh's lower arc happens to touch a glyph (which
    would merge it into the big blob), a per-pixel pass also clears *achromatic*
    ink in the bottom band — the black wordmark — without touching the orange
    arc. The pin's black ring is achromatic too, but lives in the top half.
    """
    rgba = np.asarray(im).astype(np.float32)
    h, w = rgba.shape[:2]
    ink = rgba[..., 3] > 16
    total_ink = ink.sum()

    # Colour gates are judged on the ON-WHITE COMPOSITE, not the stored
    # straight-alpha values: a dark noise pixel at low alpha looks beige once
    # composited but keeps high chroma in master space, so master-space
    # thresholds let it through (28px beige speck, first attempt).
    a = rgba[..., 3:4] / 255.0
    comp = rgba[..., :3] * a + 255.0 * (1.0 - a)

    # (1) "Driver App" is BLACK and the glow-master's noise is grey/bluish;
    # everything the mark paints below the midline is strongly orange
    # (r >> b). So in the bottom band, keep only clearly-orange ink. The
    # y-gate protects the pin's black ring, which lives in the top half.
    chroma = comp.max(axis=2) - comp.min(axis=2)
    ys = np.arange(h)[:, None]
    # Hue is only meaningful where the pixel is substantially opaque — at low
    # alpha the arc's own orange AA composites to near-white and a comp-space
    # hue test would eat it. Solid non-orange ink is text/noise for sure.
    solid_not_orange = (rgba[..., 3] > 128) & ((rgba[..., 0] - rgba[..., 2]) < 50)
    black_text = (rgba[..., 3] > 0) & ((chroma < 40) | solid_not_orange) & (ys > 0.50 * h)
    rgba[black_text, 3] = 0
    removed = black_text

    # (2) "TMS Orest Express" is ORANGE — colour can't separate it from the
    # mark, but geometry can: each glyph is a small component whose entire
    # bbox sits in the bottom band. The lower swoosh arc and the R's leg
    # strokes start far higher, so a whole-bbox test cannot claim them, and
    # the area cap is belt-and-braces on top.
    ink2 = rgba[..., 3] > 16
    labels, n = ndimage.label(ink2)
    if n:
        drop = np.zeros(n + 1, dtype=bool)
        for i, sl in enumerate(ndimage.find_objects(labels), start=1):
            if sl is None:
                continue
            area = (labels[sl] == i).sum()
            if sl[0].start > 0.75 * h and area < 0.05 * total_ink:
                drop[i] = True
        rgba[drop[labels], 3] = 0
        removed = removed | drop[labels]

    # (3) Ghost cleanup. The passes above gate on alpha, so each glyph leaves
    # its anti-aliased fringe (alpha 1..16) behind — invisible at full alpha
    # but a legible ghost of the whole wordmark once contrast-stretched.
    # Dilate the removed region and clear any faint ink inside it; the mark's
    # own edges only lose fringe where they sit within 3px of removed text,
    # which nothing does.
    fringe = ndimage.binary_dilation(removed, iterations=3) & \
        (rgba[..., 3] > 0) & (rgba[..., 3] < 48)
    rgba[fringe, 3] = 0

    return _trim(Image.fromarray(rgba.astype(np.uint8), "RGBA"))


ART = _strip_wordmark(_trim(Image.open(MASTER).convert("RGBA")))


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

# --- iOS: light + dark 1024 universal slots declared in Contents.json ---------
save(compose(1024, 0.93),
     DRIVER / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")


def _recolor_achromatic(img, to):
    """Repaint low-chroma ink (the pin's black ring) without touching the orange."""
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    rgb = a[..., :3]
    grey = ((rgb.max(axis=2) - rgb.min(axis=2)) < 36) & (a[..., 3] > 16)
    a[grey, :3] = to
    return Image.fromarray(a.astype(np.uint8), "RGBA")


# Dark appearance (iOS 18): transparent background — Apple supplies the dark
# backdrop — with the black ring flipped to white so it stays visible.
save(_recolor_achromatic(compose(1024, 0.93, opaque=False), 255),
     DRIVER / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-Dark-1024.png")


def _monochrome(img):
    """Android 13+ themed icon: the mark's alpha silhouette, filled white.
    The launcher supplies the tint; only the alpha shape matters."""
    a = np.asarray(img.convert("RGBA"))
    out = np.zeros_like(a)
    out[..., :3] = 255
    out[..., 3] = a[..., 3]
    return Image.fromarray(out, "RGBA")


# --- Android: legacy launcher + round + adaptive fg + themed mono, per density -
for name, px in DENSITIES.items():
    save(compose(px, 0.93), RES / f"mipmap-{name}/ic_launcher.png")
    save(compose(px, 0.93, circle=True), RES / f"mipmap-{name}/ic_launcher_round.png")
    save(compose(px, FG_RATIO), RES / f"mipmap-{name}/ic_launcher_foreground.png")
    save(_monochrome(compose(px, FG_RATIO, opaque=False)),
         RES / f"mipmap-{name}/ic_launcher_monochrome.png")

# --- Play Store listing icon (must match the launcher icon) -------------------
save(compose(512, 0.93), DRIVER / "play-store-assets/icon-512.png")

# --- Driver portal PWA defaults (only when the TMS checkout is beside us) ------
# These are the FALLBACK files behind /settings-assets/favicons/* — a tenant
# upload overrides them, so pushing new defaults is not enough for a branded
# tenant: re-upload through store_favicon_asset as well (it also bumps the
# cache-busting revision the driver layout appends as ?rev=).
PUBLIC = DRIVER.parent / "app/orest_tms_full/tms-frontend-next/public"
if PUBLIC.is_dir():
    # 192/512 serve both purposes ("any" + "maskable") in driver-manifest.json,
    # so they use the adaptive-safe FG_RATIO framing; favicons and touch icons
    # are never masked and can run tighter. Touch icons are opaque — iOS paints
    # transparency black on the home screen.
    for px in (192, 512):
        for name in (f"driver-icon-{px}-v2.png", f"driver-icon-{px}.png"):
            save(compose(px, FG_RATIO, opaque=False), PUBLIC / name)
    for px in (16, 32, 48):
        save(compose(px, 0.93, opaque=False), PUBLIC / f"driver-favicon-{px}x{px}.png")
    save(compose(180, 0.93), PUBLIC / "driver-touch-icon-180.png")
    save(compose(180, 0.93), PUBLIC / "apple-touch-icon-driver.png")

print(f"artwork crop: {ART.size[0]}x{ART.size[1]} (aspect {ART.width / ART.height:.3f})")
print(f"{len(written)} files written")
for line in written:
    print("  " + line)
