/**
 * Révision Permis B - Saisie libre avec analyse sémantique
 * Basé sur la banque de vérifications officielle
 */

// État de l'application
let questions = [];
let filteredQuestions = [];
let currentIndex = 0;
let currentCategory = 'all';

// Charger les questions
async function loadQuestions() {
  try {
    const res = await fetch('data/questions.json');
    const data = await res.json();
    questions = data.questions;
    applyCategoryFilter();
  } catch (err) {
    console.error('Erreur chargement questions:', err);
    questions = [];
  }
}

function applyCategoryFilter() {
  if (currentCategory === 'all') {
    filteredQuestions = [...questions];
  } else {
    filteredQuestions = questions.filter(q => q.category === currentCategory);
  }
  currentIndex = Math.min(currentIndex, Math.max(0, filteredQuestions.length - 1));
  render();
}

// Normalisation du texte pour la comparaison
function normalize(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Vérifier si un point clé est présent dans la réponse
function keyPointInAnswer(keyPoint, answerNorm) {
  const kp = normalize(keyPoint);
  if (!kp) return false;
  // Match direct (le point clé ou la réponse contient l'autre)
  if (answerNorm.includes(kp)) return true;
  // Si le point clé contient plusieurs mots, vérifier qu'au moins 70% sont présents
  const words = kp.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return false;
  const found = words.filter(w => answerNorm.includes(w)).length;
  return found >= Math.ceil(words.length * 0.7);
}

// Analyser la réponse par rapport aux points clés
function analyzeAnswer(userAnswer, question) {
  const keyPoints = question.keyPoints || [];
  const answerNorm = normalize(userAnswer);

  if (keyPoints.length === 0) {
    return {
      score: userAnswer.trim().length > 10 ? 100 : 0,
      found: [],
      missing: [],
      status: 'success',
      source: 'keywords',
    };
  }

  const found = [];
  const missing = [];

  for (const kp of keyPoints) {
    if (keyPointInAnswer(kp, answerNorm)) {
      found.push(kp);
    } else {
      missing.push(kp);
    }
  }

  const score = Math.round((found.length / keyPoints.length) * 100);
  let status = 'error';
  if (score >= 70) status = 'success';
  else if (score >= 40) status = 'partial';

  return { score, found, missing, status, source: 'keywords' };
}

// Analyse distante via Gemini (via fonction serverless Netlify)
async function analyzeWithGemini(userAnswer, question) {
  // On ne tente l'appel que si l'environnement Netlify est présent côté prod.
  // En local (npm start) ou si la fonction n'existe pas, on retournera null
  // pour déclencher le fallback mots-clés.
  try {
    const response = await fetch('/.netlify/functions/analyze-gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question.question,
        expectedAnswer: question.expectedAnswer,
        userAnswer,
      }),
    });

    if (!response.ok) {
      // Erreurs HTTP (fonction absente, quota, etc.) → fallback
      console.error('Erreur HTTP analyse Gemini:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data || typeof data !== 'object') return null;

    const status = data.status || 'error';
    const score = typeof data.score === 'number' ? data.score : 0;
    const found = Array.isArray(data.found) ? data.found : [];
    const missing = Array.isArray(data.missing) ? data.missing : [];

    return { status, score, found, missing, source: 'gemini' };
  } catch (err) {
    console.error('Exception lors de analyzeWithGemini:', err);
    return null;
  }
}

