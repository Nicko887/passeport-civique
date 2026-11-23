// Configuration générale : parcours, thèmes, sous-thèmes et format d'examen.

export const APP_NAME = 'Passeport Civique';

// Les trois mentions de l'examen civique (arrêté du 10 octobre 2025, art. 1), de la plus simple à la plus exigeante.
// Chacune a sa propre liste officielle de questions de connaissance (formation-civique.interieur.gouv.fr).
export const PARCOURS = {
  csp: {
    id: 'csp',
    titre: 'Carte de séjour pluriannuelle',
    court: 'Carte pluriannuelle',
    sousTitre: 'Première carte de séjour pluriannuelle (CSP)',
    icone: 'sejour',
    couleur: 'var(--c-csp)',
  },
  resident: {
    id: 'resident',
    titre: 'Carte de résident',
    court: 'Carte de résident',
    sousTitre: 'Première carte de résident (CR)',
    icone: 'resident',
    couleur: 'var(--c-resident)',
  },
  naturalisation: {
    id: 'naturalisation',
    titre: 'Naturalisation',
    court: 'Naturalisation',
    sousTitre: 'Devenir Français ou Française',
    icone: 'naturalisation',
    couleur: 'var(--c-naturalisation)',
  },
};

export const THEMES = [
  {
    id: 'principes',
    titre: 'Principes et valeurs de la République',
    court: 'Principes et valeurs',
    icone: 'principes',
    couleur: 'var(--c-principes)',
    sousThemes: {
      symboles: 'Les symboles de la République',
      valeurs: 'Les valeurs républicaines',
      laicite: 'La laïcité',
      libertes: 'Les libertés',
      egalite: 'L’égalité et la non-discrimination',
      citoyennete: 'La citoyenneté et l’engagement',
    },
  },
  {
    id: 'institutions',
    titre: 'Système institutionnel et politique',
    court: 'Institutions',
    icone: 'institutions',
    couleur: 'var(--c-institutions)',
    sousThemes: {
      constitution: 'La Constitution et la Ve République',
      executif: 'Le Président et le Gouvernement',
      parlement: 'Le Parlement et les lois',
      justice: 'La justice',
      collectivites: 'Les collectivités territoriales',
      elections: 'Les élections et le vote',
      europe: 'L’Union européenne',
    },
  },
  {
    id: 'droits',
    titre: 'Droits et devoirs',
    court: 'Droits et devoirs',
    icone: 'droits',
    couleur: 'var(--c-droits)',
    sousThemes: {
      droits_fondamentaux: 'Les droits fondamentaux',
      devoirs: 'Les devoirs',
      famille: 'La famille',
      egalite_fh: 'L’égalité femmes-hommes',
      travail: 'Le travail',
      justice_recours: 'L’accès au droit et les recours',
    },
  },
  {
    id: 'histoire',
    titre: 'Histoire, géographie et culture',
    court: 'Histoire et culture',
    icone: 'histoire',
    couleur: 'var(--c-histoire)',
    sousThemes: {
      histoire_ancienne: 'De la Gaule à 1789',
      revolution_empire: 'Révolution et XIXe siècle',
      histoire_contemporaine: 'De 1870 à 1945',
      histoire_recente: 'Depuis 1945',
      geographie: 'La géographie',
      outre_mer: 'Les outre-mer',
      culture: 'La culture et le patrimoine',
    },
  },
  {
    id: 'societe',
    titre: 'Vivre dans la société française',
    court: 'Vie en société',
    icone: 'societe',
    couleur: 'var(--c-societe)',
    sousThemes: {
      sante: 'La santé',
      education: 'L’école et l’éducation',
      logement: 'Le logement',
      emploi_social: 'L’emploi et la protection sociale',
      demarches: 'Les démarches administratives',
      vie_quotidienne: 'La vie quotidienne',
    },
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id);

// Format officiel : 40 questions, 45 minutes, 32 bonnes réponses (80 %) pour réussir.
// Seuil : arrêté du 10 octobre 2025, art. 2 (naturalisation) ; dépliant du ministère de l'Intérieur
// « Examen civique – séjour » (nov. 2025) : « 32 bonnes réponses minimum » pour la carte pluriannuelle et la carte de résident.
// Répartition par thème selon l'article 3 de l'arrêté du 10 octobre 2025 (Légifrance, JORFTEXT000052381620),
// identique pour toutes les mentions. Les 12 mises en situation sont comprises dans les totaux des thèmes.
export const EXAMEN = {
  nbQuestions: 40,
  dureeMinutes: 45,
  seuil: 32,
  repartition: { principes: 11, institutions: 6, droits: 11, histoire: 8, societe: 4 },
  situations: { principes: 6, droits: 6 },
};

// Sites sûrs vers lesquels les cours et les questions peuvent renvoyer (sites publics ou institutionnels).
// Même liste dans outils/construire.py. Un lien vers un autre site est affiché comme du texte simple.
export const SITES_SURS = [
  'gouv.fr', 'service-public.fr', 'vie-publique.fr', 'elysee.fr', 'assemblee-nationale.fr', 'senat.fr',
  'conseil-constitutionnel.fr', 'conseil-etat.fr', 'cour-de-cassation.fr', 'defenseurdesdroits.fr', 'justice.fr',
  'cnil.fr', 'ameli.fr', 'caf.fr', 'msa.fr', 'francetravail.fr', 'info-retraite.fr', 'europa.eu', 'insee.fr',
  'bnf.fr', 'ina.fr', 'lumni.fr', 'histoire-image.org', 'monuments-nationaux.fr', 'chateauversailles.fr',
  'louvre.fr', 'musee-orsay.fr', 'centrepompidou.fr', 'pantheonsorbonne.fr', 'unesco.org', 'ign.fr',
  'meteofrance.com', 'onisep.fr', 'arretonslesviolences.gouv.fr',
];

export function lienSur(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && SITES_SURS.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

export const NB_SITUATIONS = Object.values(EXAMEN.situations).reduce((a, b) => a + b, 0);

// Examen par module : 10 questions, même rythme que l'examen réel.
export const EXAMEN_MODULE = { nbQuestions: 10, secondesParQuestion: Math.round((45 * 60) / 40) };

export const SERIE_ENTRAINEMENT = 10;

// Révision espacée (système de Leitner) : délai en jours avant de revoir une question selon sa boîte.
export const BOITES_DELAIS = [0, 1, 3, 7, 16, 35];
export const BOITE_MAITRISE = 3; // à partir de cette boîte, la question est considérée comme maîtrisée
