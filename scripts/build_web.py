#!/usr/bin/env python3
"""Construye la versión web autocontenida para itch.io.

Copia web/ a dist/itchio/, incrusta el cartucho original como módulo
JavaScript (js/cart_data.js) y crea dist/dante-en-las-estrellas-web.zip con
index.html en la raíz. El .p8 solo se lee, nunca se modifica.

Uso:
    python3 scripts/build_web.py            # construir y empaquetar
    python3 scripts/build_web.py --serve    # además servir en :8000
"""
import argparse
import hashlib
import http.server
import json
import functools
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CART = ROOT / "dante_estrellas_final.p8"
WEB = ROOT / "web"
DIST = ROOT / "dist" / "itchio"
ZIP = ROOT / "dist" / "dante-en-las-estrellas-web.zip"
SHIPPED = (".html", ".css", ".js")
REQUIRED_SECTIONS = ("__lua__", "__gfx__", "__gff__", "__map__", "__sfx__", "__music__")
# Huella del código __lua__ traducido a mano en web/js/game.js. Gráficos,
# mapa y sonido se leen del cartucho en cada build, pero si cambia el Lua
# hay que actualizar game.js y después esta huella.
LUA_SHA256 = "f30bc777bc42dd3dec7979f48ddd48e949899f0a916c6ce566103b59f2e9f1b1"


def lua_section(text):
    return text.split("__lua__\n", 1)[1].split("\n__gfx__", 1)[0]


def build():
    raw = CART.read_bytes()
    text = raw.decode("utf-8")
    missing = [s for s in REQUIRED_SECTIONS if s not in text]
    if missing:
        sys.exit(f"cartucho incompleto, faltan: {', '.join(missing)}")
    digest = hashlib.sha256(raw).hexdigest()
    lua_digest = hashlib.sha256(lua_section(text).encode("utf-8")).hexdigest()
    if lua_digest != LUA_SHA256:
        sys.exit(
            "el código __lua__ del cartucho cambió respecto a la traducción de web/js/game.js\n"
            f"  esperado {LUA_SHA256}\n  actual   {lua_digest}\n"
            "actualiza game.js y LUA_SHA256 en scripts/build_web.py"
        )

    if DIST.exists():
        shutil.rmtree(DIST)
    for src in WEB.rglob("*"):
        if src.is_file() and src.suffix in SHIPPED and src.name != "cart_data.js":
            dst = DIST / src.relative_to(WEB)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    (DIST / "js" / "cart_data.js").write_text(
        "// Generado por scripts/build_web.py a partir de dante_estrellas_final.p8\n"
        f"// sha256 {digest}\n"
        f"export default {json.dumps(text)};\n",
        encoding="utf-8",
    )

    # Autocontenido: ningún recurso remoto en lo que se publica.
    remote = re.compile(r"""(src|href)\s*=\s*["']?(https?:)?//|url\(\s*["']?(https?:)?//|import\s.*["'](https?:)?//""")
    for f in DIST.rglob("*"):
        if f.is_file() and f.name != "cart_data.js" and remote.search(f.read_text(encoding="utf-8")):
            sys.exit(f"recurso remoto encontrado en {f.relative_to(ROOT)}")

    ZIP.unlink(missing_ok=True)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(DIST.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(DIST).as_posix())

    files = sorted(p.relative_to(DIST).as_posix() for p in DIST.rglob("*") if p.is_file())
    print(f"cartucho sha256 {digest}")
    print(f"{len(files)} archivos en {DIST.relative_to(ROOT)}: {', '.join(files)}")
    print(f"zip: {ZIP.relative_to(ROOT)} ({ZIP.stat().st_size} bytes)")


def serve(port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
    print(f"sirviendo http://localhost:{port}/ (Ctrl+C para salir)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--serve", action="store_true", help="servir dist/itchio tras construir")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    build()
    if args.serve:
        serve(args.port)
