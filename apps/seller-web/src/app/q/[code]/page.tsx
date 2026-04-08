'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ─── Translations ───

type Lang = 'es' | 'en';

const t = {
  es: {
    loading: 'Cargando...',
    invalidLink: 'Link inválido',
    checkLink: 'Verifica el link con tu asesor(a)',
    connectionError: 'Error de conexión',
    submitError: 'Error al enviar',
    introTitle1: 'Encuentra tu ',
    introTitle2: 'perfume ideal',
    introDesc: 'Responde unas preguntas rápidas y te recomendaremos las fragancias perfectas para ti.',
    introTime: 'Solo toma 2 minutos',
    start: 'Empezar',
    yourAdvisor: 'Tu asesor(a):',
    back: '← Atrás',
    next: 'Siguiente →',
    contactTitle: '¡Casi listo!',
    contactDesc: 'Déjanos tus datos para enviarte las recomendaciones',
    yourName: 'Tu nombre *',
    yourEmail: 'Tu email (opcional)',
    yourWhatsApp: 'Tu WhatsApp *',
    budgetLabel: 'Presupuesto aproximado (opcional)',
    analyzing: 'Analizando...',
    analyzingTitle: 'Creando tu reporte personalizado',
    analyzingDesc: 'Estamos analizando tus respuestas para encontrar las fragancias ideales para ti. Esto puede tomar un momento.',
    analyzingTip: 'Nuestro experto en fragancias está trabajando en tu perfil...',
    seeResults: 'Ver mis resultados',
    questionOf: (s: number, total: number) => `${s} de ${total}`,
  },
  en: {
    loading: 'Loading...',
    invalidLink: 'Invalid link',
    checkLink: 'Check the link with your advisor',
    connectionError: 'Connection error',
    submitError: 'Error submitting',
    introTitle1: 'Find your ',
    introTitle2: 'ideal perfume',
    introDesc: 'Answer a few quick questions and we\'ll recommend the perfect fragrances for you.',
    introTime: 'Takes only 2 minutes',
    start: 'Start',
    yourAdvisor: 'Your advisor:',
    back: '← Back',
    next: 'Next →',
    contactTitle: 'Almost done!',
    contactDesc: 'Leave your details so we can send you the recommendations',
    yourName: 'Your name *',
    yourEmail: 'Your email (optional)',
    yourWhatsApp: 'Your WhatsApp *',
    budgetLabel: 'Approximate budget (optional)',
    analyzing: 'Analyzing...',
    analyzingTitle: 'Creating your personalized report',
    analyzingDesc: 'We\'re analyzing your answers to find the ideal fragrances for you. This may take a moment.',
    analyzingTip: 'Our fragrance expert is working on your profile...',
    seeResults: 'See my results',
    questionOf: (s: number, total: number) => `${s} of ${total}`,
  },
};

// ─── Questions (bilingual) ───

interface QuestionOption { value: string; label: string; labelEn?: string; emoji?: string; }

interface Question {
  id: string;
  question: string;
  questionEn: string;
  type: 'choice' | 'multiChoice' | 'text';
  options?: QuestionOption[];
  placeholder?: string;
  placeholderEn?: string;
  optional?: boolean;
  allowOther?: boolean;
  showIf?: (answers: any) => boolean;
}

const isGift = (a: any) => a.forWhom === 'gift';
const isSelf = (a: any) => a.forWhom !== 'gift';

