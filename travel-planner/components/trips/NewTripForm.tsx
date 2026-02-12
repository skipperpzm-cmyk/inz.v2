"use client";

import React, { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../ui/button';

type TripTypeOption = {
  value: string;
  label: string;
};

type FormState = {
  title: string;
  description: string;
  country: string;
  city: string;
  tripType: string;
  startDate: string;
  endDate: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type Props = {
  tripTypes: TripTypeOption[];
};

const initialState: FormState = {
  title: '',
  description: '',
  country: '',
  city: '',
  tripType: 'city-break',
  startDate: '',
  endDate: '',
};

export default function NewTripForm({ tripTypes }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({ ...initialState, tripType: tripTypes[0]?.value ?? 'city-break' }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (state: FormState): FieldErrors => {
    const nextErrors: FieldErrors = {};
    if (state.title.trim().length < 3) {
      nextErrors.title = 'Tytuł musi mieć co najmniej 3 znaki.';
    }
    if (state.country.trim().length < 2) {
      nextErrors.country = 'Podaj kraj.';
    }
    if (!state.startDate) {
      nextErrors.startDate = 'Data rozpoczęcia jest wymagana.';
    }
    if (!state.endDate) {
      nextErrors.endDate = 'Data zakończenia jest wymagana.';
    }
    if (state.startDate && state.endDate) {
      const start = Date.parse(`${state.startDate}T00:00:00Z`);
      const end = Date.parse(`${state.endDate}T00:00:00Z`);
      if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
        nextErrors.endDate = 'Data zakończenia musi być późniejsza niż rozpoczęcia.';
      }
    }
    if (state.description.length > 2000) {
      nextErrors.description = 'Opis może mieć maksymalnie 2000 znaków.';
    }
    if (state.city.length > 200) {
      nextErrors.city = 'Nazwa miasta jest za długa.';
    }
    return nextErrors;
  };

  const hasInvalidDates = useMemo(() => {
    if (!form.startDate || !form.endDate) return true;
    const start = Date.parse(`${form.startDate}T00:00:00Z`);
    const end = Date.parse(`${form.endDate}T00:00:00Z`);
    return Number.isNaN(start) || Number.isNaN(end) || start >= end;
  }, [form.startDate, form.endDate]);

  const durationPreview = useMemo(() => {
    if (hasInvalidDates) return null;
    const start = Date.parse(`${form.startDate}T00:00:00Z`);
    const end = Date.parse(`${form.endDate}T00:00:00Z`);
    const diff = Math.floor((end - start) / 86_400_000);
    if (diff <= 0) return null;
    return `${diff} dni`;
  }, [form.startDate, form.endDate, hasInvalidDates]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          country: form.country.trim(),
          city: form.city.trim() || null,
          tripType: form.tripType,
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setApiError(data?.message ?? 'Nie udało się utworzyć podróży.');
        return;
      }

      setForm({ ...initialState, tripType: form.tripType });
      setErrors({});
      router.refresh();
    } catch (error) {
      setApiError('Wystąpił błąd sieci. Spróbuj ponownie.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div>
        <label className="text-sm font-medium text-slate-200">Tytuł *</label>
        <input
          type="text"
          value={form.title}
          onChange={handleChange('title')}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
          placeholder="np. Weekend w Lizbonie"
        />
        {errors.title && <p className="mt-1 text-xs text-rose-300">{errors.title}</p>}
      </div>

      <div>
        <label className="text-sm font-medium text-slate-200">Opis</label>
        <textarea
          value={form.description}
          onChange={handleChange('description')}
          className="mt-2 w-full resize-none overflow-auto max-h-40 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
          rows={3}
          placeholder="Krótki opis lub cele podróży"
        />
        {errors.description && <p className="mt-1 text-xs text-rose-300">{errors.description}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-200">Kraj *</label>
          <input
            type="text"
            value={form.country}
            onChange={handleChange('country')}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
            placeholder="np. Portugalia"
          />
          {errors.country && <p className="mt-1 text-xs text-rose-300">{errors.country}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-200">Miasto</label>
          <input
            type="text"
            value={form.city}
            onChange={handleChange('city')}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
            placeholder="np. Lizbona"
          />
          {errors.city && <p className="mt-1 text-xs text-rose-300">{errors.city}</p>}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-200">Typ podróży *</label>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Wybierz typ podróży">
          {(() => {
            const base = 'w-full text-left rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ease-in-out flex items-center justify-center overflow-hidden backdrop-blur-sm';
            const selectedClasses = 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md';
            const notSelected = 'bg-white/5 text-white hover:bg-white/6';

            function TripTypeButton({ option }: { option: TripTypeOption }) {
              const selected = form.tripType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-pressed={selected}
                  aria-label={option.label}
                  onClick={() => setForm((p) => ({ ...p, tripType: option.value }))}
                  className={`${base} ${selected ? selectedClasses : notSelected} active:scale-95 trip-type-btn focus:outline-none`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              );
            }

            return tripTypes.map((option) => <TripTypeButton key={option.value} option={option} />);
          })()}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-200">Data rozpoczęcia *</label>
          <input
            type="date"
            value={form.startDate}
            onChange={handleChange('startDate')}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          />
          {errors.startDate && <p className="mt-1 text-xs text-rose-300">{errors.startDate}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-200">Data zakończenia *</label>
          <input
            type="date"
            value={form.endDate}
            onChange={handleChange('endDate')}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          />
          {errors.endDate && <p className="mt-1 text-xs text-rose-300">{errors.endDate}</p>}
        </div>
      </div>

      {durationPreview && <p className="text-xs text-slate-300">Szacowany czas trwania: {durationPreview}</p>}

      {apiError && <p className="text-sm text-rose-300">{apiError}</p>}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-slate-400">Czas trwania obliczamy automatycznie po zapisaniu.</p>
        <Button
          type="submit"
          disabled={submitting || hasInvalidDates}
          className="w-full md:w-auto rounded-xl px-4 py-2 text-white transition-all duration-300 ease-in-out shadow-[0_8px_22px_rgba(2,6,23,0.28)]"
        >
          {submitting ? 'Zapisywanie…' : 'Zapisz podróż'}
        </Button>
      </div>
    </form>
  );
}
