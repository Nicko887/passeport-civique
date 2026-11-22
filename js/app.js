// Application principale : navigation et écrans.
import { APP_NAME, PARCOURS, THEMES, themeById, EXAMEN, EXAMEN_MODULE, SERIE_ENTRAINEMENT, NB_SITUATIONS } from './config.js';
import * as store from './store.js';
import { chargerQuestions, chargerCours, preparer, choisirSerie, tirerExamen, tirerModule, bilan, pointsFaibles, melanger } from './data.js';
import { lireCours, echapper } from './markdown.js';
import * as audio from './audio.js';

const $app = document.getElementById('app');
const e = echapper;
let session = null; // QCM ou examen en cours
let minuterie = null;

// ---------- Utilitaires d'affichage ----------

const pct = (x) => `${Math.round((x || 0) * 100)} %`;

function barre(valeur, libelle = '') {
  const v = Math.round((valeur || 0) * 100);
  return `<div class="barre" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" aria-label="${e(libelle)}"><span style="width:${v}%"></span></div>`;
}

function anneau(valeur, taille = 120, texte) {
  const r = 52, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, valeur || 0));
  return `<svg class="anneau" width="${taille}" height="${taille}" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" class="anneau-fond"/>
    <circle cx="60" cy="60" r="${r}" class="anneau-val" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}"/>
    <text x="60" y="60" class="anneau-txt">${texte ?? Math.round(v * 100) + '%'}</text></svg>`;
}

function entete(titre, retour = '#/') {
  return `<header class="entete-page"><a class="retour" href="${retour}" aria-label="Retour">←</a><h1>${titre}</h1></header>`;
}

