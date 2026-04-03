'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';

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
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(data: FormData) {
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
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

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Nueva contraseña"
          type={showPassword ? 'text' : 'password'}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          leftIcon={<Lock className="h-5 w-5" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-white/30 hover:text-white/70"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <Input
          label="Confirmar contraseña"
          type={showPassword ? 'text' : 'password'}
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          leftIcon={<Lock className="h-5 w-5" />}
          error={form.formState.errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />

        <Button type="submit" fullWidth loading={loading} size="lg">
          Restablecer Contraseña
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
        <Suspense fallback={<div className="text-center text-white/50 py-4">Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>

      <p className="relative z-10 mt-8 text-xs text-white/30">
        D Perfume House &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
