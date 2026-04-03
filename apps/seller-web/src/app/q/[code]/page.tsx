'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const QUESTIONS = [
  {
    id: 'forWhom',
    question: '¿Es para vos o para regalar?',
    type: 'choice',
    options: [
      { value: 'self', label: 'Para mí', emoji: '✨' },
      { value: 'gift', label: 'Para regalar', emoji: '🎁' },
    ],
  },
  {
    id: 'giftRecipient',
    question: '¿A quién le vas a regalar?',
    type: 'text',
    placeholder: 'Ej: Mi mamá, mi novio, una amiga...',
    showIf: (answers: any) => answers.forWhom === 'gift',
  },
  {
    id: 'city',
    question: '¿En qué ciudad vivís?',
    type: 'text',
    placeholder: 'Ej: Bogotá, Medellín, Cali...',
  },
  {
    id: 'occasion',
    question: '¿Para qué momento lo querés?',
    type: 'choice',
    options: [
      { value: 'daily', label: 'Día a día', emoji: '☀️' },
      { value: 'night', label: 'Salidas nocturnas', emoji: '🌙' },
      { value: 'weekend', label: 'Fin de semana', emoji: '🎉' },
      { value: 'versatile', label: 'Todoterreno', emoji: '💫' },
    ],
  },
  {
    id: 'currentPerfume',
    question: '¿Tenés algún perfume que te guste mucho?',
    type: 'text',
    placeholder: 'Ej: Sauvage, Black Opium, Aventus... o "no tengo"',
  },
  {
    id: 'experience',
    question: '¿Cuál experiencia te gusta más?',
    type: 'choice',
    options: [
      { value: 'fresh', label: 'Brisa fresca de montaña', emoji: '🏔️' },
      { value: 'sweet', label: 'Café con panela al amanecer', emoji: '☕' },
      { value: 'floral', label: 'Jardín de flores después de la lluvia', emoji: '🌺' },
      { value: 'woody', label: 'Fogata en el campo', emoji: '🔥' },
      { value: 'exotic', label: 'Mercado de especias', emoji: '🌶️' },
    ],
  },
  {
    id: 'intensity',
    question: '¿Qué tan fuerte te gusta?',
    type: 'choice',
    options: [
      { value: 'light', label: 'Sutil — que solo lo sienta quien se acerque', emoji: '🌸' },
      { value: 'medium', label: 'Equilibrado — que se note sin exagerar', emoji: '⚖️' },
      { value: 'strong', label: 'Intenso — que deje huella al pasar', emoji: '💥' },
    ],
  },
  {
    id: 'dislikes',
    question: '¿Hay olores que no te gustan?',
    type: 'multiChoice',
    options: [
      { value: 'dulce', label: 'Muy dulce' },
      { value: 'fuerte', label: 'Muy fuerte/penetrante' },
      { value: 'floral', label: 'Muy floral' },
      { value: 'viejo', label: '"A viejo" o naftalina' },
      { value: 'alcohol', label: 'Alcoholoso' },
      { value: 'none', label: 'Ninguno en particular' },
    ],
    allowOther: true,
  },
  {
    id: 'style',
    question: '¿Cómo describirías tu estilo?',
    type: 'choice',
    options: [
      { value: 'classic', label: 'Clásico y elegante', emoji: '👔' },
      { value: 'modern', label: 'Moderno y trendy', emoji: '🔮' },
      { value: 'bold', label: 'Atrevido y único', emoji: '⚡' },
      { value: 'relaxed', label: 'Relajado y natural', emoji: '🌿' },
    ],
  },
  {
    id: 'identity',
    question: '¿Qué querés que tu perfume diga de vos?',
    type: 'choice',
    options: [
      { value: 'confidence', label: 'Seguridad y poder', emoji: '👑' },
      { value: 'sensuality', label: 'Sensualidad y misterio', emoji: '🖤' },
      { value: 'freshness', label: 'Frescura y energía', emoji: '💎' },
      { value: 'warmth', label: 'Calidez y cercanía', emoji: '🤗' },
    ],
  },
  {
    id: 'extra',
    question: '¿Algo más que debamos saber?',
    type: 'text',
    placeholder: 'Cualquier detalle adicional... (opcional)',
    optional: true,
  },
];

const BUDGET_OPTIONS = [
  { value: 'under200k', label: 'Menos de $200.000' },
  { value: '200k-350k', label: '$200.000 - $350.000' },
  { value: '350k-500k', label: '$350.000 - $500.000' },
  { value: 'over500k', label: 'Más de $500.000' },
];

