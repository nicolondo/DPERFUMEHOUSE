'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, MapPin, MessageSquare,
  Phone, Mail, ChevronRight, Gift, Sparkles, ShoppingBag,
  ClipboardList, Lightbulb, Target, AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { useLead, useUpdateLeadStatus, useUpdateAppointment, useConvertLead } from '@/hooks/use-leads';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { LeadStatus } from '@/lib/types';

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; next?: LeadStatus; nextLabel?: string }> = {
  SENT: { label: 'Enviado', color: 'text-blue-400', bg: 'bg-blue-500/15', next: 'RESPONDED', nextLabel: 'Marcar Respondido' },
  RESPONDED: { label: 'Respondido', color: 'text-amber-400', bg: 'bg-amber-500/15', next: 'APPOINTMENT', nextLabel: 'Agendar Cita' },
  APPOINTMENT: { label: 'Cita Agendada', color: 'text-purple-400', bg: 'bg-purple-500/15', next: 'VISITED', nextLabel: 'Marcar Visitado' },
  VISITED: { label: 'Visitado', color: 'text-emerald-400', bg: 'bg-emerald-500/15', next: 'CONVERTED', nextLabel: 'Marcar Convertido' },
  CONVERTED: { label: 'Convertido', color: 'text-green-400', bg: 'bg-green-500/15' },
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: lead, isLoading } = useLead(params.id as string);
  const updateStatus = useUpdateLeadStatus();
  const updateAppointment = useUpdateAppointment();
  const convertLead = useConvertLead();
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentData, setAppointmentData] = useState({
    appointmentDate: '',
    appointmentTime: '',
    appointmentLocation: '',
    appointmentNotes: '',
  });

  if (isLoading || !lead) return <PageSpinner />;

  const config = STATUS_CONFIG[lead.status] || STATUS_CONFIG.SENT;
  const analysis = lead.aiAnalysis;
  const recommendations = lead.recommendations || [];
  const script = lead.sellerScript;
  const hasResponded = ['RESPONDED', 'APPOINTMENT', 'VISITED', 'CONVERTED'].includes(lead.status);
  const isAppointment = lead.status === 'APPOINTMENT';
  const isPreVisit = lead.status === 'APPOINTMENT' && lead.appointmentDate;

  const handleNextStatus = async () => {
    if (lead.status === 'RESPONDED') {
      setShowAppointmentForm(true);
      return;
    }
    if (lead.status === 'VISITED') {
      // TODO: Ask for orderId if converting
      return;
    }
    if (config.next) {
      await updateStatus.mutateAsync({ id: lead.id, status: config.next });
    }
  };

  const handleScheduleAppointment = async () => {
    await updateAppointment.mutateAsync({
      id: lead.id,
      ...appointmentData,
    });
    await updateStatus.mutateAsync({ id: lead.id, status: 'APPOINTMENT' });
    setShowAppointmentForm(false);
  };

  const openWhatsApp = () => {
    const phone = lead.clientPhone?.replace(/\D/g, '');
    if (!phone) return;
    const name = lead.clientName?.split(' ')[0] || '';
    let msg = `Hola ${name}! 🌿 Soy ${lead.seller?.name || 'tu asesor'} de D Perfume House.`;
    if (lead.status === 'RESPONDED') {
      msg += ` Vi tus respuestas del cuestionario y tengo unas recomendaciones increíbles para vos. ¿Cuándo podemos agendar una cita?`;
    } else if (lead.status === 'APPOINTMENT') {
      msg += ` Te confirmo nuestra cita${lead.appointmentDate ? ` el ${new Date(lead.appointmentDate).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}${lead.appointmentTime ? ` a las ${lead.appointmentTime}` : ''}. ¡Te espero! ✨`;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-xl border-b border-glass-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-5 w-5 text-white/60" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-white truncate">
              {lead.clientName || lead.customer?.name || 'Lead'}
            </h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
          {lead.clientPhone && (
            <button onClick={openWhatsApp} className="p-2 rounded-full bg-[#25D366]/15 text-[#25D366]">
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Client Info Card */}
        <Card>
          <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Información</h3>
          <div className="space-y-2.5">
            {lead.clientName && (
              <div className="flex items-center gap-2.5 text-sm">
                <span className="text-white/30">👤</span>
                <span className="text-white/80">{lead.clientName}</span>
              </div>
            )}
            {lead.clientPhone && (
              <a href={`tel:${lead.clientPhone}`} className="flex items-center gap-2.5 text-sm">
                <Phone className="h-3.5 w-3.5 text-white/30" />
                <span className="text-accent-purple">{lead.clientPhone}</span>
              </a>
            )}
            {lead.clientEmail && (
              <a href={`mailto:${lead.clientEmail}`} className="flex items-center gap-2.5 text-sm">
                <Mail className="h-3.5 w-3.5 text-white/30" />
                <span className="text-white/60">{lead.clientEmail}</span>
              </a>
            )}
            {lead.clientCity && (
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="h-3.5 w-3.5 text-white/30" />
                <span className="text-white/60">{lead.clientCity}</span>
              </div>
            )}
            {lead.budgetRange && (
              <div className="flex items-center gap-2.5 text-sm">
                <span className="text-white/30">💰</span>
                <span className="text-white/60">{lead.budgetRange}</span>
              </div>
            )}
            {lead.isForGift && (
              <div className="flex items-center gap-2.5 text-sm">
                <Gift className="h-3.5 w-3.5 text-amber-400/60" />
                <span className="text-amber-400/80">Regalo{lead.giftRecipient ? ` para: ${lead.giftRecipient}` : ''}</span>
              </div>
            )}
          </div>
        </Card>

        {/* AI Analysis — Seller Briefing */}
        {hasResponded && analysis && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">Tu Briefing</h3>
            </div>

            {/* Client Profile */}
            {analysis.clientProfile && (
              <div className="mb-4">
                <p className="text-sm text-white/80 leading-relaxed">
                  {typeof analysis.clientProfile === 'string'
                    ? analysis.clientProfile
                    : analysis.clientProfile.summary || JSON.stringify(analysis.clientProfile)}
                </p>
              </div>
            )}

            {/* Ice Breaker */}
            {script?.iceBreaker && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 mb-3">
                <p className="text-[10px] font-medium text-amber-400/60 uppercase tracking-wider mb-1">Rompe hielo</p>
                <p className="text-sm text-amber-300/90">{script.iceBreaker}</p>
              </div>
            )}

            {/* Opening */}
            {script?.opening && (
              <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-3">
                <p className="text-[10px] font-medium text-purple-400/60 uppercase tracking-wider mb-1">Apertura</p>
                <p className="text-sm text-purple-300/90">{script.opening}</p>
              </div>
            )}
          </Card>
        )}

        {/* Recommendations */}
        {hasResponded && recommendations.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-purple-400" />
              <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">Muestras a Presentar</h3>
            </div>

            <div className="space-y-3">
              {recommendations.map((rec: any, i: number) => (
                <div key={i} className="rounded-xl bg-glass-50 border border-glass-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/20 text-xs font-bold text-accent-purple">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-white">{rec.name || rec.productName || 'Perfume'}</span>
                    </div>
                    <span className="text-xs font-medium text-emerald-400">{rec.compatibility || rec.score || 0}%</span>
                  </div>

                  {rec.mainArgument && (
                    <div className="flex items-start gap-2 mb-1.5">
                      <Lightbulb className="h-3 w-3 text-amber-400/50 mt-0.5 shrink-0" />
                      <p className="text-xs text-white/60 leading-relaxed">{rec.mainArgument}</p>
                    </div>
                  )}

                  {rec.objectionHandling && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 text-red-400/50 mt-0.5 shrink-0" />
                      <p className="text-xs text-white/40 leading-relaxed">{rec.objectionHandling}</p>
                    </div>
                  )}

                  {rec.product?.price && (
                    <p className="text-xs text-white/30 mt-1.5">{formatCurrency(rec.product.price)}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Closing Tip */}
        {hasResponded && script?.closingTip && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">Cierre</h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{script.closingTip}</p>
            {script.objections && script.objections.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Objeciones comunes</p>
                {script.objections.map((obj: any, i: number) => (
                  <div key={i} className="text-xs text-white/50">
                    <span className="text-red-400/70">"{obj.objection || obj}"</span>
                    {obj.response && <span className="text-emerald-400/70"> → {obj.response}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Appointment Details */}
        {isAppointment && lead.appointmentDate && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-purple-400" />
              <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">Cita Agendada</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5 text-white/30" />
                <span className="text-white/80">
                  {new Date(lead.appointmentDate).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              {lead.appointmentTime && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-white/30" />
                  <span className="text-white/80">{lead.appointmentTime}</span>
                </div>
              )}
              {lead.appointmentLocation && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-white/30" />
                  <span className="text-white/80">{lead.appointmentLocation}</span>
                </div>
              )}
              {lead.appointmentNotes && (
                <p className="text-xs text-white/40 mt-1">{lead.appointmentNotes}</p>
              )}
            </div>
          </Card>
        )}

        {/* Converted Order */}
        {lead.status === 'CONVERTED' && lead.convertedOrder && (
          <Card onClick={() => router.push(`/orders/${lead.convertedOrder!.id}`)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                  <ShoppingBag className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Orden #{lead.convertedOrder.orderNumber}</p>
                  <p className="text-xs text-white/40">{formatCurrency(lead.convertedOrder.total)}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </div>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Timeline</h3>
          <div className="space-y-3">
            {[
              { date: lead.createdAt, label: 'Cuestionario enviado', icon: '📤' },
              lead.respondedAt && { date: lead.respondedAt, label: 'Cuestionario completado', icon: '✅' },
              lead.appointmentAt && { date: lead.appointmentAt, label: 'Cita agendada', icon: '📅' },
              lead.visitedAt && { date: lead.visitedAt, label: 'Visita realizada', icon: '🏠' },
              lead.convertedAt && { date: lead.convertedAt, label: 'Convertido a orden', icon: '🎉' },
            ]
              .filter(Boolean)
              .map((event: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm">{event.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs text-white/60">{event.label}</p>
                    <p className="text-[10px] text-white/25">{formatDate(event.date)}</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Appointment Form Modal */}
      {showAppointmentForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAppointmentForm(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl bg-surface-raised border-t border-glass-border p-6 pb-10 max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Agendar Cita</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Fecha</label>
                <input
                  type="date"
                  value={appointmentData.appointmentDate}
                  onChange={(e) => setAppointmentData(d => ({ ...d, appointmentDate: e.target.value }))}
                  className="w-full rounded-xl border border-glass-border bg-glass-50 px-4 py-3 text-white focus:outline-none focus:border-accent-purple/50 appearance-none [-webkit-appearance:none] [&::-webkit-date-and-time-value]:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Hora</label>
                <input
                  type="time"
                  value={appointmentData.appointmentTime}
                  onChange={(e) => setAppointmentData(d => ({ ...d, appointmentTime: e.target.value }))}
                  className="w-full rounded-xl border border-glass-border bg-glass-50 px-4 py-3 text-white focus:outline-none focus:border-accent-purple/50 appearance-none [-webkit-appearance:none] [&::-webkit-date-and-time-value]:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Lugar</label>
                <input
                  type="text"
                  value={appointmentData.appointmentLocation}
                  placeholder="Ej: Showroom, casa del cliente..."
                  onChange={(e) => setAppointmentData(d => ({ ...d, appointmentLocation: e.target.value }))}
                  className="w-full rounded-xl border border-glass-border bg-glass-50 px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Notas</label>
                <textarea
                  value={appointmentData.appointmentNotes}
                  placeholder="Notas adicionales..."
                  onChange={(e) => setAppointmentData(d => ({ ...d, appointmentNotes: e.target.value }))}
                  className="w-full rounded-xl border border-glass-border bg-glass-50 px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50 min-h-[80px] resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleScheduleAppointment}
              disabled={!appointmentData.appointmentDate}
              className="mt-4 w-full py-3 rounded-full bg-accent-purple text-white font-medium disabled:opacity-30"
            >
              Confirmar Cita
            </button>
          </div>
        </div>
      )}

      {/* Bottom Action */}
      {config.next && lead.status !== 'VISITED' && (
        <div className="fixed bottom-20 left-0 right-0 z-20 px-4 pb-4">
          <button
            onClick={handleNextStatus}
            disabled={updateStatus.isPending}
            className="w-full py-3.5 rounded-full bg-accent-purple text-white font-medium text-sm shadow-glow-purple flex items-center justify-center gap-2"
          >
            {config.nextLabel}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
