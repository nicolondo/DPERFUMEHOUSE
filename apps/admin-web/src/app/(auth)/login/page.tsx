'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginAdmin } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Lock, Mail } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'La contrasena es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setError('');
    setLoading(true);
    try {
      await loginAdmin(data.email, data.password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al iniciar sesion');
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

            <FormField label="Contrasena" error={errors.password?.message} required>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  {...register('password')}
                  type="password"
                  placeholder="********"
                  error={!!errors.password}
                  className="pl-9"
                />
              </div>
            </FormField>

            <Button type="submit" loading={loading} className="w-full">
              Iniciar Sesion
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-white/40 hover:text-accent-gold transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
