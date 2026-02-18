# Révision Permis B – Saisie libre

Application de révision des vérifications du permis de conduire (banque officielle DSR/BRPCE) avec **saisie libre** et **analyse sémantique** des réponses, pour s’entraîner dans des conditions proches de l’examen.

## Fonctionnement

- **Pas de QCM** : vous répondez en saisie libre, comme à l’examen.
- **Analyse par points clés** : la réponse est évaluée en vérifiant la présence des notions importantes (et non une phrase exacte).
- **Retour détaillé** : les points manquants et la réponse type sont affichés pour vous corriger.

## Lancement

```bash
npm start
```

Puis ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Structure des données

Les questions sont dans `data/questions.json`. Chaque question contient :

- `question` : la question posée
- `expectedAnswer` : la réponse de référence
- `keyPoints` : les notions qui doivent apparaître dans une bonne réponse (utilisées pour l’analyse)

Pour ajouter des questions, vous pouvez vous appuyer sur la [banque officielle](https://www.automotoecole-junien.fr/wp-content/uploads/2024/03/banque-verifications-23_01_2023.pdf).
