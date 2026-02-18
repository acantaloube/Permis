# Révision Permis B – Saisie libre

Application de révision des vérifications du permis de conduire (banque officielle DSR/BRPCE) avec **saisie libre** et **analyse sémantique** des réponses, pour s’entraîner dans des conditions proches de l’examen.

## Fonctionnement

- **Pas de QCM** : vous répondez en saisie libre, comme à l’examen.
- **Analyse IA (Gemini)** : sur Netlify, les réponses sont analysées par Gemini pour une évaluation sémantique plus précise.
- **Fallback automatique** : si Gemini est indisponible (quota, erreur), l'app utilise l'analyse par mots-clés. L'app reste 100 % utilisable et gratuite.
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

## Déploiement sur Netlify (avec Gemini)

Pour bénéficier de l'analyse par Gemini :

1. Créez un site Netlify à partir du dépôt GitHub.
2. Dans **Site settings → Environment variables**, ajoutez `GEMINI_API_KEY` avec une clé depuis [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Déployez : Netlify publiera le site statique et la fonction serverless `/.netlify/functions/analyze-gemini`.

Sans clé ou en cas de quota dépassé, l'app utilise automatiquement l'analyse par mots-clés.
