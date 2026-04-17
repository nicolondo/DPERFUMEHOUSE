'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface PerfumeResult {
  id: string;
  name: string;
  brand: string;
  image: string | null;
}

const QUESTIONS = [
  {
    id: 'forWhom',
    question: '¿Es para ti o para regalar?',
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
    id: 'clientGender',
    question: '¿El perfume es para...?',
    type: 'choice',
    options: [
      { value: 'masculino', label: 'Hombre', emoji: '🧔' },
      { value: 'femenino', label: 'Mujer', emoji: '👩' },
      { value: 'unisex', label: 'Sin preferencia', emoji: '✨' },
    ],
    showIf: (answers: any) => answers.forWhom === 'self',
  },
  {
    id: 'giftRecipientGender',
    question: '¿El regalo es para...?',
    type: 'choice',
    options: [
      { value: 'masculino', label: 'Hombre', emoji: '🧔' },
      { value: 'femenino', label: 'Mujer', emoji: '👩' },
      { value: 'unisex', label: 'Sin preferencia / No sé', emoji: '✨' },
    ],
    showIf: (answers: any) => answers.forWhom === 'gift',
  },
  {
    id: 'city',
    question: '¿En qué ciudad vives?',
    type: 'city',
    placeholder: 'Escribe tu ciudad...',
  },
  {
    id: 'occasion',
    question: '¿Para qué momento lo quieres?',
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
    question: '¿Tienes algún perfume que te guste mucho?',
    type: 'perfume',
    placeholder: 'Escribe el nombre del perfume...',
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
      { value: 'dulce', label: 'Muy dulce', emoji: '🍬' },
      { value: 'fuerte', label: 'Muy fuerte/penetrante', emoji: '💨' },
      { value: 'floral', label: 'Muy floral', emoji: '🌷' },
      { value: 'viejo', label: '"A viejo" o naftalina', emoji: '🧓' },
      { value: 'alcohol', label: 'Alcoholoso', emoji: '🧪' },
      { value: 'none', label: 'Ninguno en particular', emoji: '✅' },
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
    question: '¿Qué quieres que tu perfume diga de ti?',
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

// --- City Autocomplete Component ---
function CityAutocomplete({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current || !(window as any).google?.maps?.places) return;
    if (autocompleteRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'co' },
      fields: ['formatted_address', 'name', 'address_components'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current!.getPlace();
      if (place?.name) {
        onChange(place.name);
      }
    });
  }, [onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-5 py-4 rounded-2xl bg-[#1a1510]/60 border border-[#8B7355]/20 text-white placeholder:text-white/25 focus:outline-none focus:border-[#8B7355]/60 text-lg"
      autoFocus
    />
  );
}

// --- Perfume Autocomplete Component ---
function PerfumeAutocomplete({ value, onChange, onTyping, placeholder }: { value: string; onChange: (v: string) => void; onTyping: (typing: boolean) => void; placeholder: string }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PerfumeResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setResults([]); setShowDropdown(false); setSearching(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/perfume-search?q=${encodeURIComponent(q)}&limit=6`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setShowDropdown(true);
    } catch { setResults([]); }
    setSearching(false);
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    onChange(text);
    // Signal typing started — block "Siguiente" for 2.5s
    onTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTyping(false), 2500);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 400);
  };

  const selectPerfume = (p: PerfumeResult) => {
    const displayName = `${p.name} - ${p.brand}`;
    setQuery(displayName);
    onChange(displayName);
    setShowDropdown(false);
    onTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); if (typingTimerRef.current) clearTimeout(typingTimerRef.current); }; }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-5 py-4 rounded-2xl bg-[#1a1510]/60 border border-[#8B7355]/20 text-white placeholder:text-white/25 focus:outline-none focus:border-[#8B7355]/60 text-lg"
        autoFocus
        autoComplete="off"
      />
      {searching && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-[#8B7355]/40 border-t-[#8B7355] rounded-full animate-spin" />
        </div>
      )}
      {showDropdown && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#1a1510] border border-[#8B7355]/20 shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPerfume(p)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#8B7355]/10 transition-colors text-left"
            >
              {p.image && (
                <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-white/10 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{p.name}</p>
                <p className="text-white/40 text-xs truncate">{p.brand}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 3 && !searching && showDropdown && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#1a1510] border border-[#8B7355]/20 p-4 text-center text-white/40 text-sm z-50">
          No se encontraron perfumes. Puedes escribir el nombre manualmente.
        </div>
      )}
    </div>
  );
}

export default function QuestionnairePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const catsParam = searchParams.get('cats');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [sellerInfo, setSeller] = useState<{ sellerId: string; sellerName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', phone: '', budget: '' });
  const [error, setError] = useState('');
  const [perfumeTyping, setPerfumeTyping] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const visibleQuestions = QUESTIONS.filter((q) => {
    if (q.showIf) return q.showIf(answers);
    return true;
  });
  const totalSteps = visibleQuestions.length + 2;

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
    // Block while typing perfume name (waiting for autocomplete)
    if (currentQuestion.type === 'perfume' && perfumeTyping) return false;
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
        selectedCategories: catsParam ? catsParam.split(",").map((c: string) => c.trim()).filter(Boolean) : undefined,
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
      <div className="min-h-dvh bg-[#0f0d0a] flex items-center justify-center">
        <div className="animate-pulse text-[#8B7355]/60 text-lg">Cargando...</div>
      </div>
    );
  }

  if (error && !sellerInfo) {
    return (
      <div className="min-h-dvh bg-[#0f0d0a] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <p className="text-white/40 mt-2 text-sm">Verifica el link con tu asesor(a)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0f0d0a] text-white flex flex-col">
      {/* Google Maps Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`}
        onLoad={() => setMapsLoaded(true)}
      />

      {/* Progress bar */}
      {step > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#8B7355] to-[#C4A97D] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Logo — fixed at top */}
      <div className="sticky top-0 z-40 bg-[#0f0d0a] pt-6 pb-4">
        <img src="/logo.svg" alt="D'Perfume House" width={180} className="mx-auto" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        {/* Intro */}
        {step === 0 && (
          <div className="text-center animate-fadeIn space-y-6">
            <h1 className="text-3xl font-light tracking-tight">
              Encuentra tu <span className="text-[#C4A97D] font-medium">perfume ideal</span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed">
              Responde unas preguntas rápidas y te recomendaremos las fragancias perfectas para ti.
            </p>
            <p className="text-white/30 text-sm">Solo toma 2 minutos ⏱️</p>
            <button
              onClick={next}
              className="mt-8 px-10 py-4 bg-gradient-to-r from-[#8B7355] to-[#6B5740] text-white font-semibold rounded-full text-lg hover:from-[#9B8365] hover:to-[#7B6750] transition-all active:scale-95 shadow-lg shadow-[#8B7355]/20"
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
                        ? 'border-[#8B7355] bg-[#8B7355]/10 text-[#C4A97D]'
                        : 'border-white/10 bg-white/5 hover:border-[#8B7355]/30 hover:bg-white/10'
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
                          ? 'border-[#8B7355] bg-[#8B7355]/10 text-[#C4A97D]'
                          : 'border-white/10 bg-white/5 hover:border-[#8B7355]/30'
                      }`}
                    >
                      <span className="mr-3">{isSelected ? '✓' : '○'}</span>
                      {(opt as any).emoji && <span className="mr-2 text-lg">{(opt as any).emoji}</span>}
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
                className="w-full px-5 py-4 rounded-2xl bg-[#1a1510]/60 border border-[#8B7355]/20 text-white placeholder:text-white/25 focus:outline-none focus:border-[#8B7355]/60 text-lg"
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && next()}
                autoFocus
              />
            )}

            {currentQuestion.type === 'city' && mapsLoaded && (
              <CityAutocomplete
                value={answers[currentQuestion.id] || ''}
                onChange={(v) => setAnswer(currentQuestion.id, v)}
                placeholder={currentQuestion.placeholder || ''}
              />
            )}
            {currentQuestion.type === 'city' && !mapsLoaded && (
              <input
                type="text"
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="w-full px-5 py-4 rounded-2xl bg-[#1a1510]/60 border border-[#8B7355]/20 text-white placeholder:text-white/25 focus:outline-none focus:border-[#8B7355]/60 text-lg"
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && next()}
                autoFocus
              />
            )}

            {currentQuestion.type === 'perfume' && (
              <div>
                <PerfumeAutocomplete
                  value={answers[currentQuestion.id] || ''}
                  onChange={(v) => setAnswer(currentQuestion.id, v)}
                  onTyping={setPerfumeTyping}
                  placeholder={currentQuestion.placeholder || ''}
                />
                <button
                  onClick={() => { setAnswer(currentQuestion.id, 'No tengo'); setPerfumeTyping(false); setTimeout(next, 200); }}
                  className="mt-3 text-sm text-white/30 hover:text-white/50 transition-colors underline underline-offset-4"
                >
                  No tengo ninguno en mente
                </button>
              </div>
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
                  className="flex-1 px-6 py-3 rounded-full bg-[#8B7355] text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#9B8365] transition-all active:scale-95"
                >
                  {currentQuestion.type === 'perfume' && perfumeTyping ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Buscando...
                    </span>
                  ) : (
                    'Siguiente →'
                  )}
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
              Déjanos tus datos para enviarte las recomendaciones
            </p>

            <div className="space-y-4">
              <input
                type="text"
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                placeholder="Tu nombre *"
                className="w-full px-5 py-4 rounded-2xl bg-[#1a1510]/60 border border-[#8B7355]/20 text-white placeholder:text-white/25 focus:outline-none focus:border-[#8B7355]/60"
                autoFocus
              />
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                placeholder="Tu email (opcional)"
                className="w-full px-5 py-4 rounded-2xl bg-[#1a1510]/60 border border-[#8B7355]/20 text-white placeholder:text-white/25 focus:outline-none focus:border-[#8B7355]/60"
              />
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                placeholder="Tu WhatsApp *"
                className="w-full px-5 py-4 rounded-2xl bg-[#1a1510]/60 border border-[#8B7355]/20 text-white placeholder:text-white/25 focus:outline-none focus:border-[#8B7355]/60"
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
                          ? 'border-[#8B7355] bg-[#8B7355]/10 text-[#C4A97D]'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-[#8B7355]/30'
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
                className="flex-1 px-6 py-4 rounded-full bg-gradient-to-r from-[#8B7355] to-[#6B5740] text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:from-[#9B8365] hover:to-[#7B6750] transition-all active:scale-95"
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
        /* Google Maps autocomplete dropdown styling */
        .pac-container {
          background: #1a1510 !important;
          border: 1px solid rgba(139, 115, 85, 0.2) !important;
          border-radius: 16px !important;
          margin-top: 8px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5) !important;
          font-family: inherit !important;
          overflow: hidden !important;
        }
        .pac-item {
          border: none !important;
          padding: 12px 16px !important;
          color: #fff !important;
          cursor: pointer !important;
          font-size: 14px !important;
          line-height: 1.4 !important;
        }
        .pac-item:hover {
          background: rgba(139, 115, 85, 0.1) !important;
        }
        .pac-item-query {
          color: #C4A97D !important;
          font-size: 14px !important;
        }
        .pac-matched {
          font-weight: 600 !important;
        }
        .pac-icon { display: none !important; }
        .pac-item span:last-child {
          color: rgba(255,255,255,0.4) !important;
          font-size: 12px !important;
        }
        .pac-logo::after { display: none !important; }
      `}</style>
    </div>
  );
}
