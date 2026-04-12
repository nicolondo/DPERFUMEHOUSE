'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User,
  Building2,
  Wallet,
  Upload,
  Save,
  FileCheck,
  Loader2,
  CheckCircle,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthStore } from '@/store/auth.store';
import api, { unwrap } from '@/lib/api';
import { formatPhone } from '@/lib/utils';

export default function ConfigPage() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [seller, setSeller] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bankData, setBankData] = useState({
    bankName: '',
    bankAccountType: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
  });

  const [walletForm, setWalletForm] = useState({
    usdtWallet: '',
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError('');
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Error al cambiar la contraseña';
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Fetch seller data
  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const { data } = await api.get('/users/me');
        const s = unwrap(data);
        setSeller(s);
        setBankData({
          bankName: s?.bankName || '',
          bankAccountType: s?.bankAccountType || '',
          bankAccountNumber: s?.bankAccountNumber || '',
          bankAccountHolder: s?.bankAccountHolder || '',
        });
        setWalletForm({
          usdtWallet: s?.usdtWalletTrc20 || '',
        });
      } catch {
        // silently handle
      } finally {
        setIsLoading(false);
      }
    };
    fetchSeller();
  }, []);

  const handleCertificateUpload = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/users/me/analyze-certificate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = unwrap(data);

      setBankData({
        bankName: result.bankName || '',
        bankAccountType: result.bankAccountType || '',
        bankAccountNumber: result.bankAccountNumber || '',
        bankAccountHolder: result.bankAccountHolder || '',
      });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al analizar la certificacion');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveWallet = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/users/me/bank-info', {
        ...bankData,
        usdtWalletTrc20: walletForm.usdtWallet,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageSpinner />;

  const hasBankData = bankData.bankName || bankData.bankAccountNumber;

  return (
    <div className="pb-24">
      <PageHeader title="Configuracion" />

      <div className="px-4 space-y-4">
        {/* Profile Card (read-only) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white">Perfil</span>
            </div>
            <Badge variant="purple">Vendedor</Badge>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/30">Nombre</p>
                <p className="text-sm font-medium text-white">
                  {seller?.name || user?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/30">Email</p>
                <p className="text-sm font-medium text-white">
                  {seller?.email || user?.email || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/30">Telefono</p>
                <p className="text-sm font-medium text-white">
                  {formatPhone(seller?.phone)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/30">Comisión</p>
                {seller?.commissionScaleEnabled && seller?.effectiveScaleTiers?.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {seller.effectiveScaleTiers.map((tier: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm text-white">
                        <span className="text-white/50">
                          {tier.maxSales
                            ? `$${(tier.minSales / 1000000).toFixed(0)}M – $${(tier.maxSales / 1000000).toFixed(0)}M`
                            : `$${(tier.minSales / 1000000).toFixed(0)}M+`}
                        </span>
                        <span className="font-medium text-accent-purple">{tier.ratePercent}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-white">
                    {seller?.commissionRate ? `${(seller.commissionRate * 100).toFixed(0)}%` : '-'}
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Bank Data Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white">
                Datos Bancarios
              </span>
            </div>
            {hasBankData && (
              <Badge variant="success">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verificado
              </Badge>
            )}
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {/* Upload Certificate */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCertificateUpload(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-glass-border bg-glass-50 px-4 py-5 text-sm transition-colors hover:border-accent-purple/50 hover:bg-glass-100 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-accent-purple" />
                      <span className="text-accent-purple font-medium">
                        Analizando con IA...
                      </span>
                    </>
                  ) : hasBankData ? (
                    <>
                      <FileCheck className="h-5 w-5 text-accent-purple" />
                      <span className="text-accent-purple font-medium">
                        Cambiar certificacion bancaria
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-accent-purple" />
                      <span className="text-accent-purple font-medium">
                        Subir certificacion bancaria
                      </span>
                    </>
                  )}
                </button>
                <p className="mt-2 text-center text-xs text-white/30">
                  Sube tu certificacion y la IA extraera los datos automaticamente
                </p>
              </div>

              {/* Readonly bank fields */}
              {hasBankData && (
                <div className="space-y-3 rounded-xl bg-glass-50 p-4">
                  <div>
                    <p className="text-xs text-white/30">Banco</p>
                    <p className="text-sm font-medium text-white">
                      {bankData.bankName || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/30">Tipo de Cuenta</p>
                    <p className="text-sm font-medium text-white capitalize">
                      {bankData.bankAccountType || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/30">Numero de Cuenta</p>
                    <p className="text-sm font-medium text-white font-mono">
                      {bankData.bankAccountNumber || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/30">Titular</p>
                    <p className="text-sm font-medium text-white">
                      {bankData.bankAccountHolder || '-'}
                    </p>
                  </div>
                </div>
              )}

              {!hasBankData && !isAnalyzing && (
                <div className="rounded-xl bg-status-warning-muted p-4 text-center">
                  <p className="text-sm text-status-warning">
                    Sube tu certificacion bancaria para completar tu perfil de pagos
                  </p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Crypto Wallet Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white">
                Wallet Cripto
              </span>
            </div>
          </CardHeader>
          <CardBody>
            <Input
              label="Direccion USDT (TRC20)"
              placeholder="T..."
              value={walletForm.usdtWallet}
              onChange={(e) =>
                setWalletForm({ usdtWallet: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-white/30">Solo red TRC20 (Tron)</p>
          </CardBody>
        </Card>

        {/* Save button (only for wallet) */}
        <div className="pt-2 pb-4">
          <Button
            fullWidth
            size="lg"
            onClick={handleSaveWallet}
            loading={isSaving}
            className="!py-4 text-base font-semibold bg-accent-gold hover:bg-accent-gold/90 shadow-xl shadow-accent-gold/30 text-black rounded-2xl"
          >
            {saveSuccess ? 'Guardado!' : 'Guardar'}
          </Button>
        </div>

        {saveSuccess && (
          <p className="text-center text-sm text-status-success font-medium -mt-2">
            Los cambios se guardaron correctamente
          </p>
        )}

        {/* Change Password Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white">Cambiar Contraseña</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  label="Contraseña actual"
                  type={showCurrentPw ? 'text' : 'password'}
                  placeholder="Tu contraseña actual"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-[38px] text-white/30 hover:text-white/60"
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="Nueva contraseña"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Minimo 8 caracteres"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-[38px] text-white/30 hover:text-white/60"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                label="Confirmar nueva contraseña"
                type="password"
                placeholder="Repite la nueva contraseña"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              />
              {passwordError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
                  Contraseña cambiada exitosamente
                </div>
              )}
              <Button
                fullWidth
                onClick={handleChangePassword}
                loading={passwordLoading}
                disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                Cambiar Contraseña
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
