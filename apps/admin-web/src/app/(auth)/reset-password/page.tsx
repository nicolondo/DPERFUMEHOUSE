'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Lock, CheckCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'Mínimo 8 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        token,
        password: data.password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Enlace Inválido</h2>
        <p className="text-sm text-white/60 mb-6">
          El enlace de restablecimiento no es válido. Solicita uno nuevo.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
        >
          Solicitar nuevo enlace
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-white">Contraseña Actualizada</h2>
        <p className="text-sm text-white/60 mb-6">
          Tu contraseña ha sido restablecida exitosamente.
        </p>
        <Link
          href="/login"
          className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-2 text-center text-lg font-semibold text-white">
        Nueva Contraseña
      </h2>
      <p className="mb-6 text-center text-sm text-white/50">
        Ingresa tu nueva contraseña.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        <FormField label="Nueva contraseña" error={errors.password?.message} required>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              {...register('password')}
              type="password"
              placeholder="Mínimo 8 caracteres"
              error={!!errors.password}
              className="pl-9"
            />
          </div>
        </FormField>

        <FormField label="Confirmar contraseña" error={errors.confirmPassword?.message} required>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              {...register('confirmPassword')}
              type="password"
              placeholder="Repite tu contraseña"
              error={!!errors.confirmPassword}
              className="pl-9"
            />
          </div>
        </FormField>

        <Button type="submit" loading={loading} className="w-full">
          Restablecer Contraseña
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
          <Suspense fallback={<div className="text-center text-white/50 py-4">Cargando...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