const QUESTIONS: Question[] = [
  // ─── Shared: first question ───
  {
    id: 'forWhom', question: '¿Es para ti o para regalar?', questionEn: 'Is it for you or a gift?', type: 'choice',
    options: [
      { value: 'self', label: 'Para mí', labelEn: 'For me', emoji: '✨' },
      { value: 'gift', label: 'Para regalar', labelEn: 'As a gift', emoji: '🎁' },
    ],
  },

  // ─── SELF flow ───
  {
    id: 'age', question: '¿Cuántos años tienes?', questionEn: 'How old are you?', type: 'choice',
    showIf: isSelf,
    options: [
      { value: '18-25', label: '18 – 25', emoji: '🧑' },
      { value: '26-35', label: '26 – 35', emoji: '💼' },
      { value: '36-45', label: '36 – 45', emoji: '🌟' },
      { value: '46-55', label: '46 – 55', emoji: '👔' },
      { value: '55+', label: '55+', emoji: '🎩' },
    ],
  },

  // ─── GIFT flow: recipient info ───
  {
    id: 'giftRecipient', question: '¿A quién le vas a regalar?', questionEn: 'Who is the gift for?', type: 'choice',
    showIf: isGift,
    options: [
      { value: 'pareja', label: 'Mi pareja', labelEn: 'My partner', emoji: '💕' },
      { value: 'mama_papa', label: 'Mi mamá / papá', labelEn: 'My mom / dad', emoji: '👩' },
      { value: 'amigo', label: 'Un amigo / amiga', labelEn: 'A friend', emoji: '🧑‍🤝‍🧑' },
      { value: 'familiar', label: 'Un familiar', labelEn: 'A family member', emoji: '👨‍👩‍👦' },
      { value: 'colega', label: 'Un colega', labelEn: 'A colleague', emoji: '💼' },
      { value: 'otro', label: 'Otra persona', labelEn: 'Someone else', emoji: '🎁' },
    ],
  },
  {
    id: 'giftRecipientGender', question: '¿Es hombre o mujer?', questionEn: 'Is the recipient male or female?', type: 'choice',
    showIf: isGift,
    options: [
      { value: 'masculino', label: 'Hombre', labelEn: 'Male', emoji: '👨' },
      { value: 'femenino', label: 'Mujer', labelEn: 'Female', emoji: '👩' },
      { value: 'no_decir', label: 'Prefiero no decir', labelEn: 'Prefer not to say', emoji: '✨' },
    ],
  },
  {
    id: 'giftRecipientAge', question: '¿Qué edad tiene aproximadamente?', questionEn: 'How old are they approximately?', type: 'choice',
    showIf: isGift,
    options: [
      { value: '18-25', label: '18 – 25', emoji: '🧑' },
      { value: '26-35', label: '26 – 35', emoji: '💼' },
      { value: '36-45', label: '36 – 45', emoji: '🌟' },
      { value: '46-55', label: '46 – 55', emoji: '👔' },
      { value: '55+', label: '55+', emoji: '🎩' },
    ],
  },

  // ─── Shared: city (text adapts) ───
  {
    id: 'city', question: '¿En qué ciudad vives?', questionEn: 'What city do you live in?', type: 'text',
    placeholder: 'Escribe tu ciudad...', placeholderEn: 'Type your city...',
  },

  // ─── GIFT flow: gift occasion ───
  {
    id: 'giftOccasion', question: '¿Cuál es la ocasión del regalo?', questionEn: 'What\'s the gift occasion?', type: 'choice',
    showIf: isGift,
    options: [
      { value: 'cumpleanos', label: 'Cumpleaños', labelEn: 'Birthday', emoji: '🎂' },
      { value: 'aniversario', label: 'Aniversario', labelEn: 'Anniversary', emoji: '💍' },
      { value: 'dia_madre', label: 'Día de la Madre', labelEn: 'Mother\'s Day', emoji: '🌷' },
      { value: 'navidad', label: 'Navidad', labelEn: 'Christmas', emoji: '🎄' },
      { value: 'san_valentin', label: 'San Valentín', labelEn: 'Valentine\'s Day', emoji: '❤️' },
      { value: 'graduacion', label: 'Graduación', labelEn: 'Graduation', emoji: '🎓' },
      { value: 'sin_ocasion', label: 'Sin ocasión especial', labelEn: 'No special occasion', emoji: '✨' },
      { value: 'otro_dia', label: 'Otro día especial', labelEn: 'Another special day', emoji: '🎉' },
    ],
  },

  // ─── GIFT flow: recipient's perfume ───
  {
    id: 'giftRecipientPerfume', question: '¿Sabes si tiene algún perfume favorito?', questionEn: 'Do you know if they have a favorite perfume?', type: 'text',
    placeholder: 'Ej: Sauvage, Black Opium...', placeholderEn: 'E.g. Sauvage, Black Opium...',
    showIf: isGift, optional: true,
  },

  // ─── Shared: occasion (text adapts for gift) ───
  {
    id: 'occasion', question: '¿Para qué momento lo quieres?', questionEn: 'What occasion is it for?', type: 'choice',
    options: [
      { value: 'daily', label: 'Día a día', labelEn: 'Everyday', emoji: '☀️' },
      { value: 'night', label: 'Salidas nocturnas', labelEn: 'Night out', emoji: '🌙' },
      { value: 'weekend', label: 'Fin de semana', labelEn: 'Weekend', emoji: '🎉' },
      { value: 'versatile', label: 'Todoterreno', labelEn: 'All-around', emoji: '💫' },
    ],
  },

  // ─── SELF flow: own perfume ───
  {
    id: 'currentPerfume', question: '¿Tienes algún perfume que te guste mucho?', questionEn: 'Do you have a perfume you really like?', type: 'text',
    placeholder: 'Ej: Sauvage, Black Opium, Aventus...', placeholderEn: 'E.g. Sauvage, Black Opium, Aventus...',
    showIf: isSelf, optional: true,
  },

  // ─── SELF flow: experience ───
  {
    id: 'experience', question: '¿Cuál experiencia te gusta más?', questionEn: 'Which experience do you prefer?', type: 'choice',
    showIf: isSelf,
    options: [
      { value: 'fresh', label: 'Brisa fresca de montaña', labelEn: 'Cool mountain breeze', emoji: '🏔️' },
      { value: 'sweet', label: 'Café con panela al amanecer', labelEn: 'Coffee at sunrise', emoji: '☕' },
      { value: 'floral', label: 'Jardín de flores después de la lluvia', labelEn: 'Flower garden after rain', emoji: '🌺' },
      { value: 'woody', label: 'Fogata en el campo', labelEn: 'Campfire in the country', emoji: '🔥' },
      { value: 'exotic', label: 'Mercado de especias', labelEn: 'Spice market', emoji: '🌶️' },
      { value: 'oceanic', label: 'Brisa del mar al atardecer', labelEn: 'Ocean breeze at sunset', emoji: '🌊' },
      { value: 'gourmand', label: 'Postre recién sacado del horno', labelEn: 'Freshly baked dessert', emoji: '🍰' },
    ],
  },

  // ─── GIFT flow: experience for recipient ───
  {
    id: 'giftExperience', question: '¿Qué tipo de fragancia crees que le gustaría?', questionEn: 'What type of fragrance do you think they\'d like?', type: 'choice',
    showIf: isGift,
    options: [
      { value: 'fresh', label: 'Brisa fresca de montaña', labelEn: 'Cool mountain breeze', emoji: '🏔️' },
      { value: 'sweet', label: 'Café con panela al amanecer', labelEn: 'Coffee at sunrise', emoji: '☕' },
      { value: 'floral', label: 'Jardín de flores después de la lluvia', labelEn: 'Flower garden after rain', emoji: '🌺' },
      { value: 'woody', label: 'Fogata en el campo', labelEn: 'Campfire in the country', emoji: '🔥' },
      { value: 'exotic', label: 'Mercado de especias', labelEn: 'Spice market', emoji: '🌶️' },
      { value: 'oceanic', label: 'Brisa del mar al atardecer', labelEn: 'Ocean breeze at sunset', emoji: '🌊' },
      { value: 'gourmand', label: 'Postre recién sacado del horno', labelEn: 'Freshly baked dessert', emoji: '🍰' },
      { value: 'no_se', label: 'No sé / No estoy seguro', labelEn: 'I don\'t know / Not sure', emoji: '🤷' },
    ],
  },

  // ─── SELF flow: intensity ───
  {
    id: 'intensity', question: '¿Qué tan fuerte te gusta?', questionEn: 'How strong do you like it?', type: 'choice',
    showIf: isSelf,
    options: [
      { value: 'light', label: 'Sutil — que solo lo sienta quien se acerque', labelEn: 'Subtle — only noticeable up close', emoji: '🌸' },
      { value: 'medium', label: 'Equilibrado — que se note sin exagerar', labelEn: 'Balanced — noticeable but not overdone', emoji: '⚖️' },
      { value: 'strong', label: 'Intenso — que deje huella al pasar', labelEn: 'Intense — leaves a trail', emoji: '💥' },
    ],
  },

  // ─── GIFT flow: intensity for recipient ───
  {
    id: 'giftIntensity', question: '¿Qué tan fuerte debería ser?', questionEn: 'How strong should it be?', type: 'choice',
    showIf: isGift,
    options: [
      { value: 'light', label: 'Sutil — que solo lo sienta quien se acerque', labelEn: 'Subtle — only noticeable up close', emoji: '🌸' },
      { value: 'medium', label: 'Equilibrado — que se note sin exagerar', labelEn: 'Balanced — noticeable but not overdone', emoji: '⚖️' },
      { value: 'strong', label: 'Intenso — que deje huella al pasar', labelEn: 'Intense — leaves a trail', emoji: '💥' },
      { value: 'no_se', label: 'No sé', labelEn: 'I don\'t know', emoji: '🤷' },
    ],
  },

  // ─── SELF flow: personal questions ───
  {
    id: 'dislikes', question: '¿Hay olores que no te gustan?', questionEn: 'Are there any scents you dislike?', type: 'multiChoice', allowOther: true,
    showIf: isSelf,
    options: [
      { value: 'dulce', label: 'Muy dulce', labelEn: 'Too sweet' },
      { value: 'fuerte', label: 'Muy fuerte/penetrante', labelEn: 'Too strong/overpowering' },
      { value: 'floral', label: 'Muy floral', labelEn: 'Too floral' },
      { value: 'viejo', label: '"A viejo" o naftalina', labelEn: '"Old-fashioned" or mothball-like' },
      { value: 'alcohol', label: 'Alcoholoso', labelEn: 'Alcohol-heavy' },
      { value: 'none', label: 'Ninguno en particular', labelEn: 'None in particular' },
    ],
  },
  {
    id: 'style', question: '¿Cómo describirías tu estilo?', questionEn: 'How would you describe your style?', type: 'choice',
    showIf: isSelf,
    options: [
      { value: 'classic', label: 'Clásico y elegante', labelEn: 'Classic & elegant', emoji: '👔' },
      { value: 'modern', label: 'Moderno y trendy', labelEn: 'Modern & trendy', emoji: '🔮' },
      { value: 'bold', label: 'Atrevido y único', labelEn: 'Bold & unique', emoji: '⚡' },
      { value: 'relaxed', label: 'Relajado y natural', labelEn: 'Relaxed & natural', emoji: '🌿' },
    ],
  },
  {
    id: 'identity', question: '¿Qué quieres que tu perfume diga de ti?', questionEn: 'What do you want your perfume to say about you?', type: 'choice',
    showIf: isSelf,
    options: [
      { value: 'confidence', label: 'Seguridad y poder', labelEn: 'Confidence & power', emoji: '👑' },
      { value: 'sensuality', label: 'Sensualidad y misterio', labelEn: 'Sensuality & mystery', emoji: '🖤' },
      { value: 'freshness', label: 'Frescura y energía', labelEn: 'Freshness & energy', emoji: '💎' },
      { value: 'warmth', label: 'Calidez y cercanía', labelEn: 'Warmth & closeness', emoji: '🤗' },
    ],
  },
  {
    id: 'hobbyWeekend', question: '¿Qué te gusta hacer en tu tiempo libre?', questionEn: 'What do you enjoy doing in your free time?', type: 'choice',
    showIf: isSelf,
    options: [
      { value: 'outdoors', label: 'Naturaleza y aire libre', labelEn: 'Nature & outdoors', emoji: '🏕️' },
      { value: 'social', label: 'Salir con amigos o pareja', labelEn: 'Going out with friends or partner', emoji: '🥂' },
      { value: 'fitness', label: 'Deporte y bienestar', labelEn: 'Sports & wellness', emoji: '🏋️' },
      { value: 'culture', label: 'Arte, música o lectura', labelEn: 'Art, music or reading', emoji: '🎨' },
      { value: 'home', label: 'Netflix y relax en casa', labelEn: 'Netflix & relaxing at home', emoji: '🛋️' },
    ],
  },
  {
    id: 'dresscode', question: '¿Cómo te vistes un sábado en la noche?', questionEn: 'How do you dress on a Saturday night?', type: 'choice',
    showIf: isSelf,
    options: [
      { value: 'formal', label: 'Elegante — traje o vestido', labelEn: 'Elegant — suit or dress', emoji: '🥻' },
      { value: 'smart', label: 'Arreglado casual — jeans buenos y blazer', labelEn: 'Smart casual — nice jeans & blazer', emoji: '🧥' },
      { value: 'casual', label: 'Relajado — lo que me sienta bien', labelEn: 'Casual — whatever feels right', emoji: '👟' },
      { value: 'bold', label: 'Llamativo — me gusta que me miren', labelEn: 'Eye-catching — I like to be noticed', emoji: '🔥' },
    ],
  },

  // ─── GIFT flow: recipient personality ───
  {
    id: 'giftRecipientStyle', question: '¿Cómo describirías su personalidad?', questionEn: 'How would you describe their personality?', type: 'choice',
    showIf: isGift,
    options: [
      { value: 'classic', label: 'Clásico/a y elegante', labelEn: 'Classic & elegant', emoji: '👔' },
      { value: 'modern', label: 'Moderno/a y trendy', labelEn: 'Modern & trendy', emoji: '🔮' },
      { value: 'bold', label: 'Atrevido/a y único/a', labelEn: 'Bold & unique', emoji: '⚡' },
      { value: 'relaxed', label: 'Relajado/a y natural', labelEn: 'Relaxed & natural', emoji: '🌿' },
    ],
  },

  // ─── Shared: extra (text adapts for gift) ───
  {
    id: 'extra', question: '¿Algo más que debamos saber?', questionEn: 'Anything else we should know?', type: 'text',
    placeholder: 'Cualquier detalle adicional... (opcional)', placeholderEn: 'Any additional details... (optional)', optional: true,
  },
];

