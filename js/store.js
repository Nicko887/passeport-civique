// Sauvegarde locale de la progression (sur l'appareil de l'utilisateur, aucun serveur).
import { BOITES_DELAIS, BOITE_MAITRISE } from './config.js';

const CLE = 'passeport-civique:v1';
const JOUR = 24 * 60 * 60 * 1000;

const etatInitial = () => ({
  version: 1,
  parcours: null,
  prefs: { taille: 'normal', theme: 'auto', vitesse: 1, voix: '' },
  progress: { csp: {}, naturalisation: {}, resident: {} },
  examens: { csp: [], naturalisation: [], resident: [] },
  activite: { dernierJour: '', serie: 0 },
});

let etat = charger();
const abonnes = new Set();

function normaliser(lu) {
  const base = etatInitial();
  return {
    ...base,
    ...lu,
    prefs: { ...base.prefs, ...(lu.prefs || {}) },
    progress: { ...base.progress, ...(lu.progress || {}) },
    examens: { ...base.examens, ...(lu.examens || {}) },
    activite: { ...base.activite, ...(lu.activite || {}) },
  };
}

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? normaliser(JSON.parse(brut)) : etatInitial();
  } catch {
    return etatInitial();
  }
}

function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    /* stockage indisponible (navigation privée) : on continue en mémoire */
  }
  abonnes.forEach((f) => f(etat));
}

export const getEtat = () => etat;
export const onChange = (f) => abonnes.add(f);

export function setParcours(p) {
  etat.parcours = p;
  sauver();
}

export function setPref(cle, valeur) {
  etat.prefs[cle] = valeur;
  sauver();
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function noterActivite() {
  const j = aujourdhui();
  const a = etat.activite;
  if (a.dernierJour === j) return;
  const hier = new Date(Date.now() - JOUR).toISOString().slice(0, 10);
  a.serie = a.dernierJour === hier ? a.serie + 1 : 1;
  a.dernierJour = j;
}

/** Enregistre une réponse et fait avancer la question dans les boîtes de révision. */
export function enregistrerReponse(qid, correcte) {
  const p = etat.parcours;
  const prog = etat.progress[p];
  const s = prog[qid] || { n: 0, ok: 0, box: 0, due: 0, last: 0, err: 0 };
  s.n += 1;
  s.last = Date.now();
  if (correcte) {
    s.ok += 1;
    s.box = Math.min(s.box + 1, BOITES_DELAIS.length - 1);
  } else {
    s.err = (s.err || 0) + 1;
    s.box = 0;
  }
  s.due = Date.now() + BOITES_DELAIS[s.box] * JOUR;
  prog[qid] = s;
  noterActivite();
  sauver();
}

export function enregistrerExamen(resultat) {
  const p = etat.parcours;
  etat.examens[p].push({ ...resultat, date: Date.now() });
  etat.examens[p] = etat.examens[p].slice(-50);
  noterActivite();
  sauver();
}

export const statsQuestion = (qid) => etat.progress[etat.parcours]?.[qid];

export const estMaitrisee = (qid) => (statsQuestion(qid)?.box || 0) >= BOITE_MAITRISE;

export const estARevoir = (qid) => {
  const s = statsQuestion(qid);
  return !!s && s.due <= Date.now() && s.box < BOITES_DELAIS.length - 1;
};

export function reinitialiser(parcoursSeulement) {
  if (parcoursSeulement) {
    etat.progress[parcoursSeulement] = {};
    etat.examens[parcoursSeulement] = [];
  } else {
    const prefs = etat.prefs;
    etat = etatInitial();
    etat.prefs = prefs;
  }
  sauver();
}

export function exporter() {
  return JSON.stringify(etat, null, 2);
}

export function importer(texte) {
  const lu = JSON.parse(texte);
  if (!lu || lu.version !== 1 || !lu.progress) throw new Error('Fichier non reconnu');
  etat = normaliser(lu);
  sauver();
}
