#!/usr/bin/env python3
"""Regenera js/recursos.js: fuentes Inter y logo en base64 (para los PDF) y la prueba de ejemplo.

Ejecútalo desde la carpeta del proyecto si cambias una fuente, el logo o el ejemplo:
    python herramientas/generar_recursos.py
"""
import base64
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def b64(ruta):
    return base64.b64encode((RAIZ / ruta).read_bytes()).decode()


def main():
    recursos = {
        "assets": {
            "fonts": {p: b64(f"assets/fonts/Inter-{p}.ttf") for p in ("Regular", "Medium", "SemiBold", "Bold")},
            "logoBlanco": "data:image/png;base64," + b64("assets/logos/center_white.png"),
            "logoRatio": 3592 / 492,
        },
        "ejemplo": json.loads((RAIZ / "herramientas/ejemplo.json").read_text(encoding="utf-8")),
    }
    salida = RAIZ / "js/recursos.js"
    salida.write_text("// Archivo generado por herramientas/generar_recursos.py. No editar a mano.\n"
                      "window.VO2_RECURSOS = " + json.dumps(recursos, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Listo: {salida.relative_to(RAIZ)} ({salida.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