const BUDGET_OPTIONS = [
  { value: 'under200k', label: 'Menos de $200.000', labelEn: 'Under $200.000' },
  { value: '200k-350k', label: '$200.000 - $350.000' },
  { value: '350k-500k', label: '$350.000 - $500.000' },
  { value: 'over500k', label: 'Más de $500.000', labelEn: 'Over $500.000' },
];

const getQ = (q: Question, lang: Lang, answers: Record<string, any>) => {
  const isGiftMode = answers.forWhom === 'gift';
  // Adapt shared question texts for gift flow
  if (isGiftMode) {
    if (q.id === 'city') return lang === 'en' ? 'What city do they live in?' : '¿En qué ciudad vive?';
    if (q.id === 'occasion') return lang === 'en' ? 'When would they use it?' : '¿Para qué momento lo usaría?';
    if (q.id === 'extra') return lang === 'en' ? 'Anything else we should know about this person?' : '¿Algo más que debamos saber de esta persona?';
  }
  return lang === 'en' ? q.questionEn : q.question;
};
const getP = (q: Question, lang: Lang, answers?: Record<string, any>) => {
  const isGiftMode = answers?.forWhom === 'gift';
  if (isGiftMode) {
    if (q.id === 'city') return lang === 'en' ? 'Type their city...' : 'Escribe su ciudad...';
    if (q.id === 'extra') return lang === 'en' ? 'Any details about them... (optional)' : 'Cualquier detalle sobre esta persona... (opcional)';
  }
  return lang === 'en' ? (q.placeholderEn || q.placeholder) : q.placeholder;
};
const getOpt = (opt: QuestionOption, lang: Lang) => (lang === 'en' && opt.labelEn) ? opt.labelEn : opt.label;

