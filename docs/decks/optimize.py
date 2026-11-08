# docs/decks/optimize.py
"""Gera as artes WebP do jogo a partir dos originais preservados (Python + Pillow)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ORIGINALS = ROOT / "docs" / "decks"
PUBLIC = ROOT / "src" / "client" / "public" / "cards"


def optimize():
    total_original = total_webp = 0
    for folder in ("control", "shared"):
        for source in sorted((ORIGINALS / folder).glob("*.png")):
            target = PUBLIC / (source.stem + ".webp")
            with Image.open(source) as image:
                image.convert("RGB").save(target, "WEBP", quality=86, method=6)
            total_original += source.stat().st_size
            total_webp += target.stat().st_size
            print(f"{source.name}: {source.stat().st_size} -> {target.stat().st_size} bytes")
    print(f"Total: {total_original} -> {total_webp} bytes ({1-total_webp/total_original:.1%} menor)")


if __name__ == "__main__":
    optimize()
