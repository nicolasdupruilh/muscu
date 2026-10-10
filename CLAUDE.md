# Appli d'entraînement perso

Appli personnelle pour assister mes séances de musculation à la salle, sur iPhone, une main occupée et entre deux séries. Un seul utilisateur (moi). Langue de l'interface : français.

## Contexte

- Je fais 2 séances jambes (programme cadré sur 16 semaines), 2 séances haut du corps (trame souple : push et pull), des abdos cadrés en fin de séance haut du corps, et une sortie course par semaine.
- Pas de jours fixes : je place mes séances selon mes disponibilités. On parle de « 1re / 2e séance de la semaine », jamais de « séance du lundi ».
- Pas de volley pour l'instant : ignorer `volleyAdjustments` jusqu'à nouvel ordre.
- Après la semaine 16 : la trame haut du corps continue, un nouveau programme jambes (nouveau fichier dans `data/`) prendra le relais.
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

- `data/exercises.json` : catalogue de départ. Chaque exercice a un `id`, un nom, une catégorie, un équipement, une unité de charge (`kg`, `bodyweight`, `bodyweight+kg`, `time`, `none`), un incrément de charge, un repos par défaut, des `slots` (emplacements de la trame haut du corps où il peut être choisi), des consignes et éventuellement des `alternatives` (remplaçants proposés en séance cadrée).
- `data/programme-jambes.json` : 16 semaines × séances A et B, entièrement prescrites (séries, reps, charge cible, tempo, repos, notes), chacune en plusieurs `variants` par durée (`id`, `label`, `estimatedMin`, `items`), de la plus courte à la complète. Les exercices qui partagent la même valeur `superset` s'enchaînent. Contient aussi le check genou (`healthCheck`) avec les règles vert/orange/rouge et les ajustements volley.
- `data/programme-abdos.json` : circuit abdos par blocs de semaines, à enchaîner après les séances push et pull.
- `data/programme-haut-du-corps.json` : trames push et pull, chacune en `variants` par durée (`estimatedMin` abdos compris, `abdosRounds` = tours du circuit abdos qui suit) composées de slots (fourchette de reps, nombre de séries, repos, exercice par défaut, `superset`) + règle de double progression.
- `data/planning.json` : rythme hebdomadaire indicatif (2 jambes, push, pull, footing). Il ne décide pas de la séance proposée.

Notation du tempo : excentrique-pause bas-concentrique-pause haut, en secondes, X = explosif. L'afficher aussi en clair (ex. « Descente 3 s, remontée explosive »).

## Modèle de données (à stocker dans IndexedDB)

- `Exercise` : catalogue (celui de `data/` + ceux que je crée). Un exercice créé par moi a les mêmes champs, avec des valeurs par défaut raisonnables, et je choisis à quels slots il appartient.
- `Session` : une séance réalisée. Date, type (`jambes`, `push`, `pull`, `abdos`, `libre`, `course`), position dans le programme si cadrée, notes, check genou si jambes. Un footing est une `Session` de type `course` sans détail. Une séance cadrée garde une copie de ce qui était prescrit à son démarrage (plan, et pour les jambes version du programme, nom de séance, bloc, semaine allégée) : une nouvelle version d'un programme ne change jamais une séance déjà faite.
- `SetLog` : une série réalisée. Session, exercice, numéro de série, charge, reps réalisées (ou durée), repos réellement pris avant la série, cochée. Exercice unilatéral : une seule saisie par série, qui vaut pour chaque côté.
- `Settings` : par programme (jambes, abdos) une date de début, indicative, et une éventuelle correction manuelle de position ; préférences.

### Progression des programmes cadrés
- Un programme est une suite de séances : S1 A, S1 B, S2 A… On avance selon les séances faites, pas selon le calendrier. Une séance pas faite est décalée, jamais sautée.
- La prochaine séance est la première non faite à partir du point de départ (début du programme ou dernière correction manuelle).
- Je peux corriger la position à la main dans les réglages (« reprendre à la semaine 5, séance A »). Seules les séances faites après la correction comptent.
- Abdos : deux séances avec abdos (après push et après pull) font une semaine du programme abdos.
- Haut du corps : on propose push ou pull, celui des deux fait le moins récemment.
- La mise à jour de `data/exercises.json` ajoute les nouveaux exercices et met à jour ceux du catalogue que je n'ai pas modifiés. Mes exercices et mes modifications ne sont jamais écrasés.

