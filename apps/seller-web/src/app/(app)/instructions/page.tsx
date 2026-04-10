'use client';

import { useState } from 'react';
import {
  LogIn,
  LayoutDashboard,
  Users,
  Target,
  ShoppingBag,
  FileText,
  Link2,
  Sparkles,
  Settings,
  Smartphone,
  TrendingUp,
  Navigation,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

interface GuideSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  items: Array<{
    text: string;
    type?: 'tip' | 'step' | 'state' | 'normal';
  }>;
}

const sections: GuideSection[] = [
  {
    id: 'acceso',
    icon: <LogIn className="h-5 w-5" />,
    title: 'Acceso y Registro',
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    items: [
      { text: 'Abre pos.dperfumehouse.com en tu navegador' },
      { text: 'Ingresa con Email y Contraseña, o con Google' },
      { text: 'Si es tu primera vez, tu líder te habrá creado una cuenta' },
      { text: 'Cambia tu contraseña desde Configuración al ingresar por primera vez', type: 'tip' },
    ],
  },
  {
    id: 'inicio',
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: 'Inicio — Tu Centro de Control',
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    items: [
      { text: 'Gráfico de Ventas y Comisiones — alterna entre Ventas o Comisiones, filtra por Semana o Mes' },
      { text: 'Cumpleaños Próximos — clientes que cumplen años en los próximos 14 días con botón de WhatsApp' },
      { text: 'Un mensaje de cumpleaños es una excelente excusa para retomar contacto', type: 'tip' },
      { text: 'Seguimientos Pendientes — clientes que llevan más de 45 días sin comprar' },
    ],
  },
  {
    id: 'clientes',
    icon: <Users className="h-5 w-5" />,
    title: 'Clientes — Tu Base de Datos',
    color: 'from-green-500/20 to-green-600/10 border-green-500/20',
    items: [
      { text: 'Lista de todos tus clientes con buscador rápido por nombre, email o teléfono' },
      { text: 'Toca Nuevo Cliente para crear uno — nombre obligatorio, teléfono obligatorio para WhatsApp' },
      { text: 'Agrega cumpleaños para seguimiento automático', type: 'tip' },
      { text: 'Desde el perfil puedes: enviar cuestionario, ver direcciones, ver pedidos, crear pedido' },
    ],
  },
  {
    id: 'leads',
    icon: <Target className="h-5 w-5" />,
    title: 'Leads — Tu CRM de Ventas',
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    items: [
      { text: 'Cada persona que completa un cuestionario se convierte en un Lead' },
      { text: 'Vista de Lista — leads ordenados con filtro por categoría' },
      { text: 'Vista Kanban — tablero con columnas para ver tu pipeline de un vistazo' },
      { text: 'Enviado → Respondido → Cita → Visitado → Convertido', type: 'state' },
      { text: 'Al tocar un lead respondido verás: análisis IA, guión de venta, productos recomendados y WhatsApp' },
    ],
  },
  {
    id: 'pedidos',
    icon: <ShoppingBag className="h-5 w-5" />,
    title: 'Pedidos — Gestión de Ventas',
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
    items: [
      { text: '1. Elegir Cliente — busca existente o crea nuevo', type: 'step' },
      { text: '2. Dirección de Envío — selecciona guardada o agrega nueva con Google Maps', type: 'step' },
      { text: '3. Agregar Productos — explora catálogo, filtra por marca, selecciona cantidades', type: 'step' },
      { text: '4. Revisar y Confirmar — resumen, notas, método de pago (Efectivo u Online)', type: 'step' },
      { text: 'Borrador → Pendiente de Pago → Pagado → Enviado → Entregado', type: 'state' },
      { text: 'Si elegiste pago online, se genera un link que puedes compartir por WhatsApp o QR' },
    ],
  },
  {
    id: 'propuestas',
    icon: <FileText className="h-5 w-5" />,
    title: 'Propuestas — Catálogos Personalizados',
    color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20',
    items: [
      { text: 'Crea catálogos personalizados con productos seleccionados y notas' },
      { text: 'Se genera un link público para enviar al cliente' },
      { text: 'El cliente ve: fotos, precios, perfil de fragancia y botón de WhatsApp' },
      { text: 'La plataforma cuenta cuántas veces fue vista cada propuesta' },
      { text: 'Envía la propuesta, espera unas horas, y si ves que la vieron, haz seguimiento', type: 'tip' },
    ],
  },
  {
    id: 'links-venta',
    icon: <Link2 className="h-5 w-5" />,
    title: 'Links de Venta — Vende por Redes Sociales',
    color: 'from-pink-500/20 to-pink-600/10 border-pink-500/20',
    items: [
      { text: 'Genera links únicos para cada producto que quieras promocionar' },
      { text: '1. Ve a Links de Venta desde el menú lateral', type: 'step' },
      { text: '2. Pestaña "Generar" — busca el producto, toca "Generar Link"', type: 'step' },
      { text: '3. Se crea un link público con tu código de vendedor incluido', type: 'step' },
      { text: '4. Comparte el link en WhatsApp, Instagram, TikTok o cualquier red social', type: 'step' },
      { text: 'Cuando alguien abre tu link, ve la página del producto con fotos, precio, perfil olfativo y botón de compra' },
      { text: 'La plataforma registra cada visita, así sabes cuántas personas vieron tu link' },
      { text: 'Si alguien compra, la comisión queda asignada a ti automáticamente' },
      { text: 'Publica tus links en historias de Instagram con una reseña corta del perfume', type: 'tip' },
      { text: 'Puedes desactivar un link si ya no quieres promocionar ese producto' },
    ],
  },
  {
    id: 'cuestionario',
    icon: <Sparkles className="h-5 w-5" />,
    title: 'Cuestionario de Fragancias',
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-400/20',
    items: [
      { text: '🏆 Tu herramienta más poderosa — la IA analiza preferencias y recomienda productos' },
      { text: 'Generas un link → lo envías por WhatsApp o Email → el cliente lo completa en 2-3 min' },
      { text: 'El cuestionario pregunta: para quién es, preferencias de aromas, ocasión, presupuesto y contacto' },
      { text: 'El cliente ve sus fragancias recomendadas con puntaje de compatibilidad' },
      { text: 'Tú ves: análisis IA, guión de venta, productos ordenados por compatibilidad' },
      { text: 'Puedes enviar desde Clientes (perfil) o desde Leads (Generar Link)' },
    ],
  },
  {
    id: 'config',
    icon: <Settings className="h-5 w-5" />,
    title: 'Configuración y Perfil',
    color: 'from-gray-500/20 to-gray-600/10 border-gray-500/20',
    items: [
      { text: 'Perfil — foto de perfil y estado de cuenta' },
      { text: 'Contraseña — cambia tu contraseña actual' },
      { text: 'Datos Bancarios — configura tu cuenta para recibir comisiones' },
      { text: 'Wallet Crypto — opcional, dirección USDT TRC20' },
      { text: 'Si eres líder: sección Vendedores para ver y agregar tu equipo' },
    ],
  },
  {
    id: 'instalacion',
    icon: <Smartphone className="h-5 w-5" />,
    title: 'Instalar como App',
    color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20',
    items: [
      { text: 'iPhone — Safari → Compartir → Agregar a pantalla de inicio' },
      { text: 'Android — Chrome → banner "Instalar app" o 3 puntos → Instalar app' },
      { text: 'Se abre sin barra de navegador, con acceso directo y notificaciones push', type: 'tip' },
    ],
  },
  {
    id: 'flujos',
    icon: <TrendingUp className="h-5 w-5" />,
    title: 'Flujos de Venta Recomendados',
    color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
    items: [
      { text: '⭐ Flujo 1 — Venta con Cuestionario (Recomendado): Contacto → Cliente → Cuestionario → Lead → Cita → Pedido', type: 'step' },
      { text: 'Flujo 2 — Venta Directa: Cliente → Pedido → Productos → Pago', type: 'step' },
      { text: 'Flujo 3 — Propuesta Primero: Propuesta → Compartir → Seguimiento → Pedido', type: 'step' },
      { text: 'Flujo 4 — Captación en Redes: Publicar link de cuestionario → Leads automáticos', type: 'step' },
    ],
  },
  {
    id: 'faq',
    icon: <HelpCircle className="h-5 w-5" />,
    title: 'Preguntas Frecuentes',
    color: 'from-rose-500/20 to-rose-600/10 border-rose-500/20',
    items: [
      { text: '¿Puedo usar la plataforma desde la computadora? — Sí, funciona en cualquier navegador' },
      { text: '¿Qué pasa si el cliente no completa el cuestionario? — Queda como "Enviado", puedes reenviar' },
      { text: '¿Cómo sé si vieron mi propuesta? — Revisa el contador de vistas en la lista de propuestas' },
      { text: '¿Puedo editar un pedido? — Solo la dirección, mientras no haya sido enviado' },
      { text: '¿Cuándo recibo comisiones? — Se calculan automáticamente, asegúrate de tener datos bancarios' },
      { text: '¿Puedo tener varios cuestionarios activos? — Sí, cada cliente tiene su propio cuestionario' },
    ],
  },
];

