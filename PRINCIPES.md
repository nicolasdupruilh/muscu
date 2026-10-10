# Principes des programmes

À lire avant toute modification des fichiers `data/programme-*.json`. Les petits ajustements (temps de repos, remplacement d'un exercice par un équivalent, ordre) peuvent être faits directement. Les changements de structure, de volume de sauts ou de progression doivent respecter les règles ci-dessous. En cas de doute, ne pas modifier et le signaler.

## Contexte de l'athlète

- Étudiant, pratique le volley (attaque et contre), musculation en push/pull/legs, une sortie course par semaine.
- Antécédent de tendinopathie rotulienne au genou droit, avec une rechute à la reprise du volley. Douleur actuelle 0/10, fait encore ses exercices de kiné.
- A déjà fait en rééducation des réceptions unipodales par séries de 10, de la pliométrie à contacts rapides sur step et des changements de direction. Le niveau de départ de la pliométrie en tient compte.
- Perfs de départ : squat 80 kg 3×5, RDL 80 kg 3×10, leg curl 55 kg 3×10.
- A fait de l'haltérophilie au lycée : maîtrise l'épaulé complet depuis le sol, qui remplace donc la progression hang high pull → hang power clean.
- Disponibilité variable : les séances complètes (environ 2 h) ne sont possibles que moins d'une fois sur deux.
- Programme jambes sur 16 semaines, jusqu'à fin janvier 2027.

## Programme jambes

Objectif : améliorer la détente (attaque et contre) en gardant le tendon rotulien en bonne santé.

- **Deux séances complémentaires.** A est dominante genou (sauts, squat, fente bulgare, reverse nordic, mollets). B est dominante hanche (haltéro, trap bar, RDL, hip thrust, leg curl, adducteurs). Ischios, fessiers et adducteurs sont donc travaillés en B. Garder cet équilibre si on déplace un exercice.
- **Quatre blocs de 4 semaines**, la 4e semaine de chaque bloc est allégée (une série de moins sur les sauts et le squat). Bloc 1 base tendon, bloc 2 force, bloc 3 puissance, bloc 4 pic.
- **Tendon.** Le squat est lent au bloc 1 (descente 3 s) car la charge lente est ce qui renforce le tendon. Le reverse nordic remplace le leg extension, qui est interdit et ne doit jamais être proposé. Spanish squat isométrique à l'échauffement.
- **Pliométrie, ordre de difficulté** à respecter : contacts rapides de faible amplitude (pogos, sauts latéraux), réceptions contrôlées (y compris unipodales), sauts verticaux avec élan, puis sauts avec chute (depth jumps 30 puis 40 cm) et bonds unipodaux enchaînés. Ne pas avancer une forme plus intense dans un bloc antérieur.
- **Volume de sauts** : augmenter le nombre de contacts de 10 à 20 % maximum d'une semaine à l'autre. Les sauts se font toujours en début de séance, frais, avec un repos suffisant pour garder la qualité.
- **Check genou** : douleur pendant la séance et le lendemain (squat unipodal), règles vert/orange/rouge dans `healthCheck`. Ces règles ne doivent pas être assouplies.
- **Volley** : quand les entraînements reprennent, la pliométrie baisse (voir `volleyAdjustments`), pas de séance jambes la veille d'un match.

## Variantes par durée

Chaque séance existe en plusieurs variantes (`variants`), de la plus courte à la complète. Règles pour les variantes courtes :
- Garder en priorité : les sauts clés du bloc (un de réception ou de contacts rapides, un saut principal), l'exercice principal (squat, épaulé, développé, tractions), le travail tendon (reverse nordic, Spanish squat), et les abdos en haut du corps.
- Réduire d'abord le nombre de séries des accessoires, puis utiliser des supersets, puis retirer les exercices redondants (ex. trap bar quand l'épaulé et le RDL sont déjà là). Le traîneau n'existe que dans les séances complètes.
- Ne jamais augmenter l'intensité d'un exercice pour compenser le temps perdu.
- `estimatedMin` est une estimation calibrée sur un retour réel (séance B complète sans traîneau ≈ 2 h). Recalibrer si les durées réelles s'en écartent.

## Haut du corps

- Trame fixe (push, pull) avec des slots ; l'exercice de chaque slot est libre.
- Progression par double progression, définie dans le fichier.

## Abdos

- Circuit d'environ 8 à 12 min (2 tours en variante 1 h, 3 en complète) en fin de push et de pull. Quatre fonctions à garder dans chaque bloc : anti-extension, bas du ventre, anti-rotation ou latéral, puissance en rotation (frappe au volley).

## Modifier un programme

- Incrémenter `version` et ajouter une ligne dans `changelog`.
- Ne jamais modifier l'historique déjà enregistré dans l'appli : une séance faite garde ce qui était prescrit au moment où elle a été faite.
