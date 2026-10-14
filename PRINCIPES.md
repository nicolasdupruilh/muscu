# Principes des programmes

À lire avant toute modification des fichiers `data/programme-*.json`. Les petits ajustements (temps de repos, remplacement d'un exercice par un équivalent, ordre) peuvent être faits directement. Les changements de structure, de volume de sauts ou de progression doivent respecter les règles ci-dessous. En cas de doute, ne pas modifier et le signaler.

## Contexte de l'athlète

- Étudiant, pratique le volley (attaque et contre), musculation en push/pull/legs, une sortie course par semaine.
- Tendinopathie rotulienne au genou droit. Deux poussées, chaque fois au retour du volley (rentrée 2025, puis 13 octobre 2026 : douleur dès les premières attaques, qui s'est atténuée une fois chaud, puis forte gêne et appréhension à la flexion le lendemain). Fait encore ses exercices de kiné.
- A déjà fait en rééducation des réceptions unipodales par séries de 10, de la pliométrie à contacts rapides sur step et des changements de direction. Le niveau de départ de la pliométrie en tient compte.
- Perfs de départ : squat 80 kg 3×5, RDL 80 kg 3×10, leg curl 55 kg 3×10.
- A fait de l'haltérophilie au lycée : maîtrise l'épaulé complet depuis le sol, qui remplace donc la progression hang high pull → hang power clean.
- Disponibilité variable : les séances complètes (environ 2 h) ne sont possibles que moins d'une fois sur deux.
- À Grenoble jusqu'à fin janvier 2027.

## Programme jambes (v4, par phases)

Objectif prioritaire : que le genou supporte les sauts du volley. La détente vient ensuite.

- **Cinq phases sur critères, pas sur le calendrier** : 0 calmer le tendon, 1 charge lente, 2 réceptions et stockage d'énergie, 3 retour au volley, 4 détente. On ne passe à la phase suivante que si la durée minimale est faite et que tous les critères de sortie sont remplis. Ne jamais raccourcir une phase ni assouplir un critère.
- **Ordre de charge du tendon** à respecter : isométriques, charge lente et lourde, réceptions figées basses, réceptions unipodales et contacts rapides, sauts d'attaque sous-maximaux, puis sauts maximaux, depth jumps et volley complet. Une forme de saut ne peut pas apparaître avant sa phase.
- **Le lendemain décide.** La douleur tendineuse baisse une fois échauffé et masque la surcharge : on juge sur le test du lendemain (squat unipodal lent), après les séances jambes ET après le volley.
- **Régression** : lendemain au-dessus de 5/10, ou au-dessus de 2/10 trois fois de suite, retour à la phase précédente.
- **Deux séances complémentaires** : A dominante genou, B dominante hanche (ischios, fessiers, adducteurs, mollets assis). Garder cet équilibre.
- **Volley** : interdit en phases 0 à 2 (ateliers sans saut tolérés en phase 2), puis échelle `volleyLadder` en phase 3. Au plus 2 séances avec sauts par semaine (salle et volley confondus en phase 2), jamais deux jours de suite.
- **Haltéro** : pas d'épaulé en phases 0 et 1 ; hang power clean réception haute en phase 2 ; épaulé complet en phase 3, réception power d'abord.
- **Tendon** : leg extension interdit. Le reverse nordic revient en phase 1 seulement si le lendemain reste à 2/10 ou moins.
- **Phase 4** = blocs force, puissance et pic de l'ancien programme, avec les ajustements volley.

## Variantes par durée

Chaque séance existe en plusieurs variantes (`variants`), de la plus courte à la complète. Règles pour les variantes courtes :
- Garder en priorité : les isométriques et le travail tendon, les sauts clés de la phase (un de réception ou de contacts rapides, un saut principal), l'exercice principal (squat, épaulé, développé, tractions), le travail tendon (reverse nordic, Spanish squat), et les abdos en haut du corps.
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
