'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Search, Phone, Mail, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { PhoneInput } from '@/components/ui/phone-input';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { getInitials, formatPhone } from '@/lib/utils';

interface SubSeller {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function SellersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-sellers'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/downline');
      return data;
    },
    enabled: !!user?.id,
  });

  const sellers: SubSeller[] = data ?? [];

  const filtered = search
    ? sellers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase())
      )
    : sellers;

  return (
    <div>
      <PageHeader
        title="Mis Vendedores"
        action={
          <Button
            size="sm"
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => setShowCreate(true)}
          >
            Nuevo
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {sellers.length > 3 && (
          <Input
            placeholder="Buscar vendedor..."
            leftIcon={<Search className="h-5 w-5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        {isLoading ? (
          <PageSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-7 w-7" />}
            title={search ? 'Sin resultados' : 'Sin vendedores'}
            description={
              search
                ? 'No se encontraron vendedores con esa busqueda'
                : 'Agrega tu primer sub-vendedor para delegarle ventas'
            }
            action={
              !search
                ? { label: 'Agregar Vendedor', onClick: () => setShowCreate(true) }
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((seller) => (
              <Card
                key={seller.id}
                className="flex items-center gap-4 p-4 active:bg-glass-200 transition-colors"
                onClick={() => router.push(`/sellers/${seller.id}`)}
              >
                {/* Avatar */}
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-purple-muted text-sm font-bold text-accent-purple">
                  {getInitials(seller.name)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">
                      {seller.name}
                    </p>
                    <Badge variant={seller.isActive ? 'success' : 'danger'}>
                      {seller.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/30 mt-0.5">
                    {seller.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhone(seller.phone)}
                      </span>
                    )}
                    {seller.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {seller.email}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-white/20" />
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSellerModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['my-sellers'] });
          }}
        />
      )}
    </div>
  );
}

function CreateSellerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('+57');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/users/me/sellers', {
        name,
        email,
        phone,
        phoneCode,
      });
      return data;
    },
    onSuccess,
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Error al crear vendedor');
    },
  });

  const canSubmit = name.trim() && email.trim() && phone.trim();

  return (
    <Modal isOpen onClose={onClose} title="Nuevo Vendedor">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-status-danger/10 border border-status-danger/20 p-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/60">
            Nombre <span className="text-status-danger">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del vendedor"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/60">
            Email <span className="text-status-danger">*</span>
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendedor@ejemplo.com"
          />
        </div>

        <PhoneInput
          label="Telefono *"
          value={phone}
          onChange={setPhone}
          phoneCode={phoneCode}
          onCodeChange={setPhoneCode}
          placeholder="3001234567"
        />

        <div className="rounded-xl bg-accent-purple-muted/30 border border-accent-purple/20 p-3">
          <p className="text-xs text-white/50">
            Se enviará un correo electrónico al vendedor con un enlace para crear su contraseña.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} fullWidth>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
            fullWidth
          >
            Crear Vendedor
          </Button>
        </div>
      </div>
    </Modal>
  );
}
