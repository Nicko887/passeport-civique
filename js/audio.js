// Lecture audio des cours par la synthèse vocale du navigateur (gratuite, hors ligne sur la plupart des appareils).
import { getEtat } from './store.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
export const audioDisponible = !!synth;

let playlist = [];
let index = 0;
let morceaux = [];
let morceau = 0;
let statut = 'arret'; // 'arret' | 'lecture' | 'pause'
let surMaj = () => {};
let jeton = 0;

export function voixFrancaises() {
  if (!synth) return [];
  return synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('fr'));
}

function choisirVoix() {
  const voulue = getEtat().prefs.voix;
  const fr = voixFrancaises();
  return fr.find((v) => v.name === voulue) || fr.find((v) => /fr-FR/i.test(v.lang) && /google|natural|online|amélie|thomas|audrey|denise|henri/i.test(v.name)) || fr.find((v) => /fr-FR/i.test(v.lang)) || fr[0] || null;
}

// Les navigateurs coupent les textes trop longs : on lit phrase par phrase.
function decouper(texte) {
  const phrases = texte.replace(/\s+/g, ' ').match(/[^.!?:;]+[.!?:;]*|.+$/g) || [];
  const res = [];
  let tampon = '';
  for (const p of phrases) {
    if ((tampon + p).length > 220 && tampon) { res.push(tampon.trim()); tampon = ''; }
    tampon += p;
  }
  if (tampon.trim()) res.push(tampon.trim());
  return res;
}

function lireMorceau() {
  if (!synth) return;
  const monJeton = ++jeton;
  if (morceau >= morceaux.length) {
    if (index < playlist.length - 1) { index++; preparerPiste(); return lireMorceau(); }
    statut = 'arret';
    surMaj(etatAudio());
    return;
  }
  const u = new SpeechSynthesisUtterance(morceaux[morceau]);
  u.lang = 'fr-FR';
  const v = choisirVoix();
  if (v) u.voice = v;
  u.rate = getEtat().prefs.vitesse || 1;
  u.onend = () => {
    if (monJeton !== jeton || statut !== 'lecture') return;
    morceau++;
    lireMorceau();
  };
  u.onerror = (e) => {
    if (monJeton !== jeton) return;
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    morceau++;
    lireMorceau();
  };
  synth.speak(u);
  statut = 'lecture';
  surMaj(etatAudio());
}

function preparerPiste() {
  const p = playlist[index];
  morceaux = decouper(p.titre ? `${p.titre}. ${p.texte}` : p.texte);
  morceau = 0;
}

export function etatAudio() {
  return {
    statut,
    index,
    total: playlist.length,
    piste: playlist[index] || null,
    progression: morceaux.length ? morceau / morceaux.length : 0,
  };
}

export function ecouter(liste, depart = 0, callback) {
  if (!synth) return;
  arreter();
  playlist = liste;
  index = depart;
  if (callback) surMaj = callback;
  preparerPiste();
  lireMorceau();
}

export function pauseReprise() {
  if (!synth) return;
  if (statut === 'lecture') {
    jeton++;
    synth.cancel();
    statut = 'pause';
  } else if (statut === 'pause') {
    lireMorceau();
    return;
  }
  surMaj(etatAudio());
}

export function suivant() {
  if (index < playlist.length - 1) { jeton++; synth.cancel(); index++; preparerPiste(); lireMorceau(); }
}

export function precedent() {
  if (morceau > 1 || index === 0) { jeton++; synth.cancel(); morceau = 0; lireMorceau(); return; }
  jeton++; synth.cancel(); index--; preparerPiste(); lireMorceau();
}

export function arreter() {
  if (!synth) return;
  jeton++;
  synth.cancel();
  statut = 'arret';
  surMaj(etatAudio());
}

export function lireTexte(texte) {
  ecouter([{ titre: '', texte }], 0);
}

if (synth) synth.onvoiceschanged = () => {};
