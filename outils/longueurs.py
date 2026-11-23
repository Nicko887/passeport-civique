"""Liste les questions où la longueur de la bonne réponse peut servir d'indice.

Usage : python outils/longueurs.py contenu/qcm/<fichier>.json [...]
Pour chaque fichier : part des questions où la bonne réponse est la plus longue et la plus courte
(objectif : environ 25 % chacune), puis la liste des questions où elle est la plus longue,
de l'écart le plus grand au plus petit (ce sont celles à retoucher en priorité).
"""
import json
import sys
from pathlib import Path


def analyser(fichier):
    questions = json.loads(Path(fichier).read_text(encoding="utf-8"))
    longues, courtes = [], 0
    for q in questions:
        a = len(q["bonne_reponse"])
        d = [len(x) for x in q["distracteurs"]]
        if a > max(d):
            longues.append((a - max(d), q))
        if a < min(d):
            courtes += 1
    n = len(questions)
    print(f"\n{Path(fichier).name} : {n} questions · plus longue {round(100 * len(longues) / n)} % "
          f"({len(longues)}) · plus courte {round(100 * courtes / n)} % ({courtes})")
    print(f"Pour atteindre 25 %, il faut en retoucher au moins {max(0, len(longues) - n // 4)}.")
    for ecart, q in sorted(longues, key=lambda x: -x[0]):
        print(f"  #{q['src_id']} (+{ecart} car.) {q['bonne_reponse']!r}")
        for x in q["distracteurs"]:
            print(f"      - ({len(x)}) {x!r}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for f in sys.argv[1:]:
        analyser(f)
