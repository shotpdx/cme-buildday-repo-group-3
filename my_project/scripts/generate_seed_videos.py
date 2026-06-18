from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SEED_IMAGE_DIR = ROOT / "creative_demo_assets" / "20260531" / "seed_images"
OUTPUT_DIR = ROOT / "app" / "video_assets" / "seeds"

FPS = 18
DURATION_SECONDS = 6

VIDEO_SEEDS = [
    {
        "slug": "live_sports",
        "label": "Live Sports",
        "image": "01_live_sports_loyalists_homepage_hero.png",
        "badge": "LIVE",
        "headline": "Every live moment, one home",
        "subhead": "Sports fans stream the full slate",
        "cta": "Watch tonight",
        "accent": (15, 159, 149),
    },
    {
        "slug": "family_movie_night",
        "label": "Family Movie Night",
        "image": "02_family_co_viewing_app_tile.png",
        "badge": "WEEKEND",
        "headline": "Movie night starts here",
        "subhead": "New picks for the whole household",
        "cta": "Browse family picks",
        "accent": (199, 121, 58),
    },
    {
        "slug": "premium_originals",
        "label": "Premium Originals",
        "image": "09_premium_originals_discovery_social_square.png",
        "badge": "PREMIERE",
        "headline": "Your next original is ready",
        "subhead": "Premium series, curated for you",
        "cta": "Watch trailer",
        "accent": (91, 101, 216),
    },
    {
        "slug": "annual_upgrade",
        "label": "Annual Upgrade",
        "image": "03_premium_upgrade_newsletter_banner.png",
        "badge": "UPGRADE",
        "headline": "More to watch all year",
        "subhead": "Live sports, movies, and originals",
        "cta": "Compare plans",
        "accent": (31, 157, 114),
    },
    {
        "slug": "winback_live_events",
        "label": "Winback Live Events",
        "image": "04_sports_churn_winback_social_square.png",
        "badge": "RETURN",
        "headline": "Come back for the big event",
        "subhead": "Your live lineup is waiting",
        "cta": "Restart now",
        "accent": (37, 107, 143),
    },
]

PLACEMENTS = [
    ("ctv_15s", 1280, 720, "big screen"),
    ("youtube_15s", 1280, 720, "watch page"),
    ("social_video_15s", 720, 1280, "mobile feed"),
]


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if path and Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _cover_crop(image: Image.Image, width: int, height: int, zoom: float, pan_x: float, pan_y: float) -> Image.Image:
    src_w, src_h = image.size
    scale = max(width / src_w, height / src_h) * zoom
    resized = image.resize((math.ceil(src_w * scale), math.ceil(src_h * scale)), Image.Resampling.LANCZOS)
    max_x = max(0, resized.width - width)
    max_y = max(0, resized.height - height)
    crop_x = int(max_x * min(1, max(0, pan_x)))
    crop_y = int(max_y * min(1, max(0, pan_y)))
    return resized.crop((crop_x, crop_y, crop_x + width, crop_y + height))


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def _fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int, bold: bool) -> ImageFont.ImageFont:
    size = start_size
    while size > 20:
        font = _font(size, bold)
        if _text_width(draw, text, font) <= max_width:
            return font
        size -= 2
    return _font(size, bold)


@lru_cache(maxsize=8)
def _gradient_overlay(width: int, height: int, vertical: bool) -> Image.Image:
    yy = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    xx = np.linspace(0, 1, width, dtype=np.float32)[None, :]
    if vertical:
        top_alpha = 118 * (1 - yy)
        bottom_alpha = 172 * yy
        side_alpha = 62 * xx
        alpha = np.maximum(np.maximum(top_alpha, bottom_alpha), side_alpha)
    else:
        left_alpha = 176 * (1 - np.minimum(1, xx / 0.72))
        bottom_alpha = 130 * yy
        alpha = np.maximum(left_alpha, bottom_alpha)
    overlay = np.zeros((height, width, 4), dtype=np.uint8)
    overlay[..., 0] = 4
    overlay[..., 1] = 12
    overlay[..., 2] = 20
    overlay[..., 3] = np.clip(alpha, 0, 190).astype(np.uint8)
    return Image.fromarray(overlay, "RGBA")