export default function QuestionnairePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = intro, 1..N = questions, N+1 = contact, N+2 = loading
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [sellerInfo, setSeller] = useState<{ sellerId: string; sellerName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', phone: '', budget: '' });
  const [error, setError] = useState('');

  // Filter visible questions
  const visibleQuestions = QUESTIONS.filter((q) => {
    if (q.showIf) return q.showIf(answers);
    return true;
  });
  const totalSteps = visibleQuestions.length + 2; // intro + questions + contact

  useEffect(() => {
    fetch(`${API_URL}/leads/questionnaire/${params.code}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setSeller(d.data);
        else if (d.sellerId) setSeller(d);
        else setError('Link inválido');
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [params.code]);

  const currentQuestion = step > 0 && step <= visibleQuestions.length ? visibleQuestions[step - 1] : null;

  const progress = Math.round(((step) / totalSteps) * 100);

  const setAnswer = (id: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (!currentQuestion) return true;
    if (currentQuestion.optional) return true;
    const val = answers[currentQuestion.id];
    if (!val || (typeof val === 'string' && !val.trim())) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  };

  const next = () => {
    if (step <= visibleQuestions.length) {
      setStep((s) => s + 1);
    }
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const submit = async () => {
    if (!contact.name.trim() || !contact.phone.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        clientName: contact.name,
        clientEmail: contact.email || undefined,
        clientPhone: contact.phone,
        clientCity: answers.city,
        answers,
        budgetRange: contact.budget || undefined,
        isForGift: answers.forWhom === 'gift',
        giftRecipient: answers.giftRecipient || undefined,
      };
      const res = await fetch(`${API_URL}/leads/questionnaire/${params.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const leadId = data.data?.leadId || data.leadId;
      if (leadId) {
        router.push(`/q/results/${leadId}`);
      } else {
        setError('Error al enviar');
        setSubmitting(false);
      }
    } catch {
      setError('Error de conexión');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-amber-400/60 text-lg">Cargando...</div>
      </div>
    );
  }

  if (error && !sellerInfo) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <p className="text-white/40 mt-2 text-sm">Verificá el link con tu asesor(a)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0f] text-white flex flex-col">
      {/* Progress bar */}
      {step > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        {/* Intro */}
        {step === 0 && (
          <div className="text-center animate-fadeIn space-y-6">
            <div className="text-5xl mb-4">🌿</div>
            <h1 className="text-3xl font-light tracking-tight">
              Encontrá tu <span className="text-amber-400 font-medium">perfume ideal</span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed">
              Respondé unas preguntas rápidas y te recomendaremos las fragancias perfectas para vos.
            </p>
            <p className="text-white/30 text-sm">Solo toma 2 minutos ⏱️</p>
            <button
              onClick={next}
              className="mt-8 px-10 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-full text-lg hover:from-amber-400 hover:to-amber-500 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
            >
              Empezar
            </button>
            {sellerInfo && (
              <p className="text-white/20 text-xs mt-6">
                Tu asesor(a): {sellerInfo.sellerName}
              </p>
            )}
          </div>
        )}

        {/* Question steps */}
        {currentQuestion && (
          <div className="w-full animate-fadeIn" key={currentQuestion.id}>
            <p className="text-white/30 text-sm mb-2">
              {step} de {visibleQuestions.length}
            </p>
            <h2 className="text-2xl font-light mb-8 leading-snug">
              {currentQuestion.question}
            </h2>

            {currentQuestion.type === 'choice' && (
              <div className="space-y-3">
                {currentQuestion.options!.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setAnswer(currentQuestion.id, opt.value);
                      setTimeout(next, 300);
                    }}
                    className={`w-full text-left px-5 py-4 rounded-2xl border transition-all active:scale-[0.98] ${
                      answers[currentQuestion.id] === opt.value
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <span className="mr-3 text-lg">{(opt as any).emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'multiChoice' && (
              <div className="space-y-3">
                {currentQuestion.options!.map((opt) => {
                  const selected = (answers[currentQuestion.id] || []) as string[];
                  const isSelected = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (opt.value === 'none') {
                          setAnswer(currentQuestion.id, ['none']);
                        } else {
                          const filtered = selected.filter((v) => v !== 'none');
                          setAnswer(
                            currentQuestion.id,
                            isSelected ? filtered.filter((v) => v !== opt.value) : [...filtered, opt.value],
                          );
                        }
                      }}
                      className={`w-full text-left px-5 py-4 rounded-2xl border transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="mr-3">{isSelected ? '✓' : '○'}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'text' && (
              <input
                type="text"
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 text-lg"
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && next()}
                autoFocus
              />
            )}

            {/* Nav buttons */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={prev}
                className="px-6 py-3 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all"
              >
                ← Atrás
              </button>
              {(currentQuestion.type !== 'choice') && (
                <button
                  onClick={next}
                  disabled={!canProceed()}
                  className="flex-1 px-6 py-3 rounded-full bg-amber-500 text-black font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-400 transition-all active:scale-95"
                >
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contact + Budget (final step) */}
        {step === visibleQuestions.length + 1 && (
          <div className="w-full animate-fadeIn space-y-6">
            <h2 className="text-2xl font-light mb-2">¡Casi listo! ✨</h2>
            <p className="text-white/40 text-sm mb-6">
              Dejanos tus datos para enviarte las recomendaciones
            </p>

            <div className="space-y-4">
              <input
                type="text"
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                placeholder="Tu nombre *"
                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50"
                autoFocus
              />
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                placeholder="Tu email (opcional)"
                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50"
              />
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                placeholder="Tu WhatsApp *"
                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50"
              />

              <div>
                <p className="text-white/40 text-sm mb-3">Presupuesto aproximado (opcional)</p>
                <div className="grid grid-cols-2 gap-2">
                  {BUDGET_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setContact((c) => ({ ...c, budget: c.budget === opt.value ? '' : opt.value }))}
                      className={`px-4 py-3 rounded-xl text-sm border transition-all ${
                        contact.budget === opt.value
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={prev}
                className="px-6 py-3 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all"
              >
                ← Atrás
              </button>
              <button
                onClick={submit}
                disabled={!contact.name.trim() || !contact.phone.trim() || submitting}
                className="flex-1 px-6 py-4 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:from-amber-400 hover:to-amber-500 transition-all active:scale-95"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> Analizando...
                  </span>
                ) : (
                  'Ver mis resultados 🌟'
                )}
              </button>
            </div>

            {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
