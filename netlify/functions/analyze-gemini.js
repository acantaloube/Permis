const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Netlify serverless function
 * Analyse une réponse de permis avec Gemini et renvoie un score structuré.
 *
 * Input (JSON POST):
 * {
 *   question: string,
 *   expectedAnswer: string,
 *   userAnswer: string
 * }
 *
 * Output (200):
 * {
 *   status: "success" | "partial" | "error",
 *   score: number, // 0-100
 *   found: string[], // notions bien couvertes
 *   missing: string[], // notions manquantes
 *   feedback: string // message texte court
 * }
 *
 * En cas d'erreur (clé manquante, quota, etc.), la fonction renvoie un code 502
 * afin que le frontend puisse faire un fallback sur l'analyse par mots-clés.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GEMINI_API_KEY manquante côté serveur' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Corps de requête invalide' }),
    };
  }

  const { question, expectedAnswer, userAnswer } = payload;

  if (!question || !expectedAnswer || !userAnswer) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Champs requis manquants (question, expectedAnswer, userAnswer)' }),
    };
  }

  const prompt = `
Tu es examinateur du permis de conduire français (vérifications intérieures / extérieures, sécurité routière, premiers secours).
On te donne :
- la question officielle,
- la réponse de référence attendue,
- la réponse d'un élève.

Ton rôle est d'évaluer si la réponse de l'élève est satisfaisante, partielle ou insuffisante.

Contraintes importantes :
- Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.
- Forme du JSON :
{
  "status": "success" | "partial" | "error",
  "score": 0-100,
  "foundConcepts": ["..."],
  "missingConcepts": ["..."],
  "explanation": "phrase courte en français"
}

- "success" : réponse exploitable pour l'examen, l'élève a bien compris.
- "partial" : quelques éléments, mais il manque des points importants.
- "error" : hors sujet ou incomplet.

Question officielle :
"""${question}"""

Réponse attendue (référence) :
"""${expectedAnswer}"""

Réponse de l'élève :
"""${userAnswer}"""
`;

  // Modèles à essayer en ordre (certains peuvent retourner 404 selon la région / le compte)
  const MODELS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-pro',
  ];

  const modelOverride = process.env.GEMINI_MODEL;
  const modelsToTry = modelOverride ? [modelOverride] : MODELS;

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
          encodeURIComponent(GEMINI_API_KEY),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      lastError = { status: response.status, text };
      if (response.status === 404) {
        console.warn(`Modèle ${model} non trouvé (404), essai du suivant`);
        continue;
      }
      console.error('Erreur Gemini HTTP:', response.status, text);
      break;
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const fullText = parts.map((p) => p.text || '').join('\n').trim();

    // Extraire le JSON depuis le texte retourné
    const firstBrace = fullText.indexOf('{');
    const lastBrace = fullText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      console.error('Réponse Gemini sans JSON clair:', fullText);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Réponse Gemini non exploitable' }),
      };
    }

    let parsed;
    try {
      const jsonString = fullText.slice(firstBrace, lastBrace + 1);
      parsed = JSON.parse(jsonString);
    } catch (err) {
      console.error('Erreur parsing JSON Gemini:', err, fullText);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'JSON Gemini invalide' }),
      };
    }

    let { status, score, foundConcepts, missingConcepts, explanation } = parsed;

    if (typeof score !== 'number' || Number.isNaN(score)) {
      score = 0;
    }
    if (!status) {
      if (score >= 70) status = 'success';
      else if (score >= 40) status = 'partial';
      else status = 'error';
    }

    const result = {
      status,
      score,
      found: Array.isArray(foundConcepts) ? foundConcepts : [],
      missing: Array.isArray(missingConcepts) ? missingConcepts : [],
      feedback: explanation || '',
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
    } catch (err) {
      console.error(`Exception avec modèle ${model}:`, err);
      lastError = { error: String(err.message) };
    }
  }

  return {
    statusCode: 502,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Aucun modèle Gemini disponible. Définissez GEMINI_MODEL (ex: gemini-2.0-flash) dans Netlify.',
      details: lastError,
    }),
  };
};

