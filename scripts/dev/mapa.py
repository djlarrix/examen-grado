"""Escribe un mapa-temas.yaml a partir de ids cortos ("acto.error" → "civil.acto.error").
Uso interno para armar mapas a mano: python3 scripts/dev/mapa.py salida.yaml encabezado < mapa.json"""
import json, sys
salida, encabezado = sys.argv[1], sys.argv[2]
m = json.load(sys.stdin)
lineas = [f"# {l}" for l in encabezado.split("\n")]
for rama in ("civil", "procesal"):
    if rama not in m: continue
    lineas.append(f"{rama}:")
    for num, ids in m[rama].items():
        vistos = []
        for i in ids:
            i = i if i.startswith(rama + ".") else f"{rama}.{i}"
            if i not in vistos: vistos.append(i)
        lineas.append(f"  {num}: [{', '.join(vistos)}]")
open(salida, "w").write("\n".join(lineas) + "\n")
print(salida, sum(len(v) for v in m.values()), "cédulas")
