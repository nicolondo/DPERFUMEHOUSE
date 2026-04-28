'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { code: 'EC', name: 'Ecuador', dial: '+593', flag: '🇪🇨' },
  { code: 'PE', name: 'Peru', dial: '+51', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela', dial: '+58', flag: '🇻🇪' },
  { code: 'PA', name: 'Panama', dial: '+507', flag: '🇵🇦' },
  { code: 'CR', name: 'Costa Rica', dial: '+506', flag: '🇨🇷' },
  { code: 'DO', name: 'Republica Dominicana', dial: '+1', flag: '🇩🇴' },
  { code: 'GT', name: 'Guatemala', dial: '+502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', dial: '+504', flag: '🇭🇳' },
  { code: 'SV', name: 'El Salvador', dial: '+503', flag: '🇸🇻' },
  { code: 'NI', name: 'Nicaragua', dial: '+505', flag: '🇳🇮' },
  { code: 'BO', name: 'Bolivia', dial: '+591', flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay', dial: '+595', flag: '🇵🇾' },
  { code: 'UY', name: 'Uruguay', dial: '+598', flag: '🇺🇾' },
  { code: 'CU', name: 'Cuba', dial: '+53', flag: '🇨🇺' },
  { code: 'PR', name: 'Puerto Rico', dial: '+1', flag: '🇵🇷' },
  { code: 'US', name: 'Estados Unidos', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'ES', name: 'Espana', dial: '+34', flag: '🇪🇸' },
  { code: 'FR', name: 'Francia', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania', dial: '+49', flag: '🇩🇪' },
  { code: 'IT', name: 'Italia', dial: '+39', flag: '🇮🇹' },
  { code: 'GB', name: 'Reino Unido', dial: '+44', flag: '🇬🇧' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
];

interface PhoneInputProps {
  /** Phone number without country code (digits only, e.g. "3001234567") */
  value: string;
  /** Called with the raw phone number (digits only) */
  onChange: (value: string) => void;
  /** Current country dial code (e.g. "+57"). Defaults to "+57" */
  phoneCode?: string;
  /** Called when country code changes */
  onCodeChange?: (code: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  className?: string;
  defaultCountry?: string;
}

export function PhoneInput({
  value,
  onChange,
  phoneCode,
  onCodeChange,
  label,
  placeholder = 'Numero de telefono',
  error,
  className,
  defaultCountry = 'CO',
}: PhoneInputProps) {
  const findCountryByDial = (dial: string) =>
    COUNTRIES.find((c) => c.dial === dial);
  const findCountryByCode = (code: string) =>
    COUNTRIES.find((c) => c.code === code);

  const getInitialCountry = () => {
    if (phoneCode) {
      const match = findCountryByDial(phoneCode);
      if (match) return match;
    }
    // Legacy: if value starts with +, parse country code from it
    if (value && value.startsWith('+')) {
      const match = COUNTRIES.find((c) => value.startsWith(c.dial));
      if (match) return match;
    }
    return findCountryByCode(defaultCountry) || COUNTRIES[0];
  };

  const getInitialNumber = () => {
    if (!value) return '';
    // Legacy: strip country code prefix if present
    if (value.startsWith('+')) {
      const country = getInitialCountry();
      return value.startsWith(country.dial)
        ? value.slice(country.dial.length).replace(/\D/g, '')
        : value.replace(/^\+\d+/, '').replace(/\D/g, '');
    }
    return value.replace(/\D/g, '');
  };

  const [selectedCountry, setSelectedCountry] = useState<Country>(getInitialCountry);
  const [phoneNumber, setPhoneNumber] = useState(getInitialNumber);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync country when phoneCode prop changes
  useEffect(() => {
    if (!phoneCode) return;
    if (selectedCountry.dial === phoneCode) return;
    const country = findCountryByDial(phoneCode);
    if (country) setSelectedCountry(country);
  }, [phoneCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync number when value prop changes externally
  useEffect(() => {
    if (value === undefined || value === null) return;
    const clean = value.startsWith('+')
      ? (() => {
          const country = COUNTRIES.find((c) => value.startsWith(c.dial));
          if (country) {
            // Legacy value with code — strip and update country
            setSelectedCountry(country);
            onCodeChange?.(country.dial);
            return value.slice(country.dial.length).replace(/\D/g, '');
          }
          return value.replace(/^\+\d+/, '').replace(/\D/g, '');
        })()
      : value.replace(/\D/g, '');
    if (clean !== phoneNumber) setPhoneNumber(clean);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    const q = searchQuery.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery('');
    onCodeChange?.(country.dial);
  };

  const handlePhoneChange = (num: string) => {
    const clean = num.replace(/\D/g, '');
    setPhoneNumber(clean);
    onChange(clean);
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-white/70">
          {label}
        </label>
      )}
      <div className="relative flex" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-1 rounded-l-xl border border-r-0 border-glass-border bg-glass-50 px-3 py-3 text-sm transition-colors',
            'hover:bg-white/10 focus:outline-none',
            error ? 'border-red-500/50' : '',
          )}
        >
          <span className="text-base">{selectedCountry.flag}</span>
          <span className="text-white/70 font-medium">{selectedCountry.dial}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>

        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'flex-1 rounded-r-xl border border-glass-border bg-glass-50 py-3 px-3 text-base text-white/70',
            'placeholder:text-white/30',
            'focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-500/20',
            error ? 'border-red-500/50' : '',
          )}
        />

        {isOpen && (
          <div className="absolute left-0 top-full z-[9999] mt-1 w-72 rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="relative border-b border-gray-100 p-2">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pais..."
                className="w-full rounded-lg bg-gray-50 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto overscroll-contain">
              {filteredCountries.length === 0 ? (
                <p className="p-3 text-center text-sm text-gray-400">
                  No se encontraron paises
                </p>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => handleCountrySelect(country)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                      'hover:bg-brand-purple-50',
                      selectedCountry.code === country.code && 'bg-brand-purple-50 font-medium',
                    )}
                  >
                    <span className="text-base">{country.flag}</span>
                    <span className="flex-1 text-gray-900">{country.name}</span>
                    <span className="text-gray-400">{country.dial}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
