"""Assemble les fichiers de contenu (contenu/qcm/*.json) en données prêtes pour l'application (data/*.json).

Usage : python outils/construire.py
Vérifie aussi la qualité du contenu et affiche les problèmes trouvés.
"""
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
QCM = RACINE / "contenu" / "qcm"
SORTIE = RACINE / "data"

THEMES = {
    "principes": ["symboles", "valeurs", "laicite", "libertes", "egalite", "citoyennete"],
    "institutions": ["constitution", "executif", "parlement", "justice", "collectivites", "elections", "europe"],
    "droits": ["droits_fondamentaux", "devoirs", "famille", "egalite_fh", "travail", "justice_recours"],
    "histoire": ["histoire_ancienne", "revolution_empire", "histoire_contemporaine", "histoire_recente",
                 "geographie", "outre_mer", "culture"],
    "societe": ["sante", "education", "logement", "emploi_social", "demarches", "vie_quotidienne"],
}
PARCOURS = {"naturalisation": "nat", "resident": "res"}


def construire():
    problemes = []
    a_verifier = []
    for parcours, prefixe in PARCOURS.items():
        questions = []
        for theme, sous_themes in THEMES.items():
            fichier = QCM / f"{parcours}-{theme}.json"
            if not fichier.exists():
                problemes.append(f"MANQUANT : {fichier.name}")
                continue
            for item in json.loads(fichier.read_text(encoding="utf-8")):
                ref = f"{fichier.name} #{item.get('src_id')}"
                d = [x.strip() for x in item.get("distracteurs", [])]
                a = item.get("bonne_reponse", "").strip()
                if len(d) != 3 or len(set(d)) != 3 or a in d or not a:
                    problemes.append(f"{ref} : réponses invalides")
                    continue
                st = item.get("sous_theme")
                if st not in sous_themes:
                    problemes.append(f"{ref} : sous-thème inconnu « {st} », remplacé par {sous_themes[0]}")
                    st = sous_themes[0]
                if item.get("a_verifier"):
                    a_verifier.append(f"{ref} : {item.get('note', '')}")
                questions.append({
                    "id": f"{prefixe}-{item['src_id']}",
                    "t": theme,
                    "st": st,
                    "q": item["question"].strip(),
                    "a": a,
                    "d": d,
                    "e": item.get("explication", "").strip(),
                    "n": item.get("difficulte", 2),
                    **({"v": 1} if item.get("a_verifier") else {}),
                })
        ids = [q["id"] for q in questions]
        if len(ids) != len(set(ids)):
            problemes.append(f"{parcours} : identifiants en double")
        SORTIE.mkdir(exist_ok=True)
        (SORTIE / f"{parcours}.json").write_text(
            json.dumps({"parcours": parcours, "questions": questions}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"{parcours} : {len(questions)} questions")

    for p in problemes:
        print("PROBLÈME", p)
    if a_verifier:
        print(f"\n{len(a_verifier)} question(s) marquée(s) à vérifier :")
        for v in a_verifier:
            print(" -", v)
    return 1 if problemes else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(construire())
