# Appli d'entraînement perso

Appli personnelle pour assister mes séances de musculation à la salle, sur iPhone, une main occupée et entre deux séries. Un seul utilisateur (moi). Langue de l'interface : français.

## Contexte

- Je fais 2 séances jambes (programme par phases sur critères, voir plus bas), 2 séances haut du corps (push et pull, exercices choisis au fur et à mesure), des abdos cadrés en séance à part (lancés depuis l'accueil quand je veux), et une sortie course par semaine.
- Pas de jours fixes : je place mes séances selon mes disponibilités. On parle de « 1re / 2e séance de la semaine », jamais de « séance du lundi ».
- Volley : enregistré comme une séance (type `volley`) avec le check genou. Interdit en phases 0 à 2 (saisie possible, avec un avertissement), échelle `volleyLadder` en phase 3. Les ajustements volley de la phase 4 (pliométrie réduite selon le nombre de volleys, pas de séance la veille d'un match) sont seulement affichés pour l'instant.
- Genou droit fragile (tendinopathie rotulienne) : le suivi de la douleur fait partie du programme jambes. Leg extension interdit, ne jamais le proposer.
- Les fichiers du dossier `data/` sont la source de vérité pour les programmes et le catalogue de départ. Ne pas les réécrire à la main dans le code : l'appli les importe.
- **Lire `PRINCIPES.md` avant toute modification d'un fichier `data/programme-*.json`.**

## Stack technique

- PWA installable sur iPhone (Safari, « Ajouter à l'écran d'accueil »), fonctionne hors ligne à la salle.
- React + TypeScript + Vite, plugin PWA (vite-plugin-pwa).
- Stockage local IndexedDB (Dexie). Pas de backend, pas de compte.
- Export / import de toutes les données en un fichier JSON (sauvegarde manuelle), accessible depuis les réglages.
- Déploiement statique gratuit sur GitHub Pages : `.github/workflows/deploy.yml` teste, construit et publie à chaque envoi sur `main`. Routeur par hash (`#/…`), chemins relatifs (`base: './'`).
- Icônes générées par `node scripts/make-icons.mjs` (dans `public/`).
- Mobile d'abord : gros boutons, saisie au pouce, mode sombre automatique, pas de clavier à ouvrir quand on peut l'éviter (boutons +/− pour charges et reps).
- Charges : toute charge multiple de 0,5 kg. Boutons +/− au cran de l'exercice, ±0,5 et ±10, et saisie directe au clavier décimal (virgule acceptée, arrondi au 0,5). La charge saisie est enregistrée telle quelle, sans arrondi au cran.

## Fichiers de données

- `data/exercises.json` : catalogue de départ. Chaque exercice a un `id`, un nom, une catégorie, un équipement, une unité de charge (`kg`, `bodyweight`, `bodyweight+kg`, `time`, `none`), un incrément de charge, un repos par défaut, des `slots` (emplacements de la trame haut du corps : rangent l'exercice en push ou pull et lui donnent séries, reps et repos par défaut), des consignes et éventuellement des `alternatives` (remplaçants proposés en séance cadrée).
- `data/programme-jambes.json` (v4, `type: "phased"`) : 5 phases `p0` à `p4`. Chaque phase a un objectif, des `rules` affichées, une durée minimale (`minDays` ou `minWeeks`), des `exitCriteria` (échelle 0-10 avec `max`, `yesno`, `ratio` droite/gauche avec `min`, ou `auto` calculé), et soit des séances fixes (`sessions`, phase 0, avec des isométriques quotidiens `daily`), soit des semaines A/B (`weeks`, `repeatLastWeek`). Chaque séance a ses `variants` par durée, les exercices peuvent avoir un `superset` et une `condition` (« semaine>=2 et lendemain<=2 »). La phase 3 a l'échelle `volleyLadder`, la phase 4 reprend les blocs de l'ancien programme. `healthCheck` : règles vert/orange/rouge, `appliesTo` (jambes, volley), `decisionOn: "lendemain"`.
- `data/programme-abdos.json` : circuit abdos par blocs de semaines, en séance à part.
- `data/programme-haut-du-corps.json` : trames push et pull (`variants` par durée composées de slots : fourchette de reps, séries, repos, exercice par défaut, `superset`) + règle de double progression. Depuis les séances libres, il sert seulement à dire quels exercices sont « du push » ou « du pull » et à donner séries, fourchette et repos par défaut. `variants`, `estimatedMin` et `abdosRounds` ne servent plus qu'aux anciennes séances.
- `data/planning.json` : rythme hebdomadaire indicatif (2 jambes, push, pull, footing). Il ne décide pas de la séance proposée.

Notation du tempo : excentrique-pause bas-concentrique-pause haut, en secondes, X = explosif. L'afficher aussi en clair (ex. « Descente 3 s, remontée explosive »).

## Modèle de données (à stocker dans IndexedDB)

- `Exercise` : catalogue (celui de `data/` + ceux que je crée). Un exercice créé par moi a les mêmes champs, avec des valeurs par défaut raisonnables, et je choisis à quels slots il appartient.
- `Session` : une séance réalisée. Date, type (`jambes`, `push`, `pull`, `abdos`, `libre`, `course`), position dans le programme si cadrée, notes, check genou si jambes. Un footing est une `Session` de type `course` sans détail. Une séance cadrée garde une copie de ce qui était prescrit à son démarrage (plan, et pour les jambes version du programme, nom de séance, bloc, semaine allégée) : une nouvelle version d'un programme ne change jamais une séance déjà faite.
- `SetLog` : une série réalisée. Session, exercice, numéro de série, charge, reps réalisées (ou durée), repos réellement pris avant la série, cochée. Exercice unilatéral : une seule saisie par série, qui vaut pour chaque côté.
- `Settings` : par programme (jambes, abdos) une date de début, indicative, et une éventuelle correction manuelle de position ; préférences.

### Programme jambes par phases (v4)
- Journal des phases (`PhaseEvent` : début, test réussi, régression, changement à la main). La phase en cours est la dernière entrée enregistrée ; seules les séances faites depuis cette entrée comptent (`Session.phase` : entrée, phase, semaine du contenu, rang de la semaine, A/B, charge ajoutée). L'historique de l'ancien programme reste consultable mais ne compte pas.
- Dans une phase : A puis B ; semaine terminée → suivante. Un lendemain orange (3 à 5/10, jambes ou volley) dans la semaine → on refait la même semaine. Après la dernière semaine (`repeatLastWeek`) on la répète ; en phase 1, +2,5 kg sur les charges cibles à chaque répétition si le lendemain est resté vert.
- Durée minimale : jours calendaires en phase 0, semaines du programme terminées (répétitions comprises) ensuite. Au-delà de `maxWeeks` : conseil de consulter.
- Test de sortie quand la durée minimale est faite ; phase suivante seulement si tous les critères sont remplis (critères auto : `lendemain-2sem`, `lendemain-sauts`, `volley-complet`).
- Régression automatique après chaque réponse du lendemain : au-dessus de 5/10, ou au-dessus de 2/10 trois fois de suite → phase précédente (phase 0 au minimum). Exceptions validées : en phase 3, un lendemain de volley au-dessus de 5 fait redescendre l'échelle de deux marches (et pas de sauts en salle cette semaine) sans changer de phase ; en phase 4, retour en phase 3 après deux lendemains au-dessus de 5 de suite.
- Échelle volley (phase 3) : marche suivante si le lendemain du dernier volley est ≤ 2, même marche si 3 à 5, deux marches plus bas au-dessus de 5.
- Garde-fous : en phase 2, pas plus de 2 séances avec sauts par semaine ni deux jours de suite ; en phase 3, pas de sauts en salle à moins de 48 h d'un volley. Les sauts sont alors sautés par défaut, réactivables.
- Exercice avec `condition` : optionnel si elle est remplie, masqué sinon (semaine = semaine de la phase, lendemain = dernière réponse).
- Isométriques quotidiens (phase 0) : carte à cocher sur l'accueil, minuteur guidé, rappel quotidien à 18 h par un fichier calendrier (.ics) à importer, pastille sur l'icône.

### Progression des programmes cadrés (abdos)
- Un programme est une suite de séances : S1, S1, S2… On avance selon les séances faites, pas selon le calendrier. Une séance pas faite est décalée, jamais sautée.
- La prochaine séance est la première non faite à partir du point de départ (début du programme ou dernière correction manuelle).
- Je peux corriger la position à la main dans les réglages (« reprendre à la semaine 5, séance A »). Seules les séances faites après la correction comptent.
- Abdos : deux séances abdos font une semaine du programme abdos.
- Haut du corps : on propose push ou pull, celui des deux fait le moins récemment.
- La mise à jour de `data/exercises.json` ajoute les nouveaux exercices et met à jour ceux du catalogue que je n'ai pas modifiés. Mes exercices et mes modifications ne sont jamais écrasés.

### Variantes, supersets, durées
- Au démarrage d'une séance jambes : « Combien de temps tu as ? » (45 min, 1 h, 1 h 30, 2 h, sans limite). Un appui lance la variante la plus complète dont la durée estimée × coefficient tient dans ce temps (sinon la plus courte). Les variantes sont listées dessous avec leur durée pour en prendre une autre. Pas de changement de variante en cours de séance.
- La séance enregistre sa variante (`Session.variant`). Les ajustements genou s'appliquent à la variante choisie (charges de la semaine précédente prises dans la même variante).
- Supersets : série 1 de chaque exercice du groupe sans pause, puis le repos du groupe (le plus long de ses repos), puis la série 2… Un exercice qui a moins de séries sort du tour. Le circuit abdos suit la même logique (un seul groupe, repos entre les tours).
- Abdos : tours du programme abdos (`abdosRounds` ne vaut que pour les anciennes séances enchaînées après un push ou un pull).
- Durée réelle = de l'heure de début à la fin (abdos enchaînés compris pour les anciennes séances push/pull), comparée à `estimatedMin` dans l'historique. Coefficient de correction : médiane de réel ÷ estimé sur les 8 dernières séances avec variante, en écartant les rapports hors de 0,5–2 ; remise à 1 possible dans les réglages.
- Anciennes séances push/pull : places de la trame repérées par slot et rang (`push:triceps:2`).
- Remplacement en séance cadrée : alternatives du catalogue d'abord, puis tout le catalogue. La place garde l'exercice prévu (`replaced`) ; la charge cible du programme ne vaut que pour lui ; si le remplaçant ne se mesure pas pareil (durée ↔ reps), la prescription devient 8 à 12 reps ou 30 s.

L'historique est rattaché à l'exercice, pas au slot : si je fais « Rowing haltère » dans le slot Rowing, je retrouve ma dernière perf de « Rowing haltère », peu importe le slot.

## Écrans

### Accueil
- Programme jambes : phase, semaine (refaite ou répétée), séances de la semaine, feu du dernier lendemain, bouton pour démarrer la prochaine, test de sortie, règles de la phase. Check du matin : une réponse vaut pour toutes les séances (jambes, volley) qui l'attendent. Isométriques du jour en phase 0. Volley : marche actuelle et suivante autorisée en phase 3.
- Haut du corps : push ou pull proposé (celui fait le moins récemment), les deux boutons disponibles.
- Abdos : semaine et séance du programme abdos, bouton pour lancer le circuit.
- Footing : un bouton « Footing fait » et le nombre de footings de la semaine, à titre indicatif.
- Possibilité de choisir une autre séance.

### Séance haut du corps (libre, `Session.free`)
- Push ou pull, sans trame ni variante : la séance démarre vide et la liste s'ouvre pour le premier exercice. Je choisis l'exercice suivant à la fin du précédent : après sa dernière série, le chrono de repos se lance et la liste s'ouvre dessous.
- Liste : « Exercices du push / pull » en tête (slots de la trame, ou déjà faits dans une séance de ce type), du plus récent au plus ancien, puis les autres exercices, recherche, et « Créer un exercice » (nouvelle machine : ajouté au catalogue, proposé ensuite).
- Choix « Superset (2 exercices) » dans la liste : les deux s'enchaînent sans pause, repos après le second.
- Séries, fourchette et repos d'un exercice ajouté : ceux de la dernière fois (séries réellement faites), sinon ceux de sa place dans la trame, sinon 3 × 8 à 12 (20 à 40 s en durée) et son repos par défaut. Modifiables.
- Je peux changer un exercice pas commencé, le retirer, en sauter un, ou changer l'ordre.
- Pour chaque exercice, afficher clairement la dernière séance : date, charge et reps de chaque série.
- Proposer une cible du jour par la double progression : si toutes les séries de la dernière fois ont atteint le haut de la fourchette, charge + incrément et reps visées au bas de la fourchette ; sinon même charge, viser +1 rep sur les séries sous le haut de la fourchette.
- Saisie série par série : charge préremplie avec la cible, boutons +/− ; à la fin de chaque série, j'entre les reps réalisées (boutons rapides autour de la cible) et je valide. La validation lance le chrono de repos.
- Pas d'abdos enchaînés : je les lance depuis l'accueil quand je veux.

### Repos et chrono
- Avant un exercice, je choisis le temps de repos : prérempli avec celui de la dernière fois sur cet exercice (sinon le repos du slot ou de l'exercice). Boutons rapides : 45 s, 1 min, 1 min 30, 2 min, 2 min 30, 3 min, + réglage fin.
- Si je choisis un repos nettement plus court que la dernière fois (au moins 30 % de moins), l'appli ajuste la cible et me le dit : par exemple viser 1 à 2 reps de moins à la même charge. Règle simple, affichée, que je peux ignorer.
- Le chrono démarre à la validation d'une série, s'affiche en grand, avec +15 s / −15 s et « Passer ».
- Fin du repos : son, vibration si disponible, et notification si l'appli est en arrière-plan quand c'est possible. Le chrono doit rester juste si je quitte l'appli et reviens : calculer à partir de l'heure de fin, pas d'un compteur.
- Garder l'écran allumé pendant la séance (Wake Lock API) si possible.
- Enregistrer le repos réellement pris avant chaque série.

### Séance cadrée (jambes et abdos)
- L'appli affiche exactement ce qui est prévu pour la semaine et la séance : exercice, séries, reps, charge cible, tempo, repos, notes et consignes.
- Même saisie série par série et même chrono que pour le haut du corps, avec le repos prérempli depuis le programme (modifiable).
- La charge cible est préremplie mais je peux la changer. Garder la trace de la cible et du réalisé.
- Exercice sans charge cible dans le programme : charge de la dernière fois, et +1 cran proposé si toutes les séries avaient atteint les reps visées (« largement réussies » si +2 reps ou plus), jamais en semaine allégée. La charge de la dernière fois reste toujours affichée.
- Abdos en circuit : enchaîner les exercices d'un tour sans repos, puis le repos entre les tours. Afficher le tour en cours. La progression du bloc (+2 reps ou +5 s quand tous les tours sont propres) se propose comme pour la double progression.
- Semaines allégées marquées comme telles.
- Fin de séance jambes (et saisie d'un volley) : douleur pendant, 0 à 10. Le lendemain matin : squat unipodal lent. Le feu (vert / orange / rouge) et l'action se décident sur la réponse du lendemain (`decisionOn`), avec les conséquences du programme par phases (voir plus haut).
- Exercice en durée : minuteur de tenue dans la saisie de la série.

### Historique
- Liste des séances passées, détail de chaque séance.
- Par exercice : courbe de la meilleure série (charge et reps, ou 1RM estimé), tableau des séances.
- Courbe de la douleur au genou dans le temps (jambes et volley).

### Réglages
- Programme jambes : phase en cours, date de début de la phase, historique des phases, changement de phase à la main. Programme abdos : date de début et position.
- Catalogue d'exercices : voir, modifier, créer, archiver.
- Export / import JSON.

## Priorités de développement

1. Socle : projet, import des fichiers `data/`, base IndexedDB, navigation.
2. Séance haut du corps : choix de l'exercice (par slot, puis libre au fur et à mesure), création d'exercice, dernière perf, saisie série par série.
3. Chrono de repos avec choix du temps et ajustement de cible.
4. Séances cadrées jambes et abdos, check genou.
5. Historique et courbes.
6. PWA hors ligne, export/import, déploiement.

À chaque étape, l'appli doit fonctionner avant de passer à la suivante. Écrire des tests pour la logique (double progression, ajustement selon le repos, semaine en cours, règles du check genou).
