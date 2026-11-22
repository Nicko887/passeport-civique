// Chargement des questions et des cours, et calculs de progression.
import { THEMES, EXAMEN, BOITE_MAITRISE } from './config.js';
import { statsQuestion, estARevoir } from './store.js';

const cacheQuestions = {};
const cacheCours = {};

export async function chargerQuestions(parcours) {
  if (!cacheQuestions[parcours]) {
    const rep = await fetch(`data/${parcours}.json`);
    if (!rep.ok) throw new Error('Questions introuvables');
    cacheQuestions[parcours] = (await rep.json()).questions;
  }
  return cacheQuestions[parcours];
}

export async function chargerCours(themeId) {
  if (!cacheCours[themeId]) {
    const rep = await fetch(`contenu/cours/${themeId}.md`);
    cacheCours[themeId] = rep.ok ? await rep.text() : null;
  }
  return cacheCours[themeId];
}

export function melanger(tab) {
  const a = [...tab];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Prépare une question pour l'affichage : options mélangées. */
export function preparer(q) {
  const options = melanger([q.a, ...q.d]);
  return { ...q, options, bonne: options.indexOf(q.a) };
}

/**
 * Choix intelligent pour l'entraînement : d'abord les questions à revoir,
 * puis celles jamais vues, puis les moins bien maîtrisées.
 */
export function choisirSerie(questions, n) {
  const score = (q) => {
    const s = statsQuestion(q.id);
    if (!s) return 1 + Math.random(); // jamais vue
    if (estARevoir(q.id)) return 2 + (BOITE_MAITRISE - s.box) + Math.random();
    return Math.max(0, 1 - s.box / 5) * Math.random();
  };
  return questions
    .map((q) => ({ q, s: score(q) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, n)
    .map((x) => x.q);
}

/**
 * Tire n questions d'un thème, dont nSit mises en situation.
 * S'il manque des questions d'un type, on complète avec l'autre.
 */
function tirerTheme(questions, theme, n, nSit) {
  const duTheme = questions.filter((q) => q.t === theme);
  const sit = melanger(duTheme.filter((q) => q.s)).slice(0, nSit);
  const connaissances = melanger(duTheme.filter((q) => !q.s)).slice(0, n - sit.length);
  const choix = [...connaissances, ...sit];
  if (choix.length < n) {
    const reste = melanger(duTheme.filter((q) => !choix.includes(q)));
    choix.push(...reste.slice(0, n - choix.length));
  }
  return choix; // connaissances d'abord, puis mises en situation
}

export function tirerExamen(questions) {
  const choix = [];
  for (const [theme, n] of Object.entries(EXAMEN.repartition)) {
    choix.push(...tirerTheme(questions, theme, n, EXAMEN.situations[theme] || 0));
  }
  return choix; // regroupées par thème, comme à l'examen
}

/** Examen d'un seul module : même proportion de mises en situation que l'examen complet. */
export function tirerModule(questions, theme, n) {
  const total = EXAMEN.repartition[theme] || 1;
  const nSit = Math.round((n * (EXAMEN.situations[theme] || 0)) / total);
  return melanger(tirerTheme(questions, theme, n, nSit));
}

/** Statistiques d'un ensemble de questions. */
export function bilan(questions) {
  let vues = 0, maitrisees = 0, bonnes = 0, reponses = 0, aRevoir = 0, points = 0;
  for (const q of questions) {
    const s = statsQuestion(q.id);
    if (!s) continue;
    vues++;
    points += Math.min(s.box, BOITE_MAITRISE);
    reponses += s.n;
    bonnes += s.ok;
    if (s.box >= BOITE_MAITRISE) maitrisees++;
    if (estARevoir(q.id)) aRevoir++;
  }
  return {
    total: questions.length,
    vues,
    maitrisees,
    aRevoir,
    reussite: reponses ? bonnes / reponses : null,
    maitrise: questions.length ? maitrisees / questions.length : 0,
    // Progression graduelle : chaque bonne réponse espacée rapproche de la maîtrise.
    progression: questions.length ? points / (BOITE_MAITRISE * questions.length) : 0,
  };
}

/** Liste de tous les sous-thèmes avec leur bilan, du plus faible au plus fort. */
export function pointsFaibles(questions) {
  const res = [];
  for (const t of THEMES) {
    for (const [stId, titre] of Object.entries(t.sousThemes)) {
      const qs = questions.filter((q) => q.t === t.id && q.st === stId);
      if (!qs.length) continue;
      const b = bilan(qs);
      res.push({ theme: t, stId, titre, questions: qs, ...b });
    }
  }
  const evalues = res.filter((r) => r.vues > 0 && r.reussite !== null);
  evalues.sort((a, b) => a.reussite - b.reussite || a.maitrise - b.maitrise);
  return {
    evalues,
    faibles: evalues.filter((r) => r.reussite < 0.8 || r.aRevoir > 0),
    nonCommences: res.filter((r) => r.vues === 0),
  };
}