def _draw_overlay(frame: Image.Image, seed: dict[str, object], placement: str, width: int, height: int, progress: float) -> Image.Image:
    accent = tuple(seed["accent"])  # type: ignore[arg-type]
    vertical = height > width
    frame = Image.alpha_composite(frame.convert("RGBA"), _gradient_overlay(width, height, vertical))
    draw = ImageDraw.Draw(frame)

    margin = int(width * (0.07 if vertical else 0.06))
    panel_w = int(width * (0.78 if vertical else 0.43))
    panel_h = int(height * (0.30 if vertical else 0.37))
    panel_x = margin
    panel_y = int(height * (0.54 if vertical else 0.18))
    if not vertical and placement == "youtube_15s":
        panel_x = int(width * 0.54)

    panel_alpha = int(188 + 22 * math.sin(progress * math.pi))
    panel_color = (8, 20, 32, panel_alpha)
    draw.rounded_rectangle((panel_x, panel_y, panel_x + panel_w, panel_y + panel_h), radius=18, fill=panel_color)
    draw.rectangle((panel_x, panel_y, panel_x + 8, panel_y + panel_h), fill=accent + (255,))

    badge_font = _font(18 if vertical else 16, True)
    badge = str(seed["badge"])
    badge_w = _text_width(draw, badge, badge_font) + 28
    draw.rounded_rectangle((panel_x + 24, panel_y + 26, panel_x + 24 + badge_w, panel_y + 58), radius=8, fill=accent + (255,))
    draw.text((panel_x + 38, panel_y + 32), badge, fill=(255, 255, 255, 255), font=badge_font)

    headline_font = _fit_font(draw, str(seed["headline"]), panel_w - 58, 38 if vertical else 34, True)
    sub_font = _fit_font(draw, str(seed["subhead"]), panel_w - 58, 24 if vertical else 19, False)
    cta_font = _font(22 if vertical else 19, True)
    draw.text((panel_x + 28, panel_y + 82), str(seed["headline"]), fill=(255, 255, 255, 255), font=headline_font)
    draw.text((panel_x + 28, panel_y + 140), str(seed["subhead"]), fill=(226, 234, 240, 235), font=sub_font)

    cta_text = str(seed["cta"])
    cta_w = _text_width(draw, cta_text, cta_font) + 44
    cta_y = panel_y + panel_h - 68
    draw.rounded_rectangle((panel_x + 28, cta_y, panel_x + 28 + cta_w, cta_y + 44), radius=10, fill=(255, 255, 255, 242))
    draw.text((panel_x + 50, cta_y + 11), cta_text, fill=(8, 20, 32, 255), font=cta_font)

    brand_font = _font(19 if vertical else 17, True)
    draw.text((margin, height - margin - 28), "CME Streaming", fill=(255, 255, 255, 232), font=brand_font)
    context = f"{seed['label']} / {placement.replace('_', ' ')}"
    context_font = _font(16 if vertical else 14, False)
    draw.text((margin, height - margin), context, fill=(214, 224, 232, 210), font=context_font)

    for i in range(4):
        dot_x = width - margin - (4 - i) * 18
        dot_y = height - margin - 8
        alpha = 255 if i <= int(progress * 4) else 108
        draw.ellipse((dot_x, dot_y, dot_x + 8, dot_y + 8), fill=accent + (alpha,))
    return frame.convert("RGB")


def render_video(seed: dict[str, object], placement: str, width: int, height: int) -> Path:
    source = Image.open(SEED_IMAGE_DIR / str(seed["image"])).convert("RGB")
    output_path = OUTPUT_DIR / f"{seed['slug']}_{placement}.mp4"
    total_frames = FPS * DURATION_SECONDS
    direction_seed = sum((index + 1) * ord(char) for index, char in enumerate(str(seed["slug"]) + placement))
    direction = 1 if (direction_seed % 2) else -1

    writer = imageio.get_writer(
        output_path,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p",
        macro_block_size=16,
        ffmpeg_params=["-movflags", "+faststart"],
    )
    try:
        for frame_index in range(total_frames):
            progress = frame_index / max(1, total_frames - 1)
            eased = 0.5 - 0.5 * math.cos(progress * math.pi)
            zoom = 1.04 + eased * 0.12
            pan_x = 0.5 + direction * (eased - 0.5) * 0.34
            pan_y = 0.44 + math.sin(progress * math.pi) * 0.18
            frame = _cover_crop(source, width, height, zoom, pan_x, pan_y)
            frame = _draw_overlay(frame, seed, placement, width, height, progress)
            writer.append_data(np.asarray(frame))
    finally:
        writer.close()
    return output_path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for seed in VIDEO_SEEDS:
        for placement, width, height, _context in PLACEMENTS:
            path = render_video(seed, placement, width, height)
            print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
