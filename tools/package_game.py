"""Build the double-click game and the itch.io browser upload using Python 3."""
from base64 import b64encode
from functools import lru_cache
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "src"
IMPORT_PATH = re.compile(r"""(\bfrom\s+)(['"])(\./[\w.-]+\.js)\2""")


class DesignText(HTMLParser):
    """Retain the document's title and paragraphs in their original order."""

    def __init__(self):
        super().__init__()
        self.paragraphs = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag in ("h1", "p"):
            self.current = []

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag in ("h1", "p") and self.current is not None:
            self.paragraphs.append("".join(self.current).strip())
            self.current = None


def data_url(mime, content):
    return f"data:{mime};base64,{b64encode(content).decode('ascii')}"


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f"Expected one matching source reference: {old}")
    return source.replace(old, new)


@lru_cache(maxsize=None)
def bundled_module(path):
    """Use absolute data URLs so native ES modules also load from a local file."""
    source = path.read_text(encoding="utf-8")

    def embed_import(match):
        dependency = (path.parent / match[3]).resolve()
        if dependency.parent != SOURCE:
            raise ValueError(f"Module is outside src: {dependency}")
        return match[1] + json.dumps(bundled_module(dependency))

    source = IMPORT_PATH.sub(embed_import, source)
    if path.name == "render.js":
        sprites = {
            sprite.stem: data_url("image/png", sprite.read_bytes())
            for sprite in sorted((PROJECT / "assets").glob("*.png"))
        }
        source = replace_once(
            source, "new URL(`../assets/${name}.png`, import.meta.url).href",
            "embeddedSprites[name]"
        )
        source = f"const embeddedSprites = {json.dumps(sprites)};\n{source}"
    return data_url("text/javascript", source.encode("utf-8"))


def build():
    html = (PROJECT / "index.html").read_text(encoding="utf-8")
    css = (PROJECT / "style.css").read_text(encoding="utf-8")
    html = replace_once(html, '<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>")
    entry = bundled_module(SOURCE / "app.js")
    html = replace_once(html, '<script type="module" src="src/app.js"></script>',
                        f'<script type="module" src="{entry}"></script>')

    play = PROJECT / "Play.html"
    play.write_text(html, encoding="utf-8")
    design = PROJECT / "design" / "Game Design.html"
    plain = design.with_suffix(".txt")
    parser = DesignText()
    parser.feed(design.read_text(encoding="utf-8"))
    parser.close()
    if len(parser.paragraphs) < 2:
        raise ValueError("Could not read the design title and paragraphs")
    plain.write_text("\n\n".join(parser.paragraphs) + "\n", encoding="utf-8")

    archive = PROJECT / "builds" / "Back-on-the-Block-web.zip"
    archive.parent.mkdir(exist_ok=True)
    files = {"index.html": play, "READ ME.txt": PROJECT / "READ ME.txt",
             "LICENSE": PROJECT / "LICENSE", "assets/LICENSE.txt": PROJECT / "assets/LICENSE.txt",
             "assets/PROVENANCE.txt": PROJECT / "assets/PROVENANCE.txt",
             "design/Game Design.html": design, "design/Game Design.txt": plain}
    with ZipFile(archive, "w") as package:
        for name, file in sorted(files.items()):
            info = ZipInfo(name)
            info.external_attr = 0o100644 << 16
            package.writestr(info, file.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(archive) as package:
        if package.testzip() or set(package.namelist()) != set(files):
            raise ValueError("Browser package failed verification")
    print(f"Created {play.name}, {plain.relative_to(PROJECT)} and {archive.name} ({archive.stat().st_size:,} bytes).")


if __name__ == "__main__":
    build()
