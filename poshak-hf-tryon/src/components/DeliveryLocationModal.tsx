import React, { useState } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import type { DeliveryLocation } from '../types/poshak';
import { PRESET_LOCATIONS, resolveDeliveryLocation } from '../utils/commerce';

interface DeliveryLocationModalProps {
  open: boolean;
  current: DeliveryLocation;
  onClose: () => void;
  onSelectLocation: (loc: DeliveryLocation) => void;
}

export const DeliveryLocationModal: React.FC<DeliveryLocationModalProps> = ({
  open,
  current,
  onClose,
  onSelectLocation,
}) => {
  const [pincode, setPincode] = useState(current.pincode);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = resolveDeliveryLocation(pincode);
    if (!resolved) {
      setError('Please enter a valid 6-digit pincode.');
      return;
    }
    setError('');
    onSelectLocation(resolved);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose your delivery location"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EFECE6] bg-[#F3F1EC] px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
            <MapPin className="h-4 w-4 text-[#9A7B4F]" aria-hidden="true" />
            <span>Choose delivery destination</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location selector"
            className="rounded-full p-1 text-[#625F59] hover:text-[#171717] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-xs text-[#625F59]">
            Delivery timelines vary by city and pincode. Select a metro or enter your pincode.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {PRESET_LOCATIONS.map((loc) => {
              const active = loc.pincode === current.pincode;
              return (
                <button
                  key={loc.pincode}
                  type="button"
                  onClick={() => {
                    onSelectLocation(loc);
                    onClose();
                  }}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    active
                      ? 'border-[#171717] bg-[#F3F1EC] text-[#171717]'
                      : 'border-[#E5E1D8] bg-white text-[#171717] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{loc.city}</p>
                    <p className="font-mono-num text-[11px] text-[#625F59]">{loc.pincode}</p>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleApply} className="border-t border-[#EFECE6] pt-4">
            <label htmlFor="delivery-pincode" className="block text-xs font-semibold text-[#171717]">
              Or enter an Indian pincode
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="delivery-pincode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 400001"
                className="font-mono-num flex-1 rounded-lg border border-[#DDD8CE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#171717] px-4 py-2 text-xs font-semibold text-[#FAF9F6] hover:bg-[#2E2E2E] cursor-pointer"
              >
                Apply
              </button>
            </div>
            {error && <p className="mt-1.5 text-xs text-[#9E3B33]">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};
