'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/ui/toast';
import api from '@/lib/api';
import { GoogleLogin } from '@react-oauth/google';

const loginSchema = z.object({
  email: z.string().email('Email no valido'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
  remember: z.boolean().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres'),
  email: z.string().email('Email no valido'),
  phone: z.string().optional(),
  phoneCode: z.string().optional(),
  password: z.string().min(8, 'Minimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'Minimo 8 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contrasenas no coinciden',
  path: ['confirmPassword'],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
    if (axiosErr.response?.data?.message) return axiosErr.response.data.message;
    if (axiosErr.response?.status === 403) return 'Tu cuenta está pendiente de aprobación por el administrador';
  }
  if (err instanceof Error) return err.message;
  return 'Error inesperado. Intenta de nuevo.';
}

let appleScriptLoaded = false;
function loadAppleScript(): Promise<void> {
  if (appleScriptLoaded || (window as any).AppleID) {
    appleScriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    s.onload = () => { appleScriptLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('No se pudo cargar Apple Sign In'));
    document.head.appendChild(s);
  });
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const { login, isLoading } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    }
  }, []);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', phoneCode: '+57', password: '', confirmPassword: '' },
  });

  const onLogin = async (data: LoginForm) => {
    setLoginError('');
    try {
      await login(data.email, data.password);
      showToast('success', 'Bienvenido de vuelta');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setLoginError(msg);
      showToast('error', msg);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setRegisterLoading(true);
    try {
      await api.post('/auth/register', {
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        phoneCode: data.phoneCode || '+57',
        password: data.password,
      });
      setRegisterSuccess(true);
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setGoogleLoading(true);
    setLoginError('');
    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential,
      });

      if (data.pendingApproval) {
        setRegisterSuccess(true);
        setMode('register');
        return;
      }

      // Successful login
      const { accessToken, refreshToken, user } = data;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setLoginError(msg);
      showToast('error', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setLoginError('');
    try {
      // Load Apple JS SDK
      await loadAppleScript();
      const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
      if (!appleClientId) throw new Error('Apple Sign In no configurado');

      (window as any).AppleID.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: window.location.origin + '/api/auth/apple/callback',
        usePopup: true,
      });

      const response = await (window as any).AppleID.auth.signIn();
      const idToken = response.authorization?.id_token;
      if (!idToken) throw new Error('No se obtuvo token de Apple');

      // Apple only gives the name on the FIRST sign-in
      const appleName = response.user
        ? `${response.user.name?.firstName || ''} ${response.user.name?.lastName || ''}`.trim()
        : undefined;

      const { data } = await api.post('/auth/apple', {
        idToken,
        name: appleName || undefined,
      });

      if (data.pendingApproval) {
        setRegisterSuccess(true);
        setMode('register');
        return;
      }

      const { accessToken, refreshToken, user } = data;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      // User cancelled is not an error
      if (err && typeof err === 'object' && 'error' in err && (err as any).error === 'popup_closed_by_user') return;
      const msg = getErrorMessage(err);
      setLoginError(msg);
      showToast('error', msg);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      {/* Radial gradient mesh */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(167,139,250,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(212,175,55,0.06),transparent_50%)]" />

      {/* Logo */}
      <div className="relative z-10 mb-10 text-center">
        <img
          src="/icons/logo.svg"
          alt="D Perfume House"
          className="mx-auto mb-3 w-64 opacity-90"
          style={{ filter: 'drop-shadow(0 0 20px rgba(176, 152, 112, 0.15))' }}
        />
        <p className="text-sm text-white/50">Portal de Vendedor</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-glass-100 border border-glass-border shadow-glass backdrop-blur-xl p-6">
        {mode === 'login' ? (
          <>
            <h2 className="mb-6 text-center text-lg font-semibold text-white">
              Iniciar Sesion
            </h2>

            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                leftIcon={<Mail className="h-5 w-5" />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />

              <Input
                label="Contrasena"
                type={showPassword ? 'text' : 'password'}
                placeholder="Tu contrasena"
                autoComplete="current-password"
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
                error={loginForm.formState.errors.password?.message}
                {...loginForm.register('password')}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-white/50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-glass-border bg-glass-50 text-accent-gold focus:ring-accent-gold/50"
                    {...loginForm.register('remember')}
                  />
                  Recordarme
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-white/40 hover:text-accent-gold transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {loginError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {loginError}
                </div>
              )}

              <Button type="submit" fullWidth loading={isLoading} size="lg">
                Iniciar Sesion
              </Button>
            </form>

            {/* Divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-glass-border" />
              <span className="text-xs text-white/30">o continúa con</span>
              <div className="h-px flex-1 bg-glass-border" />
            </div>

            {/* Google Login */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => showToast('error', 'Error al iniciar con Google')}
                theme="filled_black"
                shape="pill"
                size="large"
                width="320"
                text="signin_with"
              />
            </div>

            {/* Apple Sign In — only on iOS */}
            {isIOS && (
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={appleLoading}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                {appleLoading ? 'Conectando...' : 'Iniciar con Apple'}
              </button>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
              >
                ¿No tienes cuenta? Solicitar inscripcion
              </button>
            </div>
          </>
        ) : registerSuccess ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white">Solicitud Enviada</h2>
            <p className="text-sm text-white/60 mb-6">
              Tu solicitud de inscripcion ha sido enviada. El administrador revisara tu cuenta y te notificara cuando sea aprobada.
            </p>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                setMode('login');
                setRegisterSuccess(false);
                registerForm.reset();
              }}
            >
              Volver al inicio de sesion
            </Button>
          </div>
        ) : (
          <>
            <h2 className="mb-6 text-center text-lg font-semibold text-white">
              Solicitar Inscripcion
            </h2>

            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <Input
                label="Nombre completo"
                type="text"
                placeholder="Tu nombre"
                autoComplete="name"
                leftIcon={<User className="h-5 w-5" />}
                error={registerForm.formState.errors.name?.message}
                {...registerForm.register('name')}
              />

              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                leftIcon={<Mail className="h-5 w-5" />}
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register('email')}
              />

              <PhoneInput
                label="Telefono (opcional)"
                value={registerForm.watch('phone') || ''}
                phoneCode={registerForm.watch('phoneCode') || '+57'}
                onChange={(val) => registerForm.setValue('phone', val)}
                onCodeChange={(code) => registerForm.setValue('phoneCode', code)}
                error={registerForm.formState.errors.phone?.message}
              />

              <Input
                label="Contrasena"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimo 8 caracteres"
                autoComplete="new-password"
                leftIcon={<Lock className="h-5 w-5" />}
                 autoCapitalize="none"
                 autoCorrect="off"
                 spellCheck={false}
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
                error={registerForm.formState.errors.password?.message}
                {...registerForm.register('password')}
              />

              <Input
                label="Confirmar contrasena"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite tu contrasena"
                autoComplete="new-password"
                leftIcon={<Lock className="h-5 w-5" />}
                error={registerForm.formState.errors.confirmPassword?.message}
                 autoCapitalize="none"
                 autoCorrect="off"
                 spellCheck={false}
                 {...registerForm.register('confirmPassword')}
              />

              <Button type="submit" fullWidth loading={registerLoading} size="lg">
                Enviar Solicitud
              </Button>
            </form>

            {/* Divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-glass-border" />
              <span className="text-xs text-white/30">o regístrate con</span>
              <div className="h-px flex-1 bg-glass-border" />
            </div>

            {/* Google Register */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => showToast('error', 'Error al registrar con Google')}
                theme="filled_black"
                shape="pill"
                size="large"
                width="320"
                text="signup_with"
              />
            </div>

            {/* Apple Sign In — only on iOS */}
            {isIOS && (
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={appleLoading}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                {appleLoading ? 'Conectando...' : 'Registrar con Apple'}
              </button>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  registerForm.reset();
                }}
                className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
              >
                ¿Ya tienes cuenta? Iniciar sesion
              </button>
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
