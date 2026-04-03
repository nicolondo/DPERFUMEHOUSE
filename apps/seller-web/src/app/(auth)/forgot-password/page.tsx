'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';

const schema = z.object({
  email: z.string().email('Email no válido'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(data: FormData) {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al enviar el correo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(167,139,250,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(212,175,55,0.06),transparent_50%)]" />

      <div className="relative z-10 mb-10 text-center">
        <img
          src="/icons/logo.svg"
          alt="D Perfume House"
          className="mx-auto mb-3 w-64 opacity-90"
          style={{ filter: 'drop-shadow(0 0 20px rgba(176, 152, 112, 0.15))' }}
        />
        <p className="text-sm text-white/50">Portal de Vendedor</p>
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-glass-100 border border-glass-border shadow-glass backdrop-blur-xl p-6">
        {sent ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white">Correo Enviado</h2>
            <p className="text-sm text-white/60 mb-6">
              Si el email está registrado, recibirás un enlace para restablecer tu contraseña.
            </p>
            <Link
              href="/login"
              className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-center text-lg font-semibold text-white">
              ¿Olvidaste tu contraseña?
            </h2>
            <p className="mb-6 text-center text-sm text-white/50">
              Ingresa tu email y te enviaremos un enlace para restablecerla.
            </p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                leftIcon={<Mail className="h-5 w-5" />}
                error={form.formState.errors.email?.message}
                {...form.register('email')}
              />

              <Button type="submit" fullWidth loading={loading} size="lg">
                Enviar Enlace
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al login
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="relative z-10 mt-8 text-xs text-white/30">
        D Perfume House &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
