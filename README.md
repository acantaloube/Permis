# Révision Permis B – Saisie libre

Application de révision des vérifications du permis de conduire (banque officielle DSR/BRPCE) avec **saisie libre** et **analyse sémantique** des réponses, pour s'entraîner dans des conditions proches de l'examen.

## Sommaire

- [Fonctionnement](#fonctionnement)
- [Fonctionnalités](#fonctionnalités)
- [Lancement](#lancement)
- [Structure du projet](#structure-du-projet)
- [Déploiement Netlify (avec Gemini)](#déploiement-netlify-avec-gemini)
- [Configuration Gemini](#configuration-gemini)
- [Dépannage (Troubleshooting)](#dépannage-troubleshooting)

---

## Fonctionnement

- **Pas de QCM** : vous répondez en saisie libre, comme à l'examen.
- **Analyse IA (Gemini)** : en production sur Netlify, les réponses sont analysées par l'API Gemini pour une évaluation contextuelle.
- **Fallback automatique** : si Gemini est indisponible (quota, erreur), l'app utilise l'analyse par mots-clés. L'app reste utilisable à 100 %.
- **Indicateur de source** : le feedback indique « Analyse IA » ou « Mots-clés » selon la méthode utilisée.

## Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| Filtres par catégorie | VI, VE, Sécurité, Secours |
| Saisie libre | Réponse comme à l'examen, pas de QCM |
| Analyse Gemini | Évaluation contextuelle (contexte, reformulation) |
| Analyse mots-clés | Fallback si Gemini échoue |
| Indicateur source | Badge « Analyse IA » ou « Mots-clés » dans le feedback |
| Loading state | Bouton « Vérification… » pendant l'appel API |
| Questions avec images | Zones cliquables pour les vérifications (voir `data/images-config.json`) |

---

## Lancement

```bash
npm start
```

Puis ouvrez [http://localhost:3000](http://localhost:3000).

> **Note** : En local, la fonction Netlify (`/.netlify/functions/analyze-gemini`) n'est pas disponible. L'app utilisera toujours l'analyse par **mots-clés**. Pour tester Gemini, déployez sur Netlify.

> **Exemple Netlify** : [projet test](https://nimble-churros-b2b44c.netlify.app/)

---

## Structure du projet

```
Permis/
├── index.html           # Page principale
├── app.js               # Logique (questions, analyse, UI)
├── styles.css           # Styles
├── data/
│   ├── questions.json   # Banque de questions + keyPoints
│   └── images-config.json  # Images et zones cliquables (VI/VE)
├── netlify/
│   └── functions/
│       └── analyze-gemini.js  # Fonction serverless appelant l'API Gemini
├── netlify.toml         # Config Netlify
└── README.md            # Ce fichier
```

### Données

Chaque question dans `data/questions.json` contient :

- `question` : la question posée
- `expectedAnswer` : la réponse de référence
- `keyPoints` : notions à retrouver dans la réponse (pour l'analyse mots-clés)

---

## Déploiement Netlify (avec Gemini)

1. Créez un site Netlify à partir du dépôt GitHub.
2. Dans **Site settings → Environment variables**, ajoutez :
   - `GEMINI_API_KEY` : clé depuis [Google AI Studio](https://aistudio.google.com/app/apikey)
   - (optionnel) `GEMINI_MODEL` : modèle forcé, ex. `gemini-2.5-flash`
3. Déployez. Netlify publie le site et la fonction `/.netlify/functions/analyze-gemini`.

---

## Configuration Gemini

### Variables d'environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `GEMINI_API_KEY` | Oui | Clé API depuis Google AI Studio |
| `GEMINI_MODEL` | Non | Force un modèle (ex. `gemini-2.5-flash`). Si absente, plusieurs modèles sont essayés. |

### Modèles utilisés (ordre de fallback)

1. `gemini-2.5-flash`
2. `gemini-2.5-flash-lite`
3. `gemini-2.0-flash`
4. `gemini-1.5-flash`
5. `gemini-1.5-pro`

En cas de 404, le modèle suivant est essayé. En cas de 429 (quota), la fonction retente avec des délais (4 s, 8 s, 12 s).

---

## Dépannage (Troubleshooting)

### Toujours « Mots-clés » dans le feedback

**Causes possibles :**

1. **Test en local** : la fonction Netlify n'existe pas localement. Déployez sur Netlify pour tester Gemini.
2. **Clé manquante** : vérifiez que `GEMINI_API_KEY` est définie dans les variables d'environnement Netlify.
3. **Erreurs API** : regardez les logs Netlify (Functions → Logs) pour voir les erreurs.

### Erreur 404 (modèles non trouvés)

Les modèles `gemini-1.5-*` et `gemini-pro` peuvent être dépréciés selon votre compte.

**Solution :** définir `GEMINI_MODEL=gemini-2.5-flash` (ou `gemini-2.0-flash`) dans les variables Netlify.

### Erreur 429 (Too Many Requests)

Le quota gratuit Google AI Studio est d’environ **15 requêtes par minute**.

**Solutions :**
1. Attendre 1 minute avant de refaire une requête.
2. Activer la facturation sur le projet Google Cloud pour augmenter les limites.
3. L’app fait déjà des retries avec délais (4 s, 8 s, 12 s) avant de passer au fallback mots-clés.

### Timeout de la fonction

La fonction peut durer jusqu’à ~30 s en cas de retries 429. Si Netlify timeout (10 s gratuit, 26 s Pro), la fonction est coupée et l’app bascule sur les mots-clés.

**Solution :** réduire les retries ou augmenter le timeout Netlify (plan Pro).

### L’analyse mots-clés donne 100 % trop souvent

L’analyse par mots-clés compare la réponse aux `keyPoints` définis dans `questions.json`. Si la plupart des mots sont présents (même hors contexte), le score est élevé.

**Solution :** la qualité de l’analyse dépend de Gemini. En cas de 429/404, l’app utilise les mots-clés par défaut.

---

## Licence

Projet personnel – Banque officielle DSR/BRPCE.