// ─── Component ───

export default function QuestionnairePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCategories = searchParams.get('cats')?.split(',').map(c => decodeURIComponent(c.trim())).filter(Boolean) || null;
  const [lang, setLang] = useState<Lang>('es');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [sellerInfo, setSeller] = useState<{ sellerId: string; sellerName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contact, setContact] = useState({ name: '', email: '', phone: '', phoneCode: '+57', budget: '' });
  const [showPhoneCodePicker, setShowPhoneCodePicker] = useState(false);
  const [error, setError] = useState('');

  // Perfume autocomplete
  const [perfumeResults, setPerfumeResults] = useState<{ id: string; name: string; brand: string; image: string | null }[]>([]);
  const [perfumeLoading, setPerfumeLoading] = useState(false);
  const [showPerfumeDropdown, setShowPerfumeDropdown] = useState(false);
  const perfumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const perfumeDropdownRef = useRef<HTMLDivElement>(null);

  // City autocomplete (Google Places)
  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityAutocompleteRef = useRef<any>(null);
  const [gmapsLoaded, setGmapsLoaded] = useState(false);

  const i = t[lang];

  const searchPerfumes = useCallback((query: string) => {
    if (perfumeTimeout.current) clearTimeout(perfumeTimeout.current);
    if (!query || query.trim().length < 3) { setPerfumeResults([]); setShowPerfumeDropdown(false); return; }
    setPerfumeLoading(true);
    perfumeTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/perfume-search?q=${encodeURIComponent(query.trim())}&limit=6`);
        if (res.ok) { const data = await res.json(); setPerfumeResults(data); setShowPerfumeDropdown(data.length > 0); }
      } catch { /* ignore */ }
      setPerfumeLoading(false);
    }, 400);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (perfumeDropdownRef.current && !perfumeDropdownRef.current.contains(e.target as Node)) setShowPerfumeDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!GMAPS_KEY || (window as any).google?.maps?.places) { setGmapsLoaded(true); return; }
    if (document.querySelector('script[src*="maps.googleapis.com"]')) { setGmapsLoaded(true); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setGmapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init city autocomplete when question is visible
  useEffect(() => {
    if (!gmapsLoaded || !cityInputRef.current || cityAutocompleteRef.current) return;
    const google = (window as any).google;
    if (!google?.maps?.places) return;
    const ac = new google.maps.places.Autocomplete(cityInputRef.current, {
      types: ['(cities)'],
      fields: ['name', 'address_components', 'formatted_address'],
    });
    // Bias toward Colombia but don't restrict
    const colombiaBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(-4.23, -79.00),
      new google.maps.LatLng(12.46, -66.85),
    );
    ac.setBounds(colombiaBounds);
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place?.name) {
        // Get country for context
        const country = place.address_components?.find((c: any) => c.types.includes('country'))?.long_name || '';
        const cityName = country ? `${place.name}, ${country}` : place.name;
        setAnswer('city', cityName);
        if (cityInputRef.current) cityInputRef.current.value = cityName;
      }
    });
    cityAutocompleteRef.current = ac;
  }, [gmapsLoaded, step]);

  const visibleQuestions = QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
  const totalSteps = visibleQuestions.length + 2;

  useEffect(() => {
    fetch(`${API_URL}/leads/questionnaire/${params.code}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setSeller(d.data); else if (d.sellerId) setSeller(d); else setError('Link inválido'); })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [params.code]);

  const currentQuestion = step > 0 && step <= visibleQuestions.length ? visibleQuestions[step - 1] : null;
  const progress = Math.round((step / totalSteps) * 100);
  const setAnswer = (id: string, value: any) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const canProceed = () => {
    if (step === 0 || !currentQuestion) return true;
    if (currentQuestion.optional) return true;
    const val = answers[currentQuestion.id];
    if (!val || (typeof val === 'string' && !val.trim())) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  };

  const next = () => { if (step <= visibleQuestions.length) setStep((s) => s + 1); };
  const prev = () => { if (step > 0) setStep((s) => s - 1); };

  const submit = async () => {
    if (!contact.name.trim() || !contact.phone.trim()) return;
    setSubmitting(true);
    try {
      // Prepend country code if not already present
      const codeDigits = contact.phoneCode.replace(/\D/g, '');
      const phoneDigits = contact.phone.replace(/\D/g, '');
      const fullPhone = phoneDigits.startsWith(codeDigits) ? phoneDigits : codeDigits + phoneDigits;
      const body = {
        clientName: contact.name, clientEmail: contact.email || undefined, clientPhone: fullPhone,
        clientCity: answers.city, answers, budgetRange: contact.budget || undefined,
        isForGift: answers.forWhom === 'gift', giftRecipient: answers.giftRecipient || undefined, language: lang,
        selectedCategories: urlCategories || undefined,
      };
      const res = await fetch(`${API_URL}/leads/questionnaire/${params.code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      const leadId = data.data?.leadId || data.leadId;
      if (leadId) router.push(`/q/results/${leadId}`);
      else { setError(i.submitError); setSubmitting(false); }
    } catch { setError(i.connectionError); setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center">
      <div className="animate-pulse text-[#d3a86f]/60 text-lg font-sans">{i.loading}</div>
    </div>
  );

  if (error && !sellerInfo) return (
    <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-red-400 text-lg">{error}</p>
        <p className="text-white/40 mt-2 text-sm">{i.checkLink}</p>
      </div>
    </div>
  );

  if (submitting) return (
    <div className="min-h-dvh bg-[#0c0a06] flex flex-col items-center justify-center p-6 font-sans">
      <div className="text-center space-y-8 max-w-sm animate-fadeIn">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-[#d3a86f]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#d3a86f] animate-spin" />
          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-[#d3a86f]/20 to-[#d3a86f]/5 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#d3a86f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-display font-light text-white">{i.analyzingTitle}</h2>
          <p className="text-white/40 text-sm leading-relaxed">{i.analyzingDesc}</p>
        </div>
        <p className="text-[#d3a86f]/50 text-xs animate-pulse">{i.analyzingTip}</p>
      </div>
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .font-display { font-family: var(--font-cormorant), 'Cormorant Garamond', Georgia, serif; }
        .font-sans { font-family: var(--font-outfit), 'Outfit', system-ui, sans-serif; }
      `}</style>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#0c0a06] text-white flex flex-col font-sans">
      {/* ─── Persistent Logo Header ─── */}
      <div className="sticky top-0 z-40 pt-4 pb-2 flex justify-center bg-[#0c0a06]">
        <img src="/icons/logo-final.svg" alt="D Perfume House" className="w-36 h-auto" />
      </div>

      {step > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-[#d3a86f] to-[#e8c891] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        {/* ─── Intro ─── */}
        {step === 0 && (
          <div className="text-center animate-fadeIn space-y-6">
            <div className="flex items-center justify-center gap-1 mb-2">
              <button onClick={() => setLang('es')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${lang === 'es' ? 'bg-[#d3a86f]/20 text-[#d3a86f] border border-[#d3a86f]/40' : 'text-white/30 hover:text-white/50'}`}>ES</button>
              <span className="text-white/15 text-xs">|</span>
              <button onClick={() => setLang('en')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${lang === 'en' ? 'bg-[#d3a86f]/20 text-[#d3a86f] border border-[#d3a86f]/40' : 'text-white/30 hover:text-white/50'}`}>EN</button>
            </div>
            <h1 className="text-3xl font-display font-light tracking-tight">{i.introTitle1}<span className="text-[#d3a86f] font-medium">{i.introTitle2}</span></h1>
            <p className="text-white/50 text-lg leading-relaxed">{i.introDesc}</p>
            <p className="text-white/30 text-sm">{i.introTime} ⏱️</p>
            <button onClick={next} className="mt-8 px-10 py-4 bg-gradient-to-r from-[#d3a86f] to-[#b8843f] text-[#0a0a0f] font-semibold rounded-full text-lg hover:from-[#e8c891] hover:to-[#d3a86f] transition-all active:scale-95 shadow-lg shadow-[#d3a86f]/15">{i.start}</button>
            {sellerInfo && <p className="text-white/20 text-xs mt-6">{i.yourAdvisor} {sellerInfo.sellerName}</p>}
          </div>
        )}

        {/* ─── Question Steps ─── */}
        {currentQuestion && (
          <div className="w-full animate-fadeIn" key={currentQuestion.id}>
            <p className="text-[#d3a86f]/40 text-sm mb-2 tracking-wide">{i.questionOf(step, visibleQuestions.length)}</p>
            <h2 className="text-2xl font-display font-light mb-8 leading-snug">{getQ(currentQuestion, lang, answers)}</h2>

            {currentQuestion.type === 'choice' && (
              <div className="space-y-3">
                {currentQuestion.options!.map((opt) => (
                  <button key={opt.value} onClick={() => { setAnswer(currentQuestion.id, opt.value); setTimeout(next, 300); }}
                    className={`w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] ${answers[currentQuestion.id] === opt.value ? 'border-[#d3a86f] bg-[#d3a86f]/10 text-[#e8c891]' : 'border-white/10 bg-white/[0.03] hover:border-[#d3a86f]/30 hover:bg-white/[0.06]'}`}>
                    {opt.emoji && <span className="mr-3 text-lg">{opt.emoji}</span>}{getOpt(opt, lang)}
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
                    <button key={opt.value} onClick={() => {
                      if (opt.value === 'none') setAnswer(currentQuestion.id, ['none']);
                      else { const f = selected.filter((v) => v !== 'none'); setAnswer(currentQuestion.id, isSelected ? f.filter((v) => v !== opt.value) : [...f, opt.value]); }
                    }} className={`w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] ${isSelected ? 'border-[#d3a86f] bg-[#d3a86f]/10 text-[#e8c891]' : 'border-white/10 bg-white/[0.03] hover:border-[#d3a86f]/30'}`}>
                      <span className="mr-3">{isSelected ? '✓' : '○'}</span>{getOpt(opt, lang)}
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'text' && (currentQuestion.id === 'currentPerfume' || currentQuestion.id === 'giftRecipientPerfume') && (
              <div className="relative" ref={perfumeDropdownRef}>
                <input type="text" value={answers[currentQuestion.id] || ''} onChange={(e) => { setAnswer(currentQuestion.id, e.target.value); searchPerfumes(e.target.value); }}
                  placeholder={getP(currentQuestion, lang, answers)} className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/50 text-lg transition-colors"
                  onKeyDown={(e) => { if (e.key === 'Enter' && canProceed()) { setShowPerfumeDropdown(false); next(); } if (e.key === 'Escape') setShowPerfumeDropdown(false); }}
                  onFocus={() => perfumeResults.length > 0 && setShowPerfumeDropdown(true)} autoFocus autoComplete="off" />
                {perfumeLoading && <div className="absolute right-4 top-1/2 -translate-y-1/2"><div className="w-5 h-5 border-2 border-[#d3a86f]/30 border-t-[#d3a86f] rounded-full animate-spin" /></div>}
                {showPerfumeDropdown && perfumeResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#16110a] border border-[#d3a86f]/15 overflow-hidden z-50 shadow-xl shadow-black/50">
                    {perfumeResults.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setAnswer(currentQuestion.id, `${p.name} - ${p.brand}`); setShowPerfumeDropdown(false); setPerfumeResults([]); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#d3a86f]/10 transition-colors text-left">
                        {p.image ? <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-white/5 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <div className="w-10 h-10 rounded-lg bg-[#d3a86f]/10 flex items-center justify-center flex-shrink-0 text-sm text-[#d3a86f]">🧴</div>}
                        <div className="min-w-0"><p className="text-white text-sm font-medium truncate">{p.name}</p><p className="text-white/40 text-xs truncate">{p.brand}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentQuestion.type === 'text' && currentQuestion.id === 'city' && (
              <div className="relative">
                <input ref={cityInputRef} type="text" defaultValue={answers.city || ''} onChange={(e) => setAnswer('city', e.target.value)}
                  placeholder={getP(currentQuestion, lang, answers)} className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/50 text-lg transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && canProceed() && next()} autoFocus autoComplete="off" />
                {GMAPS_KEY && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg></div>}
              </div>
            )}

            {currentQuestion.type === 'text' && currentQuestion.id !== 'currentPerfume' && currentQuestion.id !== 'giftRecipientPerfume' && currentQuestion.id !== 'city' && (
              <input type="text" value={answers[currentQuestion.id] || ''} onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                placeholder={getP(currentQuestion, lang, answers)} className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/50 text-lg transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && next()} autoFocus />
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={prev} className="px-6 py-3 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all">{i.back}</button>
              {currentQuestion.type !== 'choice' && (
                <button onClick={next} disabled={!canProceed()} className="flex-1 px-6 py-3 rounded-full bg-[#d3a86f] text-[#0a0a0f] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8c891] transition-all active:scale-95">{i.next}</button>
              )}
            </div>
          </div>
        )}

        {/* ─── Contact + Budget ─── */}
        {step === visibleQuestions.length + 1 && (
          <div className="w-full animate-fadeIn space-y-6">
            <h2 className="text-2xl font-display font-light mb-2">{i.contactTitle} ✨</h2>
            <p className="text-white/40 text-sm mb-6">{i.contactDesc}</p>
            <div className="space-y-4">
              <input type="text" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder={i.yourName}
                className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/50 transition-colors" autoFocus />
              <input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} placeholder={i.yourEmail}
                className="w-full px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/50 transition-colors" />
              <div className="relative flex">
                <button
                  type="button"
                  onClick={() => setShowPhoneCodePicker((v) => !v)}
                  className="flex items-center gap-1 px-3 py-4 rounded-l-2xl bg-white/[0.05] border border-r-0 border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  {contact.phoneCode}
                  <svg className="w-3 h-3 ml-0.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <input type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder={i.yourWhatsApp}
                  className="flex-1 px-4 py-4 rounded-r-2xl bg-white/[0.03] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/50 transition-colors" />
                {showPhoneCodePicker && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-2xl border border-white/10 bg-[#1a1612] shadow-2xl overflow-hidden">
                    {[{code:'+57',flag:'🇨🇴',name:'Colombia'},{code:'+52',flag:'🇲🇽',name:'México'},{code:'+54',flag:'🇦🇷',name:'Argentina'},{code:'+58',flag:'🇻🇪',name:'Venezuela'},{code:'+51',flag:'🇵🇪',name:'Perú'},{code:'+593',flag:'🇪🇨',name:'Ecuador'},{code:'+1',flag:'🇺🇸',name:'EE.UU./Canadá'},{code:'+34',flag:'🇪🇸',name:'España'}].map((c) => (
                      <button key={c.code+c.name} type="button"
                        onClick={() => { setContact((prev) => ({ ...prev, phoneCode: c.code })); setShowPhoneCodePicker(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors"
                      >
                        <span className="text-base">{c.flag}</span>
                        <span className="flex-1 text-left">{c.name}</span>
                        <span className="text-white/40">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white/40 text-sm mb-3">{i.budgetLabel}</p>
                <div className="grid grid-cols-2 gap-2">
                  {BUDGET_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setContact((c) => ({ ...c, budget: c.budget === opt.value ? '' : opt.value }))}
                      className={`px-4 py-3 rounded-xl text-sm border transition-all ${contact.budget === opt.value ? 'border-[#d3a86f] bg-[#d3a86f]/10 text-[#e8c891]' : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-[#d3a86f]/30'}`}>
                      {(lang === 'en' && (opt as any).labelEn) ? (opt as any).labelEn : opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={prev} className="px-6 py-3 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all">{i.back}</button>
              <button onClick={submit} disabled={!contact.name.trim() || !contact.phone.trim() || submitting}
                className="flex-1 px-6 py-4 rounded-full bg-gradient-to-r from-[#d3a86f] to-[#b8843f] text-[#0a0a0f] font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:from-[#e8c891] hover:to-[#d3a86f] transition-all active:scale-95">
                {submitting ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-[#0a0a0f]/30 border-t-[#0a0a0f] rounded-full animate-spin" />{i.analyzing}</span> : i.seeResults}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
          </div>
        )}
      </div>
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .font-display { font-family: var(--font-cormorant), 'Cormorant Garamond', Georgia, serif; }
        .font-sans { font-family: var(--font-outfit), 'Outfit', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}