function renderFeedback(result, question) {
  const feedback = document.getElementById('feedback');
  const content = document.getElementById('feedbackContent');
  feedback.className = 'feedback ' + result.status;

  const sourceLabel = result.source === 'gemini' ? 'Analyse IA' : 'Mots-clés';
  const sourceClass = result.source === 'gemini' ? 'source-gemini' : 'source-keywords';

  let html = `<span class="feedback-source ${sourceClass}">${sourceLabel}</span>`;

  if (result.status === 'success') {
    html += `
      <h3>✓ Bonne réponse</h3>
      <p>Vous avez bien mentionné les points essentiels.</p>
    `;
  } else if (result.status === 'partial') {
    html += `
      <h3>~ Réponse incomplète (${result.score}%)</h3>
      <p>Points manquants à mentionner :</p>
      <ul>
        ${result.missing.map(m => `<li><strong>${m}</strong></li>`).join('')}
      </ul>
      <p>Points correctement identifiés : ${result.found.join(', ')}</p>
    `;
  } else {
    html += `
      <h3>✗ Réponse à améliorer (${result.score}%)</h3>
      <p>Les points suivants devaient être mentionnés :</p>
      <ul>
        ${result.missing.map(m => `<li><strong>${m}</strong></li>`).join('')}
      </ul>
      ${result.found.length > 0 ? `<p>Points corrects : ${result.found.join(', ')}</p>` : ''}
    `;
  }

  html += `
    <div class="expected-answer">
      <strong>Réponse type attendue :</strong>
      ${question.expectedAnswer}
    </div>
  `;

  content.innerHTML = html;
  feedback.classList.remove('hidden');
}

function hideFeedback() {
  const feedback = document.getElementById('feedback');
  feedback.classList.add('hidden');
  feedback.className = 'feedback hidden';
}

function showQuestion(index) {
  if (filteredQuestions.length === 0) {
    document.getElementById('questionText').textContent = 'Aucune question disponible.';
    document.getElementById('answerForm').style.display = 'none';
    return;
  }

  const q = filteredQuestions[index];
  document.getElementById('categoryBadge').textContent = q.category;
  document.getElementById('categoryBadge').className = 'category-badge ' + q.category;
  document.getElementById('questionText').textContent = q.question;
  document.getElementById('answerInput').value = '';
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = false;
  submitBtn.classList.remove('loading');
  submitBtn.textContent = 'Vérifier ma réponse';

  document.getElementById('progressFill').style.width =
    `${((index + 1) / filteredQuestions.length) * 100}%`;
  document.getElementById('progressText').textContent =
    `${index + 1} / ${filteredQuestions.length}`;

  document.getElementById('prevBtn').disabled = index <= 0;
  document.getElementById('nextBtn').disabled = index >= filteredQuestions.length - 1;

  hideFeedback();
  document.getElementById('answerInput').focus();
}

function render() {
  showQuestion(currentIndex);
}

// Événements
document.getElementById('answerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('answerInput');
  const answer = input.value.trim();

  if (!answer) {
    input.focus();
    return;
  }

  const q = filteredQuestions[currentIndex];
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  submitBtn.textContent = 'Vérification…';

  // 1. Tentative avec Gemini (si disponible en prod Netlify)
  let result = await analyzeWithGemini(answer, q);

  // 2. Fallback automatique sur l'analyse par mots-clés
  if (!result) {
    result = analyzeAnswer(answer, q);
  }

  submitBtn.classList.remove('loading');
  submitBtn.textContent = 'Vérifier ma réponse';
  renderFeedback(result, q);
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    render();
  }
});

document.getElementById('nextBtn').addEventListener('click', () => {
  if (currentIndex < filteredQuestions.length - 1) {
    currentIndex++;
    render();
  }
});

document.getElementById('randomBtn').addEventListener('click', () => {
  if (filteredQuestions.length <= 1) return;
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * filteredQuestions.length);
  } while (newIndex === currentIndex && filteredQuestions.length > 1);
  currentIndex = newIndex;
  render();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    currentIndex = 0;
    applyCategoryFilter();
  });
});

// Raccourcis clavier
document.addEventListener('keydown', (e) => {
  if (e.target.matches('textarea')) return;
  if (e.key === 'ArrowLeft') {
    document.getElementById('prevBtn').click();
  } else if (e.key === 'ArrowRight') {
    document.getElementById('nextBtn').click();
  }
});

// Init
loadQuestions().then(render);
