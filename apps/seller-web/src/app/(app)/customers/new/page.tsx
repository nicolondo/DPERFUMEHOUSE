'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { PhoneInput } from '@/components/ui/phone-input';
import { useCreateCustomer } from '@/hooks/use-customers';

const customerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().min(1, 'El email es obligatorio').email('Email invalido'),
  phone: z.string().min(7, 'El telefono debe tener al menos 7 digitos'),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function NewCustomerPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();
  const [showAddress, setShowAddress] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('+57');

  // Address state
  const [addressForm, setAddressForm] = useState({
    label: '',
    street: '',
    detail: '',
    phone: '',
    phoneCode: '+57',
    city: '',
    state: '',
    notes: '',
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    mode: 'onChange',
    defaultValues: {
      documentType: 'CC',
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const payload: any = {
        name: data.name,
        email: data.email || undefined,
        phone: phone || data.phone,
        phoneCode: phoneCode,
        documentType: data.documentType || undefined,
        documentNumber: data.documentNumber || undefined,
        notes: data.notes || undefined,
      };

      if (showAddress && addressForm.street && addressForm.city) {
        payload.address = {
          label: addressForm.label || 'Principal',
          street: addressForm.street,
          detail: addressForm.detail || undefined,
          phone: addressForm.phone || undefined,
          phoneCode: addressForm.phoneCode || '+57',
          city: addressForm.city,
          state: addressForm.state || '',
          country: 'CO',
          isDefault: true,
          notes: addressForm.notes || undefined,
        };
      }

      await createCustomer.mutateAsync(payload);
      router.push('/customers');
    } catch {
      // Error handled by react-query
    }
  };

  return (
    <div className="pb-24">
      <PageHeader title="Nuevo Cliente" backHref="/customers" />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 space-y-4">
        {/* Basic Info */}
        <Card>
          <h3 className="mb-4 text-base font-semibold text-white">
            Informacion Basica
          </h3>
          <div className="space-y-4">
            <Input
              label="Nombre completo *"
              placeholder="Juan Perez"
              error={errors.name?.message}
              {...register('name')}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">
                Telefono *
              </label>
              <input type="hidden" {...register('phone')} />
              <PhoneInput
                value={phone}
                phoneCode={phoneCode}
                onChange={(val) => {
                  setPhone(val);
                  setValue('phone', val, { shouldValidate: true });
                }}
                onCodeChange={setPhoneCode}
                placeholder="3001234567"
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-status-danger">{errors.phone.message}</p>
              )}
            </div>
            <Input
              label="Email *"
              placeholder="juan@email.com"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  Tipo Documento
                </label>
                <select
                  className="w-full rounded-xl border border-glass-border bg-glass-100 px-4 py-3 text-base text-white transition-colors focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20 appearance-none"
                  {...register('documentType')}
                >
                  <option value="">Seleccionar</option>
                  <option value="CC">C.C.</option>
                  <option value="CE">C.E.</option>
                  <option value="NIT">NIT</option>
                  <option value="PP">Pasaporte</option>
                </select>
              </div>
              <Input
                label="No. Documento"
                placeholder="1234567890"
                {...register('documentNumber')}
              />
            </div>
          </div>
        </Card>

        {/* Address Section */}
        <Card>
          <button
            type="button"
            onClick={() => setShowAddress(!showAddress)}
            className="flex w-full items-center justify-between"
          >
            <h3 className="text-base font-semibold text-white">
              Direccion (opcional)
            </h3>
            {showAddress ? (
              <ChevronUp className="h-5 w-5 text-white/30" />
            ) : (
              <ChevronDown className="h-5 w-5 text-white/30" />
            )}
          </button>

          {showAddress && (
            <div className="mt-4 space-y-4">
              <Input
                label="Etiqueta"
                placeholder="Ej: Casa, Oficina"
                value={addressForm.label}
                onChange={(e) => setAddressForm((p) => ({ ...p, label: e.target.value }))}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  Direccion
                </label>
                <AddressAutocomplete
                  value={addressForm.street}
                  onChange={(val) => setAddressForm((p) => ({ ...p, street: val }))}
                  onSelect={(parsed) => {
                    setAddressForm((p) => ({
                      ...p,
                      street: parsed.street,
                      city: parsed.city,
                      state: parsed.state,
                    }));
                  }}
                  placeholder="Buscar direccion..."
                />
              </div>
              <Input
                label="Detalle (Apto, Piso, Torre)"
                placeholder="Ej: Apto 301, Torre B"
                value={addressForm.detail}
                onChange={(e) => setAddressForm((p) => ({ ...p, detail: e.target.value }))}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">
                  Telefono de contacto
                </label>
                <PhoneInput
                  value={addressForm.phone}
                  phoneCode={addressForm.phoneCode}
                  onChange={(val) => setAddressForm((p) => ({ ...p, phone: val }))}
                  onCodeChange={(code) => setAddressForm((p) => ({ ...p, phoneCode: code }))}
                  placeholder="3001234567"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Ciudad"
                  value={addressForm.city}
                  readOnly
                  className="bg-glass-50 text-white/50"
                />
                <Input
                  label="Departamento"
                  value={addressForm.state}
                  readOnly
                  className="bg-glass-50 text-white/50"
                />
              </div>
              <Input
                label="Instrucciones adicionales"
                placeholder="Indicaciones para la entrega..."
                value={addressForm.notes}
                onChange={(e) => setAddressForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="pt-2 pb-4">
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={createCustomer.isPending}
            disabled={!isValid}
            className="!py-4 text-base font-semibold bg-accent-gold hover:bg-accent-gold/90 shadow-xl shadow-accent-gold/30 text-black rounded-2xl"
          >
            Crear Cliente
          </Button>
        </div>
      </form>
    </div>
  );
}
