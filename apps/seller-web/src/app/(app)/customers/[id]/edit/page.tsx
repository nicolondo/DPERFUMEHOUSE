'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { PhoneInput } from '@/components/ui/phone-input';
import { useCustomer, useUpdateCustomer } from '@/hooks/use-customers';
import { useToast } from '@/components/ui/toast';

const customerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().min(1, 'El email es obligatorio').email('Email invalido'),
  phone: z.string().min(7, 'El telefono debe tener al menos 7 digitos'),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const { showToast } = useToast();
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('+57');
  const [docNumber, setDocNumber] = useState('');

  // Format NIT: insert dash after 9th digit
  const applyNitFormat = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 10);
    if (digits.length > 9) return digits.slice(0, 9) + '-' + digits[9];
    return digits;
  };

  const handleDocNumberChange = (value: string, docType: string) => {
    if (docType === 'NIT') {
      const digits = value.replace(/[^0-9]/g, '').slice(0, 10); // max 10 digits (9 base + 1 verif)
      // After 9 digits, show dash before the 10th (verification digit)
      const formatted = digits.length > 9 ? digits.slice(0, 9) + '-' + digits[9] : digits;
      setDocNumber(formatted);
      setValue('documentNumber', digits, { shouldValidate: true, shouldDirty: true });
    } else {
      setDocNumber(value);
      setValue('documentNumber', value, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleDocNumberBlur = (_docType: string) => {
    // nothing needed anymore, formatting happens on change
  };

  const handleDocTypeChange = (newType: string) => {
    setValue('documentType', newType, { shouldDirty: true });
    const digits = docNumber.replace(/[^0-9]/g, '').slice(0, 10);
    if (newType === 'NIT' && digits.length > 9) {
      setDocNumber(digits.slice(0, 9) + '-' + digits[9]);
    } else {
      setDocNumber(digits);
    }
    setValue('documentNumber', digits, { shouldDirty: true });
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        documentType: customer.documentType || '',
        documentNumber: customer.documentNumber || '',
        notes: customer.notes || '',
      });
      setPhone(customer.phone || '');
      setPhoneCode(customer.phoneCode || '+57');
      // Show stored document number; if NIT, display with dash
      const num = customer.documentNumber || '';
      const digits = num.replace(/[^0-9]/g, '').slice(0, 10);
      if (customer.documentType === 'NIT' && digits.length > 9) {
        setDocNumber(digits.slice(0, 9) + '-' + digits[9]);
      } else {
        setDocNumber(num);
      }
    }
  }, [customer, reset]);

  const watchedDocType = watch('documentType');

  const onSubmit = async (data: CustomerFormData) => {
    if (!id) return;
    try {
      await updateCustomer.mutateAsync({
        id,
        name: data.name,
        email: data.email || undefined,
        phone: phone || data.phone,
        documentType: data.documentType || undefined,
        documentNumber: data.documentNumber || undefined,
        notes: data.notes || undefined,
      });
      router.push(`/customers/${id}`);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Error al guardar';
      showToast('error', msg);
    }
  };

  if (isLoading) return <PageSpinner />;

  if (!customer) {
    return (
      <div>
        <PageHeader title="Editar Cliente" backHref="/customers" />
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Cliente no encontrado"
          description="Este cliente no existe o fue eliminado"
        />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader title="Editar Cliente" backHref={`/customers/${id}`} />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 space-y-4">
        <Card>
          <h3 className="mb-4 text-base font-semibold text-white">
            Informacion del Cliente
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
                  setValue('phone', val, { shouldValidate: true, shouldDirty: true });
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
                  className="w-full rounded-xl border border-glass-border bg-glass-50 px-4 py-3 text-base text-white transition-colors focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/30"
                  value={watchedDocType || ''}
                  onChange={(e) => handleDocTypeChange(e.target.value)}
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
                placeholder={watchedDocType === 'NIT' ? '900458387-6' : '1234567890'}
                value={docNumber}
                onChange={(e) => handleDocNumberChange(e.target.value, watchedDocType || '')}
                onBlur={() => handleDocNumberBlur(watchedDocType || '')}
              />
            </div>
            <Input
              label="Notas"
              placeholder="Notas sobre el cliente..."
              {...register('notes')}
            />
          </div>
        </Card>

        <div className="pt-2 pb-4">
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={updateCustomer.isPending}
            disabled={!isValid}
            className="!py-4 text-base font-semibold bg-accent-gold hover:bg-accent-gold/90 shadow-xl shadow-accent-gold/30 text-black rounded-2xl"
          >
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
