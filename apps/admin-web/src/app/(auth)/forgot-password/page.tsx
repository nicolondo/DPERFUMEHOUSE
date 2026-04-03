'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email: data.email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al enviar el correo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(167,139,250,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(212,175,55,0.06),transparent_50%)]" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 text-center">
          <img
            src="/icons/logo.svg"
            alt="D Perfume House"
            className="mx-auto mb-4 h-12 w-auto"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
          />
          <p className="text-sm text-white/40 tracking-widest uppercase">Panel de Administración</p>
        </div>

        <div className="rounded-xl border border-glass-border bg-glass-100 backdrop-blur-xl p-6 shadow-glass">
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

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
                    {error}
                  </div>
                )}

                <FormField label="Email" error={errors.email?.message} required>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <Input
                      {...register('email')}
                      type="email"
                      placeholder="admin@dperfumehouse.com"
                      error={!!errors.email}
                      className="pl-9"
                    />
                  </div>
                </FormField>

                <Button type="submit" loading={loading} className="w-full">
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
      </div>
    </div>
  );
}