function afficher(html, actif = '') {
  $app.innerHTML = html;
  document.querySelectorAll('.nav-bas a').forEach((a) => a.classList.toggle('actif', a.dataset.nav === actif));
  document.body.classList.toggle('sans-nav', actif === 'aucun');
  window.scrollTo(0, 0);
  const h1 = $app.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

const parcoursCourant = () => store.getEtat().parcours;
const questions = () => chargerQuestions(parcoursCourant());

// ---------- Écrans ----------

function vueBienvenue() {
  afficher(`
    <section class="bienvenue">
      <div class="logo-grand" aria-hidden="true">✓</div>
      <h1>${APP_NAME}</h1>
      <p class="accroche">Préparez l’examen civique gratuitement, à votre rythme, sans inscription.</p>
      <h2>Quel examen préparez-vous ?</h2>
      <div class="choix-parcours">
        ${Object.values(PARCOURS).map((p) => `
          <button class="carte-choix" data-action="choisir-parcours" data-p="${p.id}">
            <span class="emoji" aria-hidden="true">${p.icone}</span>
            <strong>${p.titre}</strong><small>${p.sousTitre}</small>
          </button>`).join('')}
      </div>
      <p class="petit">Vous pourrez changer à tout moment dans les réglages.</p>
      <p class="petit avertissement">Outil indépendant et gratuit, non officiel : il n’est pas édité par l’État. <a href="#/a-propos">En savoir plus</a></p>
    </section>`, 'aucun');
}

async function vueAccueil() {
  const qs = await questions();
  const b = bilan(qs);
  const pf = pointsFaibles(qs);
  const p = PARCOURS[parcoursCourant()];
  const examens = store.getEtat().examens[p.id];
  const dernier = examens[examens.length - 1];
  const serie = store.getEtat().activite.serie;

  afficher(`
    <section class="accueil">
      <div class="bandeau">
        <div>
          <p class="sur-titre">${p.icone} ${p.titre}</p>
          <h1>Bonjour 👋</h1>
          <p>${b.vues === 0 ? 'Commencez par un cours ou une première série de questions.' : `Vous maîtrisez <strong>${b.maitrisees}</strong> questions sur ${b.total}.`}</p>
          ${serie > 1 ? `<p class="serie">🔥 ${serie} jours d’affilée</p>` : ''}
        </div>
        ${anneau(b.progression, 110)}
      </div>

      ${b.aRevoir > 0 ? `
      <a class="action-principale" href="#/revision">
        <span class="emoji" aria-hidden="true">🔁</span>
        <span><strong>Mes révisions du jour</strong><small>${b.aRevoir} question${b.aRevoir > 1 ? 's' : ''} à revoir</small></span><span aria-hidden="true">→</span>
      </a>` : `
      <a class="action-principale" href="#/entrainement/tout">
        <span class="emoji" aria-hidden="true">▶️</span>
        <span><strong>${b.vues === 0 ? 'Commencer' : 'Continuer'} l’entraînement</strong><small>Série de ${SERIE_ENTRAINEMENT} questions adaptées à votre niveau</small></span><span aria-hidden="true">→</span>
      </a>`}

      <div class="grille-tuiles">
        <a class="tuile" href="#/cours"><span class="emoji" aria-hidden="true">📘</span><strong>Cours</strong><small>5 thèmes à lire ou écouter</small></a>
        <a class="tuile" href="#/entrainement"><span class="emoji" aria-hidden="true">✏️</span><strong>S’entraîner</strong><small>QCM avec corrections</small></a>
        <a class="tuile" href="#/examen"><span class="emoji" aria-hidden="true">⏱️</span><strong>Examen blanc</strong><small>${EXAMEN.nbQuestions} questions, ${EXAMEN.dureeMinutes} min</small></a>
        <a class="tuile" href="#/progres"><span class="emoji" aria-hidden="true">🎯</span><strong>Points faibles</strong><small>${pf.faibles.length ? pf.faibles.length + ' partie' + (pf.faibles.length > 1 ? 's' : '') + ' à travailler' : 'Votre suivi personnalisé'}</small></a>
        <a class="tuile" href="#/ecouter"><span class="emoji" aria-hidden="true">🎧</span><strong>Écouter</strong><small>Les cours en audio</small></a>
        <a class="tuile" href="#/reglages"><span class="emoji" aria-hidden="true">⚙️</span><strong>Réglages</strong><small>Texte, voix, sauvegarde</small></a>
      </div>

      ${dernier ? `
      <div class="carte">
        <h2>Dernier examen blanc</h2>
        <p class="resultat-ligne ${dernier.reussi ? 'ok' : 'ko'}">${dernier.reussi ? '✅ Réussi' : '❌ Pas encore'} : <strong>${dernier.score}/${dernier.total}</strong> ${dernier.type === 'complet' ? '' : '(module ' + e(themeById(dernier.type)?.court || '') + ')'}</p>
      </div>` : ''}

      <h2 class="titre-section">Vos thèmes</h2>
      <div class="liste-themes">
        ${THEMES.map((t) => {
          const bt = bilan(qs.filter((q) => q.t === t.id));
          return `<a class="ligne-theme" href="#/theme/${t.id}" style="--c:${t.couleur}">
            <span class="emoji" aria-hidden="true">${t.icone}</span>
            <span class="lt-texte"><strong>${t.court}</strong>${barre(bt.progression, t.court)}<small>${bt.maitrisees}/${bt.total} maîtrisées</small></span>
            <span aria-hidden="true">›</span></a>`;
        }).join('')}
      </div>
    </section>`, 'accueil');
}

async function vueTheme(themeId) {
  const t = themeById(themeId);
  if (!t) return naviguer('#/');
  const qs = (await questions()).filter((q) => q.t === t.id);
  const b = bilan(qs);
  const nbSit = qs.filter((q) => q.s).length;
  afficher(`
    ${entete(t.icone + ' ' + t.court)}
    <section style="--c:${t.couleur}">
      <div class="bandeau bandeau-theme">
        <div><p class="sur-titre">Thème</p><h2>${t.titre}</h2><p>${b.total} questions · ${b.maitrisees} maîtrisées</p></div>
        ${anneau(b.progression, 96)}
      </div>
      <div class="pile-boutons">
        <a class="bouton" href="#/cours/${t.id}">📘 Lire le cours</a>
        <a class="bouton" href="#/entrainement/${t.id}">✏️ S’entraîner sur ce thème</a>
        ${nbSit ? `<a class="bouton" href="#/entrainement/situations/${t.id}">🧭 Mises en situation (${nbSit})</a>` : ''}
        <a class="bouton secondaire" href="#/examen/${t.id}">⏱️ Examen du module</a>
      </div>
      <h2 class="titre-section">Parties du thème</h2>
      <div class="liste-themes">
        ${Object.entries(t.sousThemes).map(([id, titre]) => {
          const bs = bilan(qs.filter((q) => q.st === id));
          if (!bs.total) return '';
          return `<a class="ligne-theme" href="#/revision/${t.id}/${id}">
            <span class="lt-texte"><strong>${titre}</strong>${barre(bs.progression, titre)}
            <small>${bs.total} questions${bs.reussite !== null ? ' · ' + pct(bs.reussite) + ' de bonnes réponses' : ''}</small></span><span aria-hidden="true">›</span></a>`;
        }).join('')}
      </div>
    </section>`, 'accueil');
}

// ----- Cours -----

async function vueListeCours() {
  const qs = await questions();
  afficher(`
    ${entete('Cours')}
    <p class="intro-page">Chaque cours correspond à un thème de l’examen. Vous pouvez le lire ou l’écouter.</p>
    <div class="liste-themes">
      ${THEMES.map((t) => {
        const bt = bilan(qs.filter((q) => q.t === t.id));
        return `<a class="ligne-theme" href="#/cours/${t.id}" style="--c:${t.couleur}">
          <span class="emoji" aria-hidden="true">${t.icone}</span>
          <span class="lt-texte"><strong>${t.titre}</strong>${barre(bt.progression, t.court)}<small>${Object.keys(t.sousThemes).length} parties</small></span>
          <span aria-hidden="true">›</span></a>`;
      }).join('')}
    </div>`, 'cours');
}

async function vueCours(themeId, sectionId) {
  const t = themeById(themeId);
  if (!t) return naviguer('#/cours');
  const md = await chargerCours(themeId);
  if (!md) {
    afficher(`${entete(t.court, '#/cours')}<div class="carte"><p>Ce cours est en cours de rédaction. Revenez bientôt !</p></div>`, 'cours');
    return;
  }
  const c = lireCours(md);
  const pistes = c.sections.filter((s) => s.id !== 'sources').map((s) => ({ titre: s.titre, texte: s.texte, id: s.id }));
  afficher(`
    ${entete(t.icone + ' ' + t.court, '#/cours')}
    <article class="cours" style="--c:${t.couleur}">
      <h2 class="titre-cours">${e(c.titre || t.titre)}</h2>
      ${c.intro.html}
      ${audio.audioDisponible ? `<button class="bouton" data-action="ecouter-cours" data-theme="${t.id}">🎧 Écouter tout le cours</button>` : ''}
      <nav class="sommaire" aria-label="Sommaire">
        ${c.sections.map((s) => `<a href="#/cours/${t.id}/${s.id}">${e(s.titre)}</a>`).join('')}
      </nav>
      ${c.sections.map((s, i) => `
        <section class="section-cours" id="sec-${s.id}">
          <h2>${e(s.titre)}</h2>
          ${s.html}
          ${s.id !== 'sources' ? `<div class="actions-section">
            ${audio.audioDisponible ? `<button class="bouton petit secondaire" data-action="ecouter-cours" data-theme="${t.id}" data-index="${pistes.findIndex((p) => p.id === s.id)}">🎧 Écouter</button>` : ''}
            <a class="bouton petit" href="#/revision/${t.id}/${s.id}">✏️ S’entraîner sur cette partie</a>
          </div>` : ''}
        </section>`).join('')}
    </article>`, 'cours');
  if (sectionId) document.getElementById('sec-' + sectionId)?.scrollIntoView({ block: 'start' });
}

// ----- Écoute (podcast) -----

async function pistesTheme(themeId) {
  const md = await chargerCours(themeId);
  if (!md) return [];
  const t = themeById(themeId);
  return lireCours(md).sections.filter((s) => s.id !== 'sources').map((s) => ({ titre: s.titre, texte: s.texte, theme: t.court, themeId }));
}

async function vueEcouter() {
  if (!audio.audioDisponible) {
    afficher(`${entete('Écouter')}<div class="carte"><p>Votre navigateur ne permet pas la lecture audio. Essayez avec Chrome, Edge ou Safari.</p></div>`, 'ecouter');
    return;
  }
  const blocs = [];
  for (const t of THEMES) blocs.push({ t, pistes: await pistesTheme(t.id) });
  afficher(`
    ${entete('Écouter les cours')}
    <p class="intro-page">Écoutez les cours comme un podcast : dans les transports, en cuisinant… Choisissez un thème ou une partie.</p>
    <div id="lecteur"></div>
    ${blocs.map(({ t, pistes }) => `
      <div class="carte bloc-ecoute" style="--c:${t.couleur}">
        <div class="bloc-ecoute-tete"><h2>${t.icone} ${t.court}</h2>
          ${pistes.length ? `<button class="bouton petit" data-action="ecouter-cours" data-theme="${t.id}">▶ Tout écouter</button>` : '<small>Bientôt disponible</small>'}</div>
        <ol class="pistes">${pistes.map((p, i) => `<li><button class="piste" data-action="ecouter-cours" data-theme="${t.id}" data-index="${i}">▶ ${e(p.titre)}</button></li>`).join('')}</ol>
      </div>`).join('')}`, 'ecouter');
  majLecteur(audio.etatAudio());
}

function majLecteur(s) {
  let el = document.getElementById('lecteur-flottant');
  if (s.statut === 'arret' && !s.piste) { el?.remove(); return; }
  if (s.statut === 'arret') { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'lecteur-flottant';
    el.className = 'lecteur';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="lecteur-info"><small>${e(s.piste?.theme || 'Lecture')}</small><strong>${e(s.piste?.titre || '')}</strong>${barre(s.progression, 'Avancement')}</div>
    <div class="lecteur-boutons">
      <button data-action="audio-prec" aria-label="Précédent">⏮</button>
      <button data-action="audio-pause" class="lecteur-play" aria-label="${s.statut === 'lecture' ? 'Pause' : 'Lecture'}">${s.statut === 'lecture' ? '⏸' : '▶'}</button>
      <button data-action="audio-suiv" aria-label="Suivant">⏭</button>
      <button data-action="audio-stop" aria-label="Arrêter">✕</button>
    </div>`;
}

// Écouter un thème : on enchaîne ses parties à partir de celle choisie.
async function lancerEcoute(themeId, index) {
  const pistes = await pistesTheme(themeId);
  if (pistes.length) audio.ecouter(pistes, Math.max(0, Number(index) || 0), majLecteur);
}

// ----- Entraînement -----

async function vueChoixEntrainement() {
  const qs = await questions();
  const sit = qs.filter((q) => q.s);
  afficher(`
    ${entete('S’entraîner')}
    <p class="intro-page">Répondez aux questions et découvrez tout de suite la correction. Les questions que vous ratez reviendront plus tard pour être bien retenues.</p>
    <a class="action-principale" href="#/entrainement/tout"><span class="emoji" aria-hidden="true">🎲</span><span><strong>Tous les thèmes</strong><small>${SERIE_ENTRAINEMENT} questions choisies pour vous</small></span><span aria-hidden="true">→</span></a>
    ${sit.length ? `<a class="action-principale secondaire" href="#/entrainement/situations"><span class="emoji" aria-hidden="true">🧭</span><span><strong>Mises en situation</strong><small>Des cas concrets de la vie quotidienne · ${NB_SITUATIONS} questions sur ${EXAMEN.nbQuestions} à l’examen</small></span><span aria-hidden="true">→</span></a>` : ''}
    <div class="liste-themes">
      ${THEMES.map((t) => {
        const bt = bilan(qs.filter((q) => q.t === t.id));
        return `<a class="ligne-theme" href="#/entrainement/${t.id}" style="--c:${t.couleur}">
          <span class="emoji" aria-hidden="true">${t.icone}</span>
          <span class="lt-texte"><strong>${t.court}</strong>${barre(bt.progression, t.court)}<small>${bt.total} questions · ${bt.vues} déjà vues</small></span>
          <span aria-hidden="true">›</span></a>`;
      }).join('')}
    </div>`, 'entrainement');
}

async function demarrerEntrainement(themeId, stId, titre, retour) {
  let qs = await questions();
  if (themeId === 'situations') {
    // #/entrainement/situations ou #/entrainement/situations/<theme>
    qs = qs.filter((q) => q.s && (!stId || q.t === stId));
  } else {
    if (themeId && themeId !== 'tout') qs = qs.filter((q) => q.t === themeId);
    if (stId) qs = qs.filter((q) => q.st === stId);
  }
  const serie = choisirSerie(qs, SERIE_ENTRAINEMENT).map(preparer);
  if (!serie.length) return naviguer('#/entrainement');
  session = { mode: 'entrainement', titre, retour, questions: serie, i: 0, reponses: [], verrou: false };
  vueQuestion();
}

async function demarrerRevisionDuJour() {
  const qs = await questions();
  const dues = qs.filter((q) => store.estARevoir(q.id));
  const serie = melanger(dues).slice(0, 15).map(preparer);
  if (!serie.length) { toast('Aucune révision prévue aujourd’hui 🎉'); return naviguer('#/'); }
  session = { mode: 'entrainement', titre: 'Révisions du jour', retour: '#/', questions: serie, i: 0, reponses: [], verrou: false };
  vueQuestion();
}

function vueQuestion() {
  const s = session;
  const q = s.questions[s.i];
  const t = themeById(q.t);
  const examen = s.mode === 'examen';
  const choisie = s.reponses[s.i];
  afficher(`
    <div class="quiz" style="--c:${t.couleur}">
      <header class="quiz-tete">
        <button class="retour" data-action="quitter" aria-label="Quitter">✕</button>
        <div class="quiz-avance">${barre((s.i + (examen ? 0 : s.verrou ? 1 : 0)) / s.questions.length, 'Avancement')}<small>Question ${s.i + 1} sur ${s.questions.length}</small></div>
        ${examen ? `<div class="chrono" id="chrono" aria-live="off">--:--</div>` : ''}
      </header>
      <p class="quiz-theme">${t.icone} ${t.court}${q.s ? ' · <span class="badge-situation">🧭 Mise en situation</span>' : ''}</p>
      <h1 class="quiz-question">${e(q.q)}</h1>
      ${audio.audioDisponible ? `<button class="lien-audio" data-action="lire-question">🔊 Écouter la question</button>` : ''}
      <div class="options" role="group" aria-label="Réponses possibles">
        ${q.options.map((o, k) => {
          let cls = '';
          if (examen) cls = choisie === k ? 'choisie' : '';
          else if (s.verrou) cls = k === q.bonne ? 'juste' : choisie === k ? 'fausse' : 'eteinte';
          return `<button class="option ${cls}" data-action="repondre" data-k="${k}" ${!examen && s.verrou ? 'disabled' : ''}>
            <span class="lettre">${'ABCD'[k]}</span><span>${e(o)}</span></button>`;
        }).join('')}
      </div>
      <div id="retour-q">${!examen && s.verrou ? blocCorrection(q, choisie) : ''}</div>
      <div class="quiz-pied">
        ${examen ? `
          <button class="bouton secondaire" data-action="prec" ${s.i === 0 ? 'disabled' : ''}>← Précédente</button>
          ${s.i < s.questions.length - 1 ? `<button class="bouton" data-action="suiv">Suivante →</button>` : `<button class="bouton" data-action="terminer">Terminer l’examen</button>`}
        ` : s.verrou ? `<button class="bouton large" data-action="suiv" id="btn-suiv">${s.i < s.questions.length - 1 ? 'Question suivante →' : 'Voir mon résultat'}</button>` : ''}
      </div>
      ${examen ? `<details class="grille-exam"><summary>Vue d’ensemble (${s.reponses.filter((r) => r !== undefined).length}/${s.questions.length} répondues)</summary>
        <div class="grille-num">${s.questions.map((_, k) => `<button data-action="aller" data-k="${k}" class="${s.reponses[k] !== undefined ? 'faite' : ''} ${k === s.i ? 'courante' : ''}">${k + 1}</button>`).join('')}</div></details>` : ''}
    </div>`, 'aucun');
  if (examen) majChrono();
}

function blocCorrection(q, choisie) {
  const ok = choisie === q.bonne;
  return `<div class="correction ${ok ? 'ok' : 'ko'}" role="status">
    <p class="verdict">${ok ? '✅ Bonne réponse !' : '❌ Pas tout à fait.'}</p>
    ${ok ? '' : `<p>La bonne réponse : <strong>${e(q.a)}</strong></p>`}
    ${q.e ? `<p class="explication">💡 ${e(q.e)}</p>` : ''}
    <a class="lien-cours" href="#/cours/${q.t}/${q.st}">📘 Revoir le cours sur ce point</a>
  </div>`;
}

function repondre(k) {
  const s = session;
  if (!s) return;
  if (s.mode === 'examen') {
    s.reponses[s.i] = k;
    vueQuestion();
    return;
  }
  if (s.verrou) return;
  s.reponses[s.i] = k;
  s.verrou = true;
  const q = s.questions[s.i];
  store.enregistrerReponse(q.id, k === q.bonne);
  if (navigator.vibrate && k !== q.bonne) navigator.vibrate(60);
  vueQuestion();
  document.getElementById('retour-q')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('btn-suiv')?.focus({ preventScroll: true });
}

function suivante() {
  const s = session;
  if (s.mode !== 'examen' && s.i >= s.questions.length - 1) return vueResultatEntrainement();
  s.i = Math.min(s.i + 1, s.questions.length - 1);
  s.verrou = false;
  vueQuestion();
}

function vueResultatEntrainement() {
  const s = session;
  const bonnes = s.questions.filter((q, k) => s.reponses[k] === q.bonne).length;
  const ratees = s.questions.filter((q, k) => s.reponses[k] !== q.bonne);
  const ratio = bonnes / s.questions.length;
  const retour = s.retour || '#/entrainement';
  session = null;
  afficher(`
    <section class="resultat">
      ${anneau(ratio, 150, `${bonnes}/${s.questions.length}`)}
      <h1>${ratio === 1 ? 'Parfait ! 🎉' : ratio >= 0.8 ? 'Très bien ! 👏' : ratio >= 0.5 ? 'C’est un bon début 💪' : 'Continuez, vous progressez 🌱'}</h1>
      <p>${ratees.length ? 'Les questions ratées reviendront dans vos révisions pour bien les retenir.' : 'Toutes les réponses sont justes.'}</p>
      ${ratees.length ? `<div class="carte"><h2>À retenir</h2><ul class="liste-retenir">${ratees.map((q) => `<li><strong>${e(q.q)}</strong><br>→ ${e(q.a)}</li>`).join('')}</ul></div>` : ''}
      <div class="pile-boutons">
        <button class="bouton" data-action="rejouer">🔁 Nouvelle série</button>
        <a class="bouton secondaire" href="#/progres">🎯 Voir mes points faibles</a>
        <a class="bouton secondaire" href="${retour}">Retour</a>
      </div>
    </section>`, 'aucun');
  dernierLancement.retour = retour;
}

const dernierLancement = { fn: null, retour: '' };

// ----- Examen blanc -----

async function vueChoixExamen() {
  const ex = store.getEtat().examens[parcoursCourant()];
  afficher(`
    ${entete('Examen blanc')}
    <div class="carte info-exam">
      <h2>Comme le jour de l’examen</h2>
      <ul>
        <li><strong>${EXAMEN.nbQuestions} questions</strong> sur les 5 thèmes, dont <strong>${NB_SITUATIONS} mises en situation</strong></li>
        <li><strong>${EXAMEN.dureeMinutes} minutes</strong> maximum</li>
        <li>Il faut <strong>${EXAMEN.seuil} bonnes réponses</strong> (80 %) pour réussir</li>
        <li>La correction s’affiche à la fin</li>
      </ul>
    </div>
    <button class="action-principale" data-action="examen" data-type="complet"><span class="emoji" aria-hidden="true">⏱️</span><span><strong>Lancer l’examen complet</strong><small>${EXAMEN.nbQuestions} questions · ${EXAMEN.dureeMinutes} minutes</small></span><span aria-hidden="true">→</span></button>
    <h2 class="titre-section">Examen par module</h2>
    <p class="intro-page">${EXAMEN_MODULE.nbQuestions} questions sur un seul thème, au même rythme que l’examen.</p>
    <div class="liste-themes">
      ${THEMES.map((t) => `<button class="ligne-theme" data-action="examen" data-type="${t.id}" style="--c:${t.couleur}">
        <span class="emoji" aria-hidden="true">${t.icone}</span><span class="lt-texte"><strong>${t.court}</strong>
        <small>${dernierScore(ex, t.id)}</small></span><span aria-hidden="true">›</span></button>`).join('')}
    </div>
    ${ex.length ? `<h2 class="titre-section">Historique</h2><div class="carte"><ol class="historique">${ex.slice(-8).reverse().map((r) => `
      <li><span>${new Date(r.date).toLocaleDateString('fr-FR')} · ${r.type === 'complet' ? 'Examen complet' : e(themeById(r.type)?.court || '')}</span>
      <strong class="${r.reussi ? 'ok' : 'ko'}">${r.score}/${r.total}</strong></li>`).join('')}</ol></div>` : ''}`, 'examen');
}

function dernierScore(ex, type) {
  const r = [...ex].reverse().find((x) => x.type === type);
  return r ? `Dernier score : ${r.score}/${r.total}` : 'Pas encore passé';
}

async function demarrerExamen(type) {
  const qs = await questions();
  let liste, duree;
  if (type === 'complet') {
    liste = tirerExamen(qs);
    duree = EXAMEN.dureeMinutes * 60;
  } else {
    liste = tirerModule(qs, type, EXAMEN_MODULE.nbQuestions);
    duree = liste.length * EXAMEN_MODULE.secondesParQuestion;
  }
  session = { mode: 'examen', type, questions: liste.map(preparer), i: 0, reponses: [], fin: Date.now() + duree * 1000, debut: Date.now() };
  clearInterval(minuterie);
  minuterie = setInterval(majChrono, 1000);
  vueQuestion();
}

function majChrono() {
  if (!session || session.mode !== 'examen') { clearInterval(minuterie); return; }
  const reste = Math.max(0, Math.round((session.fin - Date.now()) / 1000));
  const el = document.getElementById('chrono');
  if (el) {
    el.textContent = `${String(Math.floor(reste / 60)).padStart(2, '0')}:${String(reste % 60).padStart(2, '0')}`;
    el.classList.toggle('urgent', reste < 300);
  }
  if (reste === 0) { toast('Temps écoulé !'); terminerExamen(); }
}

function terminerExamen() {
  clearInterval(minuterie);
  const s = session;
  if (!s) return;
  s.questions.forEach((q, k) => store.enregistrerReponse(q.id, s.reponses[k] === q.bonne));
  const score = s.questions.filter((q, k) => s.reponses[k] === q.bonne).length;
  const total = s.questions.length;
  const reussi = s.type === 'complet' ? score >= EXAMEN.seuil : score / total >= 0.8;
  store.enregistrerExamen({ type: s.type, score, total, reussi, duree: Math.round((Date.now() - s.debut) / 1000) });
  session = null;

  const parTheme = THEMES.map((t) => {
    const idx = s.questions.map((q, k) => (q.t === t.id ? k : -1)).filter((k) => k >= 0);
    return { t, n: idx.length, ok: idx.filter((k) => s.reponses[k] === s.questions[k].bonne).length };
  }).filter((x) => x.n);

  afficher(`
    <section class="resultat">
      ${anneau(score / total, 160, `${score}/${total}`)}
      <h1>${reussi ? 'Examen réussi ! 🎉' : 'Pas encore… mais vous progressez 💪'}</h1>
      <p>${s.type === 'complet' ? `Il fallait ${EXAMEN.seuil} bonnes réponses sur ${EXAMEN.nbQuestions}.` : 'Objectif : 80 % de bonnes réponses.'} Durée : ${Math.round((Date.now() - s.debut) / 60000)} min.</p>
      ${parTheme.length > 1 ? `<div class="carte"><h2>Par thème</h2>${parTheme.map((x) => `
        <div class="score-theme" style="--c:${x.t.couleur}"><span>${x.t.icone} ${x.t.court}</span><strong>${x.ok}/${x.n}</strong>${barre(x.ok / x.n, x.t.court)}</div>`).join('')}</div>` : ''}
      <div class="pile-boutons">
        <a class="bouton" href="#/progres">🎯 Travailler mes points faibles</a>
        <button class="bouton secondaire" data-action="examen" data-type="${s.type}">🔁 Repasser un examen</button>
      </div>
      <h2 class="titre-section">Correction</h2>
      <ol class="correction-liste">
        ${s.questions.map((q, k) => {
          const ok = s.reponses[k] === q.bonne;
          return `<li class="${ok ? 'ok' : 'ko'}"><p class="cq">${ok ? '✅' : '❌'} ${e(q.q)}</p>
            ${ok ? '' : `<p>Votre réponse : ${s.reponses[k] === undefined ? '<em>aucune</em>' : e(q.options[s.reponses[k]])}</p>`}
            <p>Bonne réponse : <strong>${e(q.a)}</strong></p>${!ok && q.e ? `<p class="explication">💡 ${e(q.e)}</p>` : ''}</li>`;
        }).join('')}
      </ol>
    </section>`, 'aucun');
}

// ----- Progrès et points faibles -----

async function vueProgres() {
  const qs = await questions();
  const b = bilan(qs);
  const pf = pointsFaibles(qs);
  const forts = pf.evalues.filter((r) => !pf.faibles.includes(r));
  const ligne = (r) => `<a class="ligne-theme" href="#/revision/${r.theme.id}/${r.stId}" style="--c:${r.theme.couleur}">
      <span class="emoji" aria-hidden="true">${r.theme.icone}</span>
      <span class="lt-texte"><strong>${e(r.titre)}</strong>${barre(r.reussite ?? 0, r.titre)}
      <small>${r.reussite !== null ? pct(r.reussite) + ' de bonnes réponses' : ''}${r.aRevoir ? ' · ' + r.aRevoir + ' à revoir' : ''} · ${r.maitrisees}/${r.total} maîtrisées</small></span>
      <span aria-hidden="true">›</span></a>`;
  afficher(`
    ${entete('Mes points faibles')}
    <div class="bandeau">
      <div><p class="sur-titre">Progression globale</p><h2>${b.maitrisees} / ${b.total}</h2><p>questions maîtrisées · ${b.vues} déjà vues</p>
      ${b.reussite !== null ? `<p>${pct(b.reussite)} de bonnes réponses</p>` : ''}</div>
      ${anneau(b.progression, 100)}
    </div>
    ${b.aRevoir ? `<a class="action-principale" href="#/revision"><span class="emoji" aria-hidden="true">🔁</span><span><strong>Révisions du jour</strong><small>${b.aRevoir} question${b.aRevoir > 1 ? 's' : ''} à revoir maintenant</small></span><span aria-hidden="true">→</span></a>` : ''}
    ${b.vues === 0 ? `<div class="carte vide"><p>🎯 Ici, l’application repère automatiquement les parties où vous faites des erreurs.</p><p>Faites une première série de questions pour voir votre bilan.</p><a class="bouton" href="#/entrainement/tout">Commencer</a></div>` : ''}
    ${pf.faibles.length ? `<h2 class="titre-section">À travailler en priorité</h2>
      <p class="intro-page">Touchez une partie : un rappel du cours, puis des questions ciblées jusqu’à ce que ce soit acquis.</p>
      <div class="liste-themes">${pf.faibles.map(ligne).join('')}</div>` : b.vues ? `<div class="carte"><p>👏 Aucun point faible repéré pour l’instant. Continuez à explorer de nouvelles parties !</p></div>` : ''}
    ${forts.length ? `<h2 class="titre-section">Points forts</h2><div class="liste-themes">${forts.map(ligne).join('')}</div>` : ''}
    ${pf.nonCommences.length && b.vues ? `<h2 class="titre-section">Pas encore commencées</h2><div class="liste-themes">${pf.nonCommences.map(ligne).join('')}</div>` : ''}`, 'progres');
}

async function vueRevision(themeId, stId) {
  const t = themeById(themeId);
  if (!t || !t.sousThemes[stId]) return naviguer('#/progres');
  const titre = t.sousThemes[stId];
  const qs = (await questions()).filter((q) => q.t === themeId && q.st === stId);
  const b = bilan(qs);
  const md = await chargerCours(themeId);
  const section = md ? lireCours(md).sections.find((s) => s.id === stId) : null;
  afficher(`
    ${entete(e(titre), '#/progres')}
    <section style="--c:${t.couleur}">
      <div class="etapes">
        <div class="etape ${b.vues ? 'faite' : 'active'}"><span>1</span>Relire</div>
        <div class="etape ${b.vues ? 'active' : ''}"><span>2</span>S’entraîner</div>
        <div class="etape ${b.maitrise >= 0.8 ? 'faite' : ''}"><span>3</span>Maîtriser</div>
      </div>
      <div class="carte"><p><strong>${b.maitrisees}/${b.total}</strong> questions maîtrisées dans cette partie.</p>${barre(b.progression, titre)}</div>
      ${section ? `<details class="carte rappel" ${b.vues ? '' : 'open'}><summary>📘 Rappel du cours</summary><div class="cours">${section.html}</div>
        ${audio.audioDisponible ? `<button class="bouton petit secondaire" data-action="lire-texte" data-texte="${e(section.titre + '. ' + section.texte)}">🎧 Écouter ce rappel</button>` : ''}</details>` : ''}
      <button class="bouton large" data-action="entrainer-partie" data-theme="${themeId}" data-st="${stId}">✏️ S’entraîner sur cette partie</button>
    </section>`, 'progres');
}

// ----- Réglages et à propos -----

function vueReglages() {
  const et = store.getEtat();
  const voix = audio.voixFrancaises();
  afficher(`
    ${entete('Réglages')}
    <div class="carte">
      <h2>Mon examen</h2>
      <div class="segments">${Object.values(PARCOURS).map((p) => `<button data-action="choisir-parcours" data-p="${p.id}" class="${et.parcours === p.id ? 'actif' : ''}">${p.icone} ${p.titre}</button>`).join('')}</div>
      <p class="petit">Chaque examen a sa propre progression.</p>
    </div>
    <div class="carte">
      <h2>Affichage</h2>
      <label class="champ">Taille du texte
        <div class="segments">${[['normal', 'A'], ['grand', 'A+'], ['tres-grand', 'A++']].map(([v, l]) => `<button data-action="pref" data-cle="taille" data-v="${v}" class="${et.prefs.taille === v ? 'actif' : ''}">${l}</button>`).join('')}</div></label>
      <label class="champ">Thème
        <div class="segments">${[['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(([v, l]) => `<button data-action="pref" data-cle="theme" data-v="${v}" class="${et.prefs.theme === v ? 'actif' : ''}">${l}</button>`).join('')}</div></label>
    </div>
    ${audio.audioDisponible ? `<div class="carte">
      <h2>Audio</h2>
      <label class="champ">Vitesse de lecture
        <div class="segments">${[[0.8, 'Lente'], [1, 'Normale'], [1.2, 'Rapide']].map(([v, l]) => `<button data-action="pref" data-cle="vitesse" data-v="${v}" class="${Number(et.prefs.vitesse) === v ? 'actif' : ''}">${l}</button>`).join('')}</div></label>
      ${voix.length > 1 ? `<label class="champ">Voix<select data-action-change="voix">${voix.map((v) => `<option ${v.name === et.prefs.voix ? 'selected' : ''}>${e(v.name)}</option>`).join('')}</select></label>` : ''}
      <button class="bouton petit secondaire" data-action="lire-texte" data-texte="Bonjour, voici un exemple de lecture.">🔊 Tester la voix</button>
    </div>` : ''}
    <div class="carte">
      <h2>Ma progression</h2>
      <p class="petit">Votre progression est enregistrée sur cet appareil uniquement. Aucun compte, aucune donnée envoyée. Pour la transférer sur un autre appareil, téléchargez le fichier puis importez-le.</p>
      <div class="pile-boutons">
        <button class="bouton secondaire" data-action="exporter">⬇️ Télécharger ma progression</button>
        <label class="bouton secondaire">⬆️ Importer une progression<input type="file" accept="application/json,.json" data-action-change="importer" hidden></label>
        <button class="bouton danger" data-action="reinitialiser">Effacer la progression de cet examen</button>
      </div>
    </div>
    <a class="lien-discret" href="#/a-propos">À propos de ${APP_NAME}</a>`, 'aucun');
}

function vueAPropos() {
  afficher(`
    ${entete('À propos', '#/reglages')}
    <div class="carte texte">
      <p><strong>${APP_NAME}</strong> est une application <strong>gratuite, sans publicité et open source</strong> pour préparer l’examen civique (naturalisation et carte de résident).</p>
      <p>⚠️ C’est un outil indépendant : il n’est <strong>pas</strong> édité par l’État ni par le ministère de l’Intérieur.</p>
      <h2>Sources</h2>
      <ul>
        <li>Questions : listes officielles publiées par le ministère de l’Intérieur.</li>
        <li>Réponses suggérées par <a href="https://leqcmcivique.fr" target="_blank" rel="noopener">leqcmcivique.fr</a>, publiées sur data.gouv.fr sous Licence Ouverte 2.0.</li>
        <li>Mauvaises réponses, explications, mises en situation et cours : rédigés pour ce projet. Il n’existe pas de liste officielle des mises en situation. Ces contenus peuvent contenir des erreurs : signalez-les !</li>
        <li>Format de l’examen : 40 questions, dont 12 mises en situation, 45 minutes, 32 bonnes réponses pour réussir (arrêté du 10 octobre 2025).</li>
      </ul>
      <h2>Contribuer</h2>
      <p>Le code et le contenu sont ouverts. Vous pouvez signaler une erreur ou proposer une amélioration sur GitHub.</p>
      <h2>Vie privée</h2>
      <p>Aucun compte, aucun cookie publicitaire, aucune donnée personnelle collectée. La progression reste sur votre appareil.</p>
    </div>`, 'aucun');
}

// ---------- Navigation ----------

function naviguer(h) {
  if (location.hash === h) routeur();
  else location.hash = h;
}

async function routeur() {
  const h = location.hash.replace(/^#\/?/, '');
  const [r, a, b] = h.split('/');

  if (session?.mode === 'examen' && r !== 'session') {
    if (!confirm('Quitter l’examen ? Vos réponses seront perdues.')) {
      history.replaceState(null, '', '#/session');
      return;
    }
    clearInterval(minuterie);
    session = null;
  } else if (session && r !== 'session') {
    session = null;
  }

  if (!parcoursCourant() && r !== 'a-propos') return vueBienvenue();

  try {
    switch (r) {
      case '': return await vueAccueil();
      case 'theme': return await vueTheme(a);
      case 'cours': return a ? await vueCours(a, b) : await vueListeCours();
      case 'ecouter': return await vueEcouter();
      case 'entrainement':
        if (!a) return await vueChoixEntrainement();
        history.replaceState(null, '', '#/session');
        dernierLancement.fn = () => demarrerEntrainement(a, b || null, null, a === 'situations' && b ? '#/theme/' + b : '#/entrainement');
        return await dernierLancement.fn();
      case 'examen':
        if (!a) return await vueChoixExamen();
        history.replaceState(null, '', '#/session');
        return await demarrerExamen(a);
      case 'progres': return await vueProgres();
      case 'revision':
        if (!a) {
          history.replaceState(null, '', '#/session');
          dernierLancement.fn = demarrerRevisionDuJour;
          return await demarrerRevisionDuJour();
        }
        return await vueRevision(a, b);
      case 'reglages': return vueReglages();
      case 'a-propos': return vueAPropos();
      case 'session': return session ? vueQuestion() : naviguer('#/');
      default: return naviguer('#/');
    }
  } catch (err) {
    console.error(err);
    afficher(`<div class="carte"><h1>Oups</h1><p>Le contenu n’a pas pu être chargé. Vérifiez votre connexion et réessayez.</p><a class="bouton" href="#/">Accueil</a></div>`);
  }
}

// ---------- Actions ----------

function appliquerPrefs() {
  const p = store.getEtat().prefs;
  document.documentElement.dataset.taille = p.taille;
  if (p.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = p.theme === 'sombre' ? 'dark' : 'light';
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'choisir-parcours':
      store.setParcours(d.p);
      if (location.hash.includes('reglages')) { toast('Examen choisi : ' + PARCOURS[d.p].titre); vueReglages(); }
      else naviguer('#/');
      break;
    case 'repondre': repondre(Number(d.k)); break;
    case 'suiv': suivante(); break;
    case 'prec': session.i = Math.max(0, session.i - 1); vueQuestion(); break;
    case 'aller': session.i = Number(d.k); vueQuestion(); break;
    case 'terminer': {
      const manquantes = session.questions.length - session.reponses.filter((x) => x !== undefined).length;
      if (!manquantes || confirm(`Il reste ${manquantes} question${manquantes > 1 ? 's' : ''} sans réponse. Terminer quand même ?`)) terminerExamen();
      break;
    }
    case 'quitter':
      if (session?.mode === 'examen') {
        if (!confirm('Quitter l’examen ? Vos réponses seront perdues.')) return;
        clearInterval(minuterie);
      }
      { const retour = session?.mode === 'examen' ? '#/examen' : session?.retour || '#/'; session = null; naviguer(retour); }
      break;
    case 'rejouer': if (dernierLancement.fn) { history.replaceState(null, '', '#/session'); await dernierLancement.fn(); } break;
    case 'examen': history.replaceState(null, '', '#/session'); session = null; await demarrerExamen(d.type); break;
    case 'entrainer-partie': {
      const t = themeById(d.theme);
      const retour = location.hash;
      dernierLancement.fn = () => demarrerEntrainement(d.theme, d.st, t.sousThemes[d.st], retour);
      history.pushState(null, '', '#/session');
      await dernierLancement.fn();
      break;
    }
    case 'lire-question': {
      const q = session.questions[session.i];
      audio.ecouter([{ titre: '', texte: q.q + ' ' + q.options.map((o, k) => `Réponse ${'ABCD'[k]} : ${o}.`).join(' ') }], 0, majLecteur);
      break;
    }
    case 'lire-texte': audio.ecouter([{ titre: '', texte: d.texte, theme: 'Lecture' }], 0, majLecteur); break;
    case 'ecouter-cours': await lancerEcoute(d.theme, d.index); break;
    case 'audio-pause': audio.pauseReprise(); break;
    case 'audio-suiv': audio.suivant(); break;
    case 'audio-prec': audio.precedent(); break;
    case 'audio-stop': audio.arreter(); document.getElementById('lecteur-flottant')?.remove(); break;
    case 'pref':
      store.setPref(d.cle, d.cle === 'vitesse' ? Number(d.v) : d.v);
      appliquerPrefs();
      vueReglages();
      break;
    case 'exporter': {
      const blob = new Blob([store.exporter()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `passeport-civique-progression-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      break;
    }
    case 'reinitialiser':
      if (confirm('Effacer toute la progression de cet examen ? Cette action est définitive.')) {
        store.reinitialiser(parcoursCourant());
        toast('Progression effacée');
      }
      break;
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.actionChange === 'voix') store.setPref('voix', el.value);
  if (el.dataset.actionChange === 'importer' && el.files[0]) {
    try {
      store.importer(await el.files[0].text());
      appliquerPrefs();
      toast('Progression importée ✅');
      vueReglages();
    } catch {
      toast('Ce fichier n’est pas reconnu');
    }
  }
});

// Raccourcis clavier pendant les questions : 1-4 ou A-D pour répondre, Entrée pour continuer.
document.addEventListener('keydown', (ev) => {
  if (!session || ev.target.matches('input, select, textarea')) return;
  const k = '1234'.indexOf(ev.key) >= 0 ? '1234'.indexOf(ev.key) : 'abcd'.indexOf(ev.key.toLowerCase());
  if (k >= 0 && k < session.questions[session.i].options.length && ev.key.length === 1) { repondre(k); ev.preventDefault(); }
  else if (ev.key === 'Enter' && session.mode !== 'examen' && session.verrou) { suivante(); ev.preventDefault(); }
});

window.addEventListener('hashchange', routeur);
appliquerPrefs();
routeur();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
