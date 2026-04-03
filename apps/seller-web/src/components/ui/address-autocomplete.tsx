'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  lat?: number;
  lng?: number;
  formattedAddress: string;
}

interface AddressAutocompleteProps {
  value?: string;
  onSelect: (address: ParsedAddress) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  country?: string;
}

// Global script loader
let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (googleMapsPromise) return googleMapsPromise;

  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    googleMapsPromise = Promise.resolve();
    return googleMapsPromise;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('Google Maps API key not configured');
    return Promise.resolve();
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function parsePlace(place: google.maps.places.PlaceResult): ParsedAddress {
  const components = place.address_components || [];

  const getComponent = (type: string, useShort = false): string => {
    const comp = components.find((c) => c.types.includes(type));
    return comp ? (useShort ? comp.short_name : comp.long_name) : '';
  };

  const streetNumber = getComponent('street_number');
  const route = getComponent('route');
  const street = [route, streetNumber].filter(Boolean).join(' ') || '';

  return {
    street: street || place.name || '',
    city:
      getComponent('locality') ||
      getComponent('administrative_area_level_2') ||
      getComponent('sublocality_level_1') ||
      '',
    state: getComponent('administrative_area_level_1'),
    country: getComponent('country', true),
    lat: place.geometry?.location?.lat(),
    lng: place.geometry?.location?.lng(),
    formattedAddress: place.formatted_address || '',
  };
}

export function AddressAutocomplete({
  value = '',
  onSelect,
  onChange,
  placeholder = 'Buscar direccion...',
  label,
  error,
  className,
  country = 'co',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState(value);

  // Use refs for callbacks to avoid stale closures
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Load Google Maps script
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setIsLoaded(true);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });

    // Fix: enable touch scrolling on Google Places dropdown
    // The .pac-container is appended to body; we need to ensure touch events work
    const observer = new MutationObserver(() => {
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach((container) => {
        if (!container.getAttribute('data-touch-fixed')) {
          container.setAttribute('data-touch-fixed', 'true');
          container.addEventListener('touchmove', (e) => {
            e.stopPropagation();
          }, { passive: true });
        }
      });
    });

    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  // Initialize autocomplete - only once when loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country },
      fields: [
        'address_components',
        'formatted_address',
        'geometry',
        'name',
      ],
      types: ['geocode', 'establishment'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place && place.address_components) {
        const parsed = parsePlace(place);
        console.log('Google Maps parsed:', JSON.stringify(parsed));
        setInputValue(parsed.street);
        // Use refs to always call the latest callback
        onSelectRef.current(parsed);
        onChangeRef.current?.(parsed.street);
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, country]);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleClear = useCallback(() => {
    setInputValue('');
    onChangeRef.current?.('');
    inputRef.current?.focus();
  }, []);

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <MapPin className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChangeRef.current?.(e.target.value);
          }}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-xl border bg-white py-3 pl-10 pr-10 text-base text-gray-900',
            'placeholder:text-gray-400',
            'focus:border-brand-purple-500 focus:outline-none focus:ring-2 focus:ring-brand-purple-500/20',
            'transition-colors duration-150',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200',
          )}
          autoComplete="off"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
