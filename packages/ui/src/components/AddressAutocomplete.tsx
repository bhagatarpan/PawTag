import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import type { AddressAutocompleteProps, AddressComponents } from '../types';

interface PhotonFeature {
  properties: {
    housenumber?: string;
    street?: string;
    name?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
}

function mapPhotonToAddress(feature: PhotonFeature): AddressComponents {
  const p = feature.properties;
  return {
    line1: [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '',
    line2: p.district || '',
    city: p.city || '',
    state: p.state || '',
    zip: p.postcode || '',
    country: p.countrycode || 'NZ',
  };
}

export function AddressAutocomplete({
  onAddressSelect,
  value,
  onChange,
  placeholder = 'Start typing your address...',
  defaultCountry = 'NZ',
  className = '',
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressComponents[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setNoResults(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '5',
        lang: 'en',
        countrycode: defaultCountry,
      });
      const res = await fetch(`https://photon.komoot.io/api/?${params}`);
      const data = await res.json();
      const mapped = (data.features || []).map(mapPhotonToAddress);
      setSuggestions(mapped);
      setIsOpen(mapped.length > 0);
      setNoResults(mapped.length === 0);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
      setNoResults(false);
    } finally {
      setIsLoading(false);
    }
  }, [defaultCountry]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setNoResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (address: AddressComponents) => {
    onChange(address.line1);
    onAddressSelect(address);
    setIsOpen(false);
    setNoResults(false);
    inputRef.current?.focus();
  };

  const handleDismissNoResults = () => {
    setNoResults(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 pr-10 ${className}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : (
            <MapPin className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-teal-50 border-b border-gray-100 last:border-0 flex items-start gap-2 transition-colors"
            >
              <MapPin className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                {suggestion.line1}
                {suggestion.city && <>, {suggestion.city}</>}
                {suggestion.state && <>, {suggestion.state}</>}
                {suggestion.zip && <> {suggestion.zip}</>}
              </span>
            </button>
          ))}
        </div>
      )}

      {noResults && value.length >= 2 && (
        <p className="mt-1 text-xs text-gray-500">
          Address not found?{' '}
          <button
            type="button"
            onClick={handleDismissNoResults}
            className="text-teal-600 hover:underline font-medium"
          >
            Enter address manually
          </button>
        </p>
      )}
    </div>
  );
}