function SectionCard({ section, isOpen, toggle }: { section: GuideSection; isOpen: boolean; toggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-glass-border bg-glass-50 transition-all">
      <button
        onClick={toggle}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors ${isOpen ? 'bg-gradient-to-r ' + section.color : 'hover:bg-white/[0.03]'}`}
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isOpen ? 'bg-white/10' : 'bg-white/5'} transition-colors`}>
          <span className={isOpen ? 'text-white' : 'text-white/40'}>{section.icon}</span>
        </div>
        <span className={`flex-1 text-sm font-semibold ${isOpen ? 'text-white' : 'text-white/70'}`}>
          {section.title}
        </span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-2 px-4 pb-4 pt-2">
          {section.items.map((item, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              {item.type === 'tip' ? (
                <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
              ) : item.type === 'step' ? (
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent-gold/60" />
              ) : item.type === 'state' ? (
                <Navigation className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-400" />
              ) : (
                <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
              )}
              <p className={`text-[13px] leading-relaxed ${
                item.type === 'tip'
                  ? 'text-amber-300/80 italic'
                  : item.type === 'state'
                    ? 'text-purple-300/80 font-medium'
                    : 'text-white/60'
              }`}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InstructionsPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['cuestionario']));

  const toggle = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (openSections.size === sections.length) {
      setOpenSections(new Set());
    } else {
      setOpenSections(new Set(sections.map((s) => s.id)));
    }
  };

  return (
    <div className="min-h-dvh bg-surface-base pb-32">
      <PageHeader title="Instrucciones" />

      <div className="px-4 pt-4 space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 pb-2">
          <div className="flex justify-center">
            <img src="/icons/logo-final.svg" alt="D Perfume House" className="w-32 h-auto opacity-60" />
          </div>
          <h2 className="text-base font-semibold text-white/80">Guía del Vendedor</h2>
          <p className="text-xs text-white/40">Todo lo que necesitas para vender como un profesional</p>
        </div>

        {/* Expand/Collapse */}
        <div className="flex justify-end">
          <button
            onClick={expandAll}
            className="text-xs text-accent-gold/60 hover:text-accent-gold transition-colors px-2 py-1"
          >
            {openSections.size === sections.length ? 'Colapsar todo' : 'Expandir todo'}
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-2">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              toggle={() => toggle(section.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center pt-4 pb-4">
          <p className="text-xs text-white/20">D Perfume House · Perfumería Artesanal Árabe</p>
          <p className="text-xs text-white/15 mt-1">Contacta a tu líder o administrador para ayuda técnica</p>
        </div>
      </div>
    </div>
  );
}