### Variantes, supersets, durées
- Au démarrage d'une séance jambes, push ou pull : « Combien de temps tu as ? » (45 min, 1 h, 1 h 30, 2 h, sans limite). Un appui lance la variante la plus complète dont la durée estimée × coefficient tient dans ce temps (sinon la plus courte). Les variantes sont listées dessous avec leur durée pour en prendre une autre. Pas de changement de variante en cours de séance.
- La séance enregistre sa variante (`Session.variant`). Les ajustements genou s'appliquent à la variante choisie (charges de la semaine précédente prises dans la même variante).
- Supersets : série 1 de chaque exercice du groupe sans pause, puis le repos du groupe (le plus long de ses repos), puis la série 2… Un exercice qui a moins de séries sort du tour. Le circuit abdos suit la même logique (un seul groupe, repos entre les tours).
- Abdos enchaînés après push ou pull : `abdosRounds` tours. Abdos seuls : tours du programme abdos.
- Durée réelle = de l'heure de début à la fin (abdos enchaînés compris pour push/pull), comparée à `estimatedMin` dans l'historique. Coefficient de correction : médiane de réel ÷ estimé sur les 8 dernières séances avec variante, en écartant les rapports hors de 0,5–2 ; remise à 1 possible dans les réglages.
- Places de la trame haut du corps repérées par slot et rang (`push:triceps:2`), pas par position : la mémoire « dernier exercice fait à cette place » suit d'une variante à l'autre.
- Remplacement en séance cadrée : alternatives du catalogue d'abord, puis tout le catalogue. La place garde l'exercice prévu (`replaced`) ; la charge cible du programme ne vaut que pour lui ; si le remplaçant ne se mesure pas pareil (durée ↔ reps), la prescription devient 8 à 12 reps ou 30 s.

L'historique est rattaché à l'exercice, pas au slot : si je fais « Rowing haltère » dans le slot Rowing, je retrouve ma dernière perf de « Rowing haltère », peu importe le slot.

## Écrans

### Accueil
- Programme jambes : semaine en cours, séances de la semaine (faites / à faire), bouton pour démarrer la prochaine. Si le check genou du lendemain de la dernière séance jambes n'a pas été rempli, le demander ici.
- Haut du corps : push ou pull proposé, avec la semaine abdos qui suivra.
- Footing : un bouton « Footing fait » et le nombre de footings de la semaine, à titre indicatif.
- Possibilité de choisir une autre séance.

### Séance haut du corps (trame souple)
- La trame (push ou pull) s'affiche slot par slot.
- Pour chaque slot, je choisis l'exercice du jour dans une liste filtrée sur ce slot. L'exercice par défaut est celui que j'ai fait la dernière fois dans ce slot (sinon le `defaultExerciseId`).
- Si l'exercice n'existe pas : bouton « Créer un exercice » directement dans la liste. Il est ajouté au catalogue et à ce slot, et proposé les fois suivantes.
- Je peux aussi ajouter un exercice hors trame, en sauter un, ou changer l'ordre.
- Pour chaque exercice, afficher clairement la dernière séance : date, charge et reps de chaque série.
- Proposer une cible du jour par la double progression : si toutes les séries de la dernière fois ont atteint le haut de la fourchette, charge + incrément et reps visées au bas de la fourchette ; sinon même charge, viser +1 rep sur les séries sous le haut de la fourchette.
- Saisie série par série : charge préremplie avec la cible, boutons +/− ; à la fin de chaque série, j'entre les reps réalisées (boutons rapides autour de la cible) et je valide. La validation lance le chrono de repos.
- Les abdos s'enchaînent à la fin (voir Séance cadrée).

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
- Fin de séance jambes : check genou (douleur pendant, 0 à 10). Le lendemain : question sur le squat unipodal. Afficher le feu (vert / orange / rouge) et l'action associée selon `healthCheck.rules`. Si orange ou rouge, afficher l'ajustement dans la séance jambes suivante (sauts divisés par deux, charges de la semaine précédente, ou pas de sauts).

### Historique
- Liste des séances passées, détail de chaque séance.
- Par exercice : courbe de la meilleure série (charge et reps, ou 1RM estimé), tableau des séances.
- Courbe de la douleur au genou dans le temps.

### Réglages
- Date de début du programme jambes et abdos, planning de la semaine.
- Catalogue d'exercices : voir, modifier, créer, archiver.
- Export / import JSON.

## Priorités de développement

1. Socle : projet, import des fichiers `data/`, base IndexedDB, navigation.
2. Séance haut du corps : choix de l'exercice par slot, création d'exercice, dernière perf, saisie série par série.
3. Chrono de repos avec choix du temps et ajustement de cible.
4. Séances cadrées jambes et abdos, check genou.
5. Historique et courbes.
6. PWA hors ligne, export/import, déploiement.

À chaque étape, l'appli doit fonctionner avant de passer à la suivante. Écrire des tests pour la logique (double progression, ajustement selon le repos, semaine en cours, règles du check genou).
