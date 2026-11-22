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


def lire_fichier(fichier, theme, sous_themes, prefixe, situation, problemes, a_verifier, longueurs):
    """Lit un fichier de questions et renvoie les questions au format de l'application."""
    questions = []
    plus_longue = 0
    for item in json.loads(fichier.read_text(encoding="utf-8")):
        ref = f"{fichier.name} #{item.get('src_id')}"
        d = [x.strip() for x in item.get("distracteurs", [])]
        a = item.get("bonne_reponse", "").strip()
        if len(d) != 3 or len(set(d)) != 3 or a in d or not a:
            problemes.append(f"{ref} : réponses invalides")
            continue
        if situation and not item.get("explication", "").strip():
            problemes.append(f"{ref} : une mise en situation doit avoir une explication")
        st = item.get("sous_theme")
        if st not in sous_themes:
            problemes.append(f"{ref} : sous-thème inconnu « {st} », remplacé par {sous_themes[0]}")
            st = sous_themes[0]
        if item.get("a_verifier"):
            a_verifier.append(f"{ref} : {item.get('note', '')}")
        if len(a) > max(len(x) for x in d):
            plus_longue += 1
        questions.append({
            "id": f"{prefixe}-{item['src_id']}",
            "t": theme,
            "st": st,
            "q": item["question"].strip(),
            "a": a,
            "d": d,
            "e": item.get("explication", "").strip(),
            "n": item.get("difficulte", 2),
            **({"s": 1} if situation else {}),
            **({"v": 1} if item.get("a_verifier") else {}),
        })
    if questions:
        longueurs[fichier.name] = plus_longue / len(questions)
    return questions


def construire():
    problemes = []
    a_verifier = []
    longueurs = {}
    for parcours, prefixe in PARCOURS.items():
        questions = []
        for theme, sous_themes in THEMES.items():
            fichier = QCM / f"{parcours}-{theme}.json"
            if not fichier.exists():
                problemes.append(f"MANQUANT : {fichier.name}")
                continue
            questions += lire_fichier(fichier, theme, sous_themes, prefixe, False,
                                      problemes, a_verifier, longueurs)
            # Mises en situation : communes aux deux parcours (même répartition pour toutes les mentions).
            situations = QCM / f"situations-{theme}.json"
            if situations.exists():
                questions += lire_fichier(situations, theme, sous_themes, "sit", True,
                                          problemes if parcours == "naturalisation" else [],
                                          a_verifier if parcours == "naturalisation" else [],
                                          longueurs)
        ids = [q["id"] for q in questions]
        if len(ids) != len(set(ids)):
            problemes.append(f"{parcours} : identifiants en double")
        SORTIE.mkdir(exist_ok=True)
        (SORTIE / f"{parcours}.json").write_text(
            json.dumps({"parcours": parcours, "questions": questions}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        nb_sit = sum(1 for q in questions if q.get("s"))
        print(f"{parcours} : {len(questions)} questions, dont {nb_sit} mises en situation")

    print("\nPart des questions où la bonne réponse est la plus longue (objectif : 25 % ou moins) :")
    for nom, part in sorted(longueurs.items()):
        print(f" - {nom} : {round(part * 100)} %")

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
