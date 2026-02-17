"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  ArrowRightCircleIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useBoard } from '../../hooks/useBoard';
import type {
  BoardComment,
  BoardPost,
  BoardTravelInfo,
  TravelInfoAccommodation,
  TravelInfoDetails,
  TravelInfoDocuments,
  TravelInfoFlight,
  TravelInfoTransport,
  TravelInfoType,
} from '../../types/board';
import { useToast } from '../toast/ToastProvider';
import { useGroupContext } from '../../contexts/GroupContext';
import type { GroupMember } from '../../types/group';
import { getBrowserSupabase } from '../../lib/supabaseClient';
import Card from '../Card';
import Modal from '../Modal';
import Button from '../ui/button';

type Participant = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type BoardMember = {
  id: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return 'Brak daty';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Brak daty';
  return parsed.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Brak daty';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Brak daty';
  return parsed.toLocaleString('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function getDayLabel(dateLike: string) {
  try {
    const d = new Date(dateLike);
    return d.toLocaleDateString('pl-PL', {
      weekday: 'long',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return 'Nieznany dzień';
  }
}

function normalizeLoose(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function splitLocation(value?: string | null) {
  const raw = (value ?? '').trim();
  if (!raw) return { city: '', country: '' };
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0] ?? '', country: parts.slice(1).join(', ') };
  }
  if (COUNTRY_NAME_LOOKUP.has(normalizeLoose(raw))) {
    return { city: '', country: raw };
  }
  return { city: raw, country: '' };
}

function composeLocation(city: string, country: string) {
  const cityTrimmed = city.trim();
  const countryTrimmed = country.trim();
  if (cityTrimmed && countryTrimmed) return `${cityTrimmed}, ${countryTrimmed}`;
  return cityTrimmed || countryTrimmed;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function parseIsoDate(value?: string | null) {
  if (!value || !isValidIsoDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getCalendarGrid(month: Date) {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      iso: toIsoDate(date),
      inCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type CountryOption = { code: string; name: string; flagUrl: string };
type CitySuggestion = { name: string; countryCode: string; countryName: string };

const COUNTRY_REGION_CODES = [
  'AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY',
  'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA',
  'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CD', 'CG', 'CR', 'CI', 'HR', 'CU', 'CY', 'CZ', 'DK', 'DJ',
  'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FJ', 'FI', 'FR', 'GA', 'GM', 'GE',
  'DE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GY', 'HT', 'HN', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ',
  'IE', 'IL', 'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB',
  'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MR', 'MU', 'MX',
  'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG',
  'MK', 'NO', 'OM', 'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT', 'QA', 'RO', 'RU', 'RW',
  'KN', 'LC', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO',
  'ZA', 'SS', 'ES', 'LK', 'SD', 'SR', 'SE', 'CH', 'SY', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT',
  'TN', 'TR', 'TM', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ', 'VU', 'VE', 'VN', 'YE', 'ZM',
  'ZW', 'PS', 'VA',
] as const;

const COUNTRY_DISPLAY_NAMES = new Intl.DisplayNames(['pl'], { type: 'region' });
const COUNTRY_NAME_LOOKUP = new Set(
  COUNTRY_REGION_CODES.map((code) => normalizeLoose(COUNTRY_DISPLAY_NAMES.of(code) ?? code))
);

function buildTripDays(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return [] as { key: string; label: string }[];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const days: { key: string; label: string }[] = [];
  const current = new Date(start);
  while (current <= end && days.length < 31) {
    const key = current.toISOString().slice(0, 10);
    days.push({ key, label: getDayLabel(current.toISOString()) });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function groupPostsByDay(posts: BoardPost[]) {
  const groups = new Map<string, BoardPost[]>();
  for (const post of posts) {
    const key = post.createdAt.slice(0, 10);
    const prev = groups.get(key) ?? [];
    prev.push(post);
    groups.set(key, prev);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, dayPosts]) => ({
      key,
      label: getDayLabel(key),
      posts: dayPosts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    }));
}

type TravelInfoPayloadByType = {
  flight: TravelInfoFlight;
  accommodation: TravelInfoAccommodation;
  transport: TravelInfoTransport;
  documents: TravelInfoDocuments;
  transfer: TravelInfoTransport;
};

const TRAVEL_INFO_ITEMS: Array<{
  type: TravelInfoType;
  label: string;
  Icon: React.ComponentType<React.ComponentProps<'svg'>>;
}> = [
  { type: 'transfer', label: 'Dojazd', Icon: ArrowRightCircleIcon },
  { type: 'flight', label: 'Lot', Icon: PaperAirplaneIcon },
  { type: 'accommodation', label: 'Zakwaterowanie', Icon: BuildingOffice2Icon },
  { type: 'transport', label: 'Transport lokalny', Icon: TruckIcon },
  { type: 'documents', label: 'Dokumenty', Icon: DocumentTextIcon },
];

const DEFAULT_FLIGHT: TravelInfoFlight = {
  flightNumber: '',
  flightDate: '',
  departureTime: '',
  from: '',
  to: '',
  airline: '',
};

const DEFAULT_ACCOMMODATION: TravelInfoAccommodation = {
  propertyName: '',
  address: '',
  checkInDate: '',
  checkInTime: '',
  checkOutDate: '',
  checkOutTime: '',
  reservationNumber: '',
};

const DEFAULT_TRANSPORT: TravelInfoTransport = {
  mode: '',
  departureTime: '',
  from: '',
  to: '',
};

const DEFAULT_DOCUMENTS: TravelInfoDocuments = {
  notes: '',
};

const EMPTY_DETAILS: TravelInfoDetails = {
  flight: DEFAULT_FLIGHT,
  accommodation: DEFAULT_ACCOMMODATION,
  transport: DEFAULT_TRANSPORT,
  documents: DEFAULT_DOCUMENTS,
  transfer: DEFAULT_TRANSPORT,
};

function mergeDetails(details?: TravelInfoDetails): TravelInfoDetails {
  return {
    flight: { ...EMPTY_DETAILS.flight, ...(details?.flight ?? {}) },
    accommodation: { ...EMPTY_DETAILS.accommodation, ...(details?.accommodation ?? {}) },
    transport: { ...EMPTY_DETAILS.transport, ...(details?.transport ?? {}) },
    documents: { ...EMPTY_DETAILS.documents, ...(details?.documents ?? {}) },
    transfer: { ...EMPTY_DETAILS.transfer, ...(details?.transfer ?? {}) },
  };
}

const TravelInfoBar = React.memo(function TravelInfoBar({
  activeType,
  onSelect,
}: {
  activeType: TravelInfoType | null;
  onSelect: (type: TravelInfoType) => void;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-2">
      {TRAVEL_INFO_ITEMS.map(({ type, label, Icon }) => {
        const active = activeType === type;
        return (
          <button
            key={type}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onSelect(type)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-white/16 text-white' : 'bg-white/5 text-white/70'}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
});

const TravelInfoFormFlight = React.memo(function TravelInfoFormFlight({
  value,
  onChange,
}: {
  value: TravelInfoFlight;
  onChange: (next: Partial<TravelInfoFlight>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Numer lotu" value={value.flightNumber ?? ''} onChange={(e) => onChange({ flightNumber: e.target.value })} />
      <input type="date" className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" value={value.flightDate ?? ''} onChange={(e) => onChange({ flightDate: e.target.value })} />
      <input type="time" className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" value={value.departureTime ?? ''} onChange={(e) => onChange({ departureTime: e.target.value })} />
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Linia lotnicza" value={value.airline ?? ''} onChange={(e) => onChange({ airline: e.target.value })} />
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Skąd" value={value.from ?? ''} onChange={(e) => onChange({ from: e.target.value })} />
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Dokąd" value={value.to ?? ''} onChange={(e) => onChange({ to: e.target.value })} />
    </div>
  );
});

const TravelInfoFormAccommodation = React.memo(function TravelInfoFormAccommodation({
  value,
  onChange,
}: {
  value: TravelInfoAccommodation;
  onChange: (next: Partial<TravelInfoAccommodation>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white md:col-span-2" placeholder="Nazwa obiektu" value={value.propertyName ?? ''} onChange={(e) => onChange({ propertyName: e.target.value })} />
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white md:col-span-2" placeholder="Adres" value={value.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} />
      <input type="date" className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" value={value.checkInDate ?? ''} onChange={(e) => onChange({ checkInDate: e.target.value })} />
      <input type="time" className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" value={value.checkInTime ?? ''} onChange={(e) => onChange({ checkInTime: e.target.value })} />
      <input type="date" className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" value={value.checkOutDate ?? ''} onChange={(e) => onChange({ checkOutDate: e.target.value })} />
      <input type="time" className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" value={value.checkOutTime ?? ''} onChange={(e) => onChange({ checkOutTime: e.target.value })} />
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white md:col-span-2" placeholder="Numer rezerwacji" value={value.reservationNumber ?? ''} onChange={(e) => onChange({ reservationNumber: e.target.value })} />
    </div>
  );
});

const TravelInfoFormTransport = React.memo(function TravelInfoFormTransport({
  value,
  onChange,
}: {
  value: TravelInfoTransport;
  onChange: (next: Partial<TravelInfoTransport>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Środek transportu" value={value.mode ?? ''} onChange={(e) => onChange({ mode: e.target.value })} />
      <input type="time" className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" value={value.departureTime ?? ''} onChange={(e) => onChange({ departureTime: e.target.value })} />
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Miejsce startowe" value={value.from ?? ''} onChange={(e) => onChange({ from: e.target.value })} />
      <input className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white" placeholder="Miejsce docelowe" value={value.to ?? ''} onChange={(e) => onChange({ to: e.target.value })} />
    </div>
  );
});

const TravelInfoModal = React.memo(function TravelInfoModal({
  open,
  activeType,
  details,
  canEdit,
  onClose,
  onAutoSave,
}: {
  open: boolean;
  activeType: TravelInfoType | null;
  details?: TravelInfoDetails;
  canEdit: boolean;
  onClose: () => void;
  onAutoSave: <T extends TravelInfoType>(type: T, payload: TravelInfoPayloadByType[T], opts?: { signal?: AbortSignal }) => Promise<void>;
}) {
  const [localDetails, setLocalDetails] = useState<TravelInfoDetails>(() => mergeDetails(details));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLocalDetails(mergeDetails(details));
  }, [details]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeType) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    setSaving(false);
    setError(null);
  }, [activeType]);

  const scheduleSave = useCallback(<T extends TravelInfoType>(type: T, payload: TravelInfoPayloadByType[T]) => {
    if (!canEdit) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    controllerRef.current?.abort();

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setSaving(true);
      setError(null);
      try {
        await onAutoSave(type, payload, { signal: controller.signal });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian.');
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [canEdit, onAutoSave]);

  const updateTypePayload = useCallback(<T extends TravelInfoType>(type: T, next: Partial<TravelInfoPayloadByType[T]>) => {
    setLocalDetails((prev) => {
      const merged = mergeDetails(prev);
      const current = merged[type] as TravelInfoPayloadByType[T];
      const payload = { ...current, ...next } as TravelInfoPayloadByType[T];
      const updated = { ...merged, [type]: payload } as TravelInfoDetails;
      scheduleSave(type, payload);
      return updated;
    });
  }, [scheduleSave]);

  if (!open || !activeType) return null;

  const title = TRAVEL_INFO_ITEMS.find((item) => item.type === activeType)?.label ?? 'Informacje podróży';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900/95 p-5 md:p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {!canEdit && <p className="text-xs text-white/60 mt-1">Brak uprawnień do edycji tych danych.</p>}
          </div>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-white/70">Zapisywanie…</span>}
            <button type="button" className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1">
          {activeType === 'flight' && (
            <TravelInfoFormFlight value={localDetails.flight ?? DEFAULT_FLIGHT} onChange={(next) => updateTypePayload('flight', next)} />
          )}
          {activeType === 'accommodation' && (
            <TravelInfoFormAccommodation value={localDetails.accommodation ?? DEFAULT_ACCOMMODATION} onChange={(next) => updateTypePayload('accommodation', next)} />
          )}
          {activeType === 'transport' && (
            <TravelInfoFormTransport value={localDetails.transport ?? DEFAULT_TRANSPORT} onChange={(next) => updateTypePayload('transport', next)} />
          )}
          {activeType === 'transfer' && (
            <TravelInfoFormTransport value={localDetails.transfer ?? DEFAULT_TRANSPORT} onChange={(next) => updateTypePayload('transfer', next)} />
          )}
          {activeType === 'documents' && (
            <textarea
              className="w-full min-h-[130px] rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white"
              placeholder="Dodaj informacje o dokumentach, rezerwacjach, polisach…"
              value={localDetails.documents?.notes ?? ''}
              onChange={(e) => updateTypePayload('documents', { notes: e.target.value })}
            />
          )}
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {/* Tutaj możesz dodać przyciski akcji, np. Zapisz/Anuluj jeśli będą potrzebne */}
        </div>
      </div>
    </div>
  );
});

const BoardHeader = React.memo(function BoardHeader({
  boardName,
  groupName,
  boardAvatar,
  travelInfo,
  participants,
  canInviteMembers,
  onOpenInviteMembers,
  canManageBoardMembers,
  onOpenBoardMembersSettings,
  canEdit,
  onAutoSave,
  onRenameBoard,
  onUpdateMainInfo,
}: {
  boardName: string;
  groupName: string;
  boardAvatar?: string | null;
  travelInfo: BoardTravelInfo;
  participants: Participant[];
  canInviteMembers: boolean;
  onOpenInviteMembers: () => void;
  canManageBoardMembers: boolean;
  onOpenBoardMembersSettings: () => void;
  canEdit: boolean;
  onAutoSave: <T extends TravelInfoType>(type: T, payload: TravelInfoPayloadByType[T], opts?: { signal?: AbortSignal }) => Promise<void>;
  onRenameBoard: (nextName: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  onUpdateMainInfo: (payload: { location?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null }, opts?: { signal?: AbortSignal }) => Promise<void>;
}) {
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [activeType, setActiveType] = useState<TravelInfoType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<'title' | 'dates' | 'location' | 'description' | null>(null);
  const [boardNameDraft, setBoardNameDraft] = useState(boardName);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState(travelInfo.location ?? '');
  const initialLocationParts = splitLocation(travelInfo.location);
  const [cityDraft, setCityDraft] = useState(initialLocationParts.city);
  const [countryDraft, setCountryDraft] = useState(initialLocationParts.country);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [cityMenuStyle, setCityMenuStyle] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [countryMenuStyle, setCountryMenuStyle] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [startDateDraft, setStartDateDraft] = useState(travelInfo.startDate ?? '');
  const [endDateDraft, setEndDateDraft] = useState(travelInfo.endDate ?? '');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateSelectionStep, setDateSelectionStep] = useState<'start' | 'end'>('start');
  const [datePickerMonth, setDatePickerMonth] = useState(() => parseIsoDate(travelInfo.startDate) ?? new Date());
  const [datePickerTempStart, setDatePickerTempStart] = useState(travelInfo.startDate ?? '');
  const [datePickerTempEnd, setDatePickerTempEnd] = useState(travelInfo.endDate ?? '');
  const [datePickerMenuStyle, setDatePickerMenuStyle] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState(travelInfo.description ?? '');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameControllerRef = useRef<AbortController | null>(null);
  const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoControllerRef = useRef<AbortController | null>(null);
  const citySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const citySearchControllerRef = useRef<AbortController | null>(null);
  const suppressNextCitySuggestionRef = useRef(false);
  const cityDropdownRef = useRef<HTMLDivElement | null>(null);
  const cityMenuRef = useRef<HTMLDivElement | null>(null);
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);
  const countryTriggerRef = useRef<HTMLDivElement | null>(null);
  const countryMenuRef = useRef<HTMLDivElement | null>(null);
  const datesEditorRef = useRef<HTMLDivElement | null>(null);
  const datePickerTriggerRef = useRef<HTMLDivElement | null>(null);
  const datePickerMenuRef = useRef<HTMLDivElement | null>(null);
  const locationEditRef = useRef<HTMLDivElement | null>(null);
  const description = (travelInfo.description ?? '').trim();
  const preview = description.length > 180 ? `${description.slice(0, 180)}…` : description;

  useEffect(() => {
    setBoardNameDraft(boardName);
  }, [boardName]);

  useEffect(() => {
    const nextLocation = travelInfo.location ?? '';
    const parts = splitLocation(nextLocation);
    setLocationDraft(nextLocation);
    setCityDraft(parts.city);
    setCountryDraft(parts.country);
    setStartDateDraft(travelInfo.startDate ?? '');
    setEndDateDraft(travelInfo.endDate ?? '');
    setDatePickerTempStart(travelInfo.startDate ?? '');
    setDatePickerTempEnd(travelInfo.endDate ?? '');
    setDateSelectionStep('start');
    setDatePickerMonth(parseIsoDate(travelInfo.startDate) ?? parseIsoDate(travelInfo.endDate) ?? new Date());
    setDescriptionDraft(travelInfo.description ?? '');
  }, [travelInfo.description, travelInfo.location, travelInfo.startDate, travelInfo.endDate]);

  useEffect(() => {
    return () => {
      if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
      renameControllerRef.current?.abort();
      if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
      infoControllerRef.current?.abort();
      if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);
      citySearchControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!countryDropdownOpen && !cityDropdownOpen && !datePickerOpen && editingField !== 'location' && editingField !== 'dates') return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideCityDropdown = cityDropdownRef.current ? !cityDropdownRef.current.contains(target) : true;
      const isOutsideCityMenu = cityMenuRef.current ? !cityMenuRef.current.contains(target) : true;
      const isOutsideCountryDropdown = countryDropdownRef.current ? !countryDropdownRef.current.contains(target) : true;
      const isOutsideCountryMenu = countryMenuRef.current ? !countryMenuRef.current.contains(target) : true;
      const isOutsideDateTrigger = datePickerTriggerRef.current ? !datePickerTriggerRef.current.contains(target) : true;
      const isOutsideDateMenu = datePickerMenuRef.current ? !datePickerMenuRef.current.contains(target) : true;
      const isOutsideLocationEditor = locationEditRef.current ? !locationEditRef.current.contains(target) : true;
      const isOutsideDatesEditor = datesEditorRef.current ? !datesEditorRef.current.contains(target) : true;

      if (isOutsideCityDropdown && isOutsideCityMenu) {
        setCityDropdownOpen(false);
      }

      if (isOutsideCountryDropdown && isOutsideCountryMenu) {
        setCountryDropdownOpen(false);
      }

      if (isOutsideDateTrigger && isOutsideDateMenu) {
        setDatePickerOpen(false);
      }

      if (editingField === 'location' && isOutsideLocationEditor && isOutsideCountryMenu && isOutsideCityMenu) {
        setCountryDropdownOpen(false);
        setCityDropdownOpen(false);
        setEditingField(null);
      }

      if (editingField === 'dates' && isOutsideDatesEditor && isOutsideDateMenu) {
        setDatePickerOpen(false);
        setEditingField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [countryDropdownOpen, cityDropdownOpen, datePickerOpen, editingField]);

  useEffect(() => {
    if (editingField !== 'location') {
      if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);
      citySearchControllerRef.current?.abort();
      setCitySuggestions([]);
      setCityDropdownOpen(false);
      setCityLoading(false);
      return;
    }

    if (suppressNextCitySuggestionRef.current) {
      suppressNextCitySuggestionRef.current = false;
      setCityLoading(false);
      setCityDropdownOpen(false);
      return;
    }

    const query = cityDraft.trim();
    if (!query) {
      if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);
      citySearchControllerRef.current?.abort();
      setCitySuggestions([]);
      setCityDropdownOpen(false);
      setCityLoading(false);
      return;
    }

    if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);
    citySearchControllerRef.current?.abort();

    citySearchTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      citySearchControllerRef.current = controller;
      setCityLoading(true);

      try {
        const params = new URLSearchParams({ q: query, limit: '10' });
        if (countryDraft.trim()) params.set('country', countryDraft.trim());
        const response = await fetch(`/api/locations/cities?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('city-search-failed');

        const payload = await response.json() as { data?: CitySuggestion[] };
        const next = Array.isArray(payload.data) ? payload.data : [];
        setCitySuggestions(next);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 180);

    return () => {
      if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);
      citySearchControllerRef.current?.abort();
    };
  }, [cityDraft, countryDraft, editingField]);

  useEffect(() => {
    if (!cityDropdownOpen || !cityDropdownRef.current) return;

    const updateMenuPosition = () => {
      const rect = cityDropdownRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeightEstimate = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < menuHeightEstimate && spaceAbove > spaceBelow;

      setCityMenuStyle({
        top: openUp ? rect.top - 4 : rect.bottom + 3,
        left: rect.left,
        width: Math.max(rect.width, 220),
        openUp,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [cityDropdownOpen]);

  useEffect(() => {
    if (!cityDropdownOpen) {
      setCityMenuStyle(null);
    }
  }, [cityDropdownOpen]);

  useEffect(() => {
    if (!countryDropdownOpen || !countryTriggerRef.current) return;

    const updateMenuPosition = () => {
      const rect = countryTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeightEstimate = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < menuHeightEstimate && spaceAbove > spaceBelow;

      setCountryMenuStyle({
        top: openUp ? rect.top - 4 : rect.bottom + 3,
        left: rect.left,
        width: Math.max(rect.width, 220),
        openUp,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [countryDropdownOpen]);

  useEffect(() => {
    if (!countryDropdownOpen) {
      setCountryMenuStyle(null);
    }
  }, [countryDropdownOpen]);

  useEffect(() => {
    if (!datePickerOpen || !datePickerTriggerRef.current) return;

    const updateMenuPosition = () => {
      const rect = datePickerTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeightEstimate = 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < menuHeightEstimate && spaceAbove > spaceBelow;

      setDatePickerMenuStyle({
        top: openUp ? rect.top - 4 : rect.bottom + 3,
        left: rect.left,
        width: 318,
        openUp,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [datePickerOpen]);

  const scheduleRename = useCallback((nextName: string) => {
    if (!canEdit) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === boardName.trim()) return;

    if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    renameControllerRef.current?.abort();

    renameTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      renameControllerRef.current = controller;
      setRenaming(true);
      setRenameError(null);
      try {
        await onRenameBoard(trimmed, { signal: controller.signal });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setRenameError(err instanceof Error ? err.message : 'Nie udało się zapisać nazwy tablicy.');
      } finally {
        setRenaming(false);
      }
    }, 500);
  }, [boardName, canEdit, onRenameBoard]);

  const scheduleMainInfoSave = useCallback((next: { location?: string; startDate?: string; endDate?: string; description?: string }) => {
    if (!canEdit) return;

    const payload = {
      location: (next.location ?? locationDraft).trim() || null,
      startDate: (next.startDate ?? startDateDraft) || null,
      endDate: (next.endDate ?? endDateDraft) || null,
      description: (next.description ?? descriptionDraft).trim() || null,
    };

    const currentLocation = (travelInfo.location ?? '').trim() || null;
    const currentStart = travelInfo.startDate ?? null;
    const currentEnd = travelInfo.endDate ?? null;
    const currentDescription = (travelInfo.description ?? '').trim() || null;

    if (
      payload.location === currentLocation &&
      payload.startDate === currentStart &&
      payload.endDate === currentEnd &&
      payload.description === currentDescription
    ) {
      return;
    }

    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    infoControllerRef.current?.abort();

    infoTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      infoControllerRef.current = controller;
      setInfoSaving(true);
      setInfoError(null);
      try {
        await onUpdateMainInfo(payload, { signal: controller.signal });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setInfoError(err instanceof Error ? err.message : 'Nie udało się zapisać informacji podróży.');
      } finally {
        setInfoSaving(false);
      }
    }, 500);
  }, [canEdit, descriptionDraft, endDateDraft, locationDraft, onUpdateMainInfo, startDateDraft, travelInfo.description, travelInfo.endDate, travelInfo.location, travelInfo.startDate]);

  const fieldInputClass = 'h-8 rounded-lg border border-slate-500/70 bg-slate-900 px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-400 outline-none focus:border-amber-300 focus:bg-slate-900';
  const inlineEditButtonClass = 'board-inline-edit-btn inline-flex h-5 w-5 items-center justify-center text-white/65 opacity-0 transition-opacity hover:text-white group-hover:opacity-100';
  const countries = useMemo<CountryOption[]>(() => {
    const displayNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined'
      ? new Intl.DisplayNames(['pl'], { type: 'region' })
      : null;

    return COUNTRY_REGION_CODES
      .map((code) => {
        const localized = displayNames?.of(code) ?? code;
        return {
          code,
          name: localized,
          flagUrl: `https://flagcdn.com/w40/${code.toLowerCase()}.png`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
  }, []);

  const filteredCountries = useMemo(() => {
    const query = normalizeSearchText(countryQuery);
    if (!query) return countries;
    return countries.filter((country) => normalizeSearchText(country.name).startsWith(query));
  }, [countries, countryQuery]);

  const visibleFilteredCountries = useMemo(() => {
    const selectedCountry = normalizeSearchText(countryDraft);
    if (!selectedCountry) return filteredCountries;
    return filteredCountries.filter((country) => normalizeSearchText(country.name) !== selectedCountry);
  }, [countryDraft, filteredCountries]);

  const visibleCitySuggestions = useMemo(() => {
    const selectedCity = normalizeSearchText(cityDraft);
    const selectedCountry = normalizeSearchText(countryDraft);
    if (!selectedCity) return citySuggestions;
    return citySuggestions.filter((city) => {
      const sameCity = normalizeSearchText(city.name) === selectedCity;
      if (!sameCity) return true;
      if (!selectedCountry) return false;
      return normalizeSearchText(city.countryName) !== selectedCountry;
    });
  }, [cityDraft, countryDraft, citySuggestions]);

  const mapLocationLabel = (editingField === 'location' ? locationDraft : travelInfo.location)?.trim() ?? '';

  const weekDayLabels = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
  const monthLabel = useMemo(
    () => datePickerMonth.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }),
    [datePickerMonth]
  );
  const calendarCells = useMemo(() => getCalendarGrid(datePickerMonth), [datePickerMonth]);

  const openDatePicker = () => {
    setDateSelectionStep('start');
    setDatePickerTempStart(startDateDraft);
    setDatePickerTempEnd(endDateDraft);
    setDatePickerMonth(parseIsoDate(startDateDraft) ?? parseIsoDate(endDateDraft) ?? new Date());
    setDatePickerOpen(true);
  };


  const applyDatePicker = () => {
    setStartDateDraft(datePickerTempStart);
    setEndDateDraft(datePickerTempEnd);
    scheduleMainInfoSave({
      startDate: datePickerTempStart,
      endDate: datePickerTempEnd,
    });
    setDatePickerOpen(false);
    setEditingField(null);
  };

  const cancelDatePicker = () => {
    setDatePickerTempStart(startDateDraft);
    setDatePickerTempEnd(endDateDraft);
    setDateSelectionStep('start');
    setDatePickerOpen(false);
    setEditingField(null);
  };

  const pickDateFromCalendar = (isoDate: string) => {
    if (!isValidIsoDate(isoDate)) return;

    if (dateSelectionStep === 'start') {
      setDatePickerTempStart(isoDate);
      setDatePickerTempEnd('');
      setDateSelectionStep('end');
      return;
    }

    if (!datePickerTempStart) {
      setDatePickerTempStart(isoDate);
      setDatePickerTempEnd('');
      setDateSelectionStep('end');
      return;
    }

    if (isoDate < datePickerTempStart) {
      setDatePickerTempEnd(datePickerTempStart);
      setDatePickerTempStart(isoDate);
    } else {
      setDatePickerTempEnd(isoDate);
    }

    setDateSelectionStep('start');
  };

  const applyCountrySelection = (nextCountry: string) => {
    const hasCountryChanged = normalizeSearchText(nextCountry) !== normalizeSearchText(countryDraft);

    setCountryDraft(nextCountry);
    setCountryQuery(nextCountry);

    if (hasCountryChanged) {
      setCityDraft('');
      setCitySuggestions([]);
      setCityDropdownOpen(false);
      const nextLocation = composeLocation('', nextCountry);
      setLocationDraft(nextLocation);
      scheduleMainInfoSave({ location: nextLocation });
      return;
    }

    const nextLocation = composeLocation(cityDraft, nextCountry);
    setLocationDraft(nextLocation);
    scheduleMainInfoSave({ location: nextLocation });
  };

  const startInlineMainEdit = (field: 'dates' | 'location' | 'description') => {
    if (!canEdit) return;
    setCountryDropdownOpen(false);
    setCityDropdownOpen(false);
    if (field === 'dates') {
      openDatePicker();
    }
    if (field === 'location') setCountryQuery(countryDraft);
    setEditingField(field);
  };
  const startInlineTitleEdit = () => {
    if (!canEdit) return;
    setCountryDropdownOpen(false);
    setCityDropdownOpen(false);
    setBoardNameDraft(boardName);
    setEditingField('title');
  };
  const openTravelType = (type: TravelInfoType) => {
    setCountryDropdownOpen(false);
    setCityDropdownOpen(false);
    setEditingField(null);
    setActiveType(type);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setActiveType(null);
  };

  return (
    <>
      <Card className="dashboard-card !min-h-0 !h-auto !max-h-none !overflow-visible !justify-start !gap-0 rounded-2xl p-4 md:p-5 bg-slate-950/85 border-slate-600/60 lg:pl-6 lg:pr-6">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.5fr)_minmax(0,0.5fr)] gap-6">
          <div className="min-w-0">
            <div className="flex items-start gap-4 min-w-0">
              {boardAvatar ? (
                <img src={boardAvatar} alt={boardName} className="w-14 h-14 rounded-full object-cover border border-white/20" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold">
                  {getInitials(boardName)}
                </div>
              )}
              <div className="min-w-0 w-full">
                <div className="min-h-[2.25rem] flex items-start">
                {editingField === 'title' ? (
                  <input
                    value={boardNameDraft}
                    onChange={(e) => {
                      const next = e.target.value.slice(0, 20);
                      setBoardNameDraft(next);
                      scheduleRename(next);
                    }}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        setEditingField(null);
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    autoFocus
                    placeholder="Nazwa tablicy"
                    maxLength={20}
                    className="w-full max-w-[360px] border-b border-white/25 bg-transparent pb-0.5 text-2xl font-semibold text-white outline-none focus:border-white/45"
                  />
                ) : (
                  <div className="group max-w-[460px] inline-flex items-center gap-2">
                    <h1 className="truncate text-2xl font-semibold text-white">{boardName}</h1>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={startInlineTitleEdit}
                        aria-label="Edytuj nazwę tablicy"
                        className={inlineEditButtonClass}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
                </div>
                <p className="mt-1 text-xs text-white/60">Grupa: {groupName}</p>
                <div className="mt-1 min-h-[1rem]">
                  {(renaming || renameError) && (
                    <p className={`text-xs ${renameError ? 'text-red-300' : 'text-white/65'}`}>
                      {renameError ?? 'Zapisywanie nazwy tablicy…'}
                    </p>
                  )}
                </div>

                <div className="mt-0.5 text-sm text-white/75">
                  {editingField === 'dates' ? (
                    <div
                      ref={datesEditorRef}
                      className="relative flex flex-nowrap items-center gap-2 min-h-[2rem] overflow-x-auto"
                    >
                      <CalendarDaysIcon className="w-4 h-4 text-white/90" />
                      <span className="text-white/85">Daty:</span>
                      <div ref={datePickerTriggerRef} className="inline-flex items-center gap-2">
                        <span className="text-sm text-white/80">
                          {datePickerTempStart || startDateDraft
                            ? formatDate(datePickerTempStart || startDateDraft)
                            : 'Od'}
                          {' — '}
                          {datePickerTempEnd || endDateDraft
                            ? formatDate(datePickerTempEnd || endDateDraft)
                            : 'Do'}
                        </span>
                      </div>
                      {datePickerMenuStyle && createPortal(
                        <div
                          ref={datePickerMenuRef}
                          className="board-country-menu fixed min-w-max whitespace-nowrap rounded-xl border border-slate-600 bg-slate-950 p-3 z-[60]"
                          style={{
                            top: datePickerMenuStyle.top,
                            left: datePickerMenuStyle.left,
                            width: datePickerMenuStyle.width,
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setDatePickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                              className="h-8 w-8 rounded-full text-white/80 hover:bg-white/10"
                              aria-label="Poprzedni miesiąc"
                            >
                              ‹
                            </button>
                            <div className="text-xs font-medium capitalize text-white/90">{monthLabel}</div>
                            <button
                              type="button"
                              onClick={() => setDatePickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                              className="h-8 w-8 rounded-full text-white/80 hover:bg-white/10"
                              aria-label="Następny miesiąc"
                            >
                              ›
                            </button>
                          </div>

                          <div className="mb-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80">
                            {dateSelectionStep === 'start'
                              ? 'Kliknij dzień, aby ustawić datę Od'
                              : 'Kliknij dzień, aby ustawić datę Do'}
                          </div>

                          <div className="mb-1 grid grid-cols-7 gap-1">
                            {weekDayLabels.map((label) => (
                              <span key={label} className="block text-center text-[11px] text-white/45">{label}</span>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              const todayIso = toIsoDate(today);
                              return calendarCells.map((cell) => {
                                const isStart = datePickerTempStart === cell.iso;
                                const isEnd = datePickerTempEnd === cell.iso;
                                const inRange = Boolean(
                                  datePickerTempStart &&
                                  datePickerTempEnd &&
                                  cell.iso >= datePickerTempStart &&
                                  cell.iso <= datePickerTempEnd
                                );
                                const isPast = cell.iso < todayIso;
                                return (
                                  <button
                                    key={cell.iso}
                                    type="button"
                                    onClick={() => !isPast && pickDateFromCalendar(cell.iso)}
                                    disabled={isPast}
                                    className={`h-8 w-8 rounded-full text-[11px] transition ${
                                      isPast
                                        ? 'opacity-40 cursor-not-allowed'
                                        : isStart || isEnd
                                          ? 'bg-white text-slate-950 font-semibold'
                                          : inRange
                                            ? 'bg-white/10 text-white'
                                            : cell.inCurrentMonth
                                              ? 'text-white/85 hover:bg-white/10'
                                              : 'text-white/35 hover:bg-white/5'
                                    }`}
                                  >
                                    {cell.date.getDate()}
                                  </button>
                                );
                              });
                            })()}
                          </div>

                          <div className="mt-3 flex justify-end gap-2 border-t border-white/10 pt-3">
                            <button
                              type="button"
                              onClick={cancelDatePicker}
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/85 hover:bg-white/10"
                            >
                              Anuluj
                            </button>
                            <button
                              type="button"
                              onClick={applyDatePicker}
                              className="rounded-lg border border-white/10 bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                            >
                              Zastosuj
                            </button>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  ) : (
                    <div className="group inline-flex items-center gap-2 w-full max-w-[460px] text-white/80 min-h-[2rem]">
                      <CalendarDaysIcon className="w-4 h-4 text-white/90" />
                      <span className="text-white/85">Daty:</span>
                      <span className="truncate">{formatDate(travelInfo.startDate)} — {formatDate(travelInfo.endDate)}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startInlineMainEdit('dates')}
                          aria-label="Edytuj daty"
                          className={`ml-1 ${inlineEditButtonClass}`}
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-0 text-sm text-white/75">
                  {editingField === 'location' ? (
                    <div
                      ref={locationEditRef}
                      className="flex flex-nowrap items-center gap-2 w-full max-w-[560px] text-white/80 min-h-[2.25rem] overflow-x-auto"
                      onClick={e => {
                        if (e.target === e.currentTarget) {
                          setCountryDropdownOpen(false);
                          setCityDropdownOpen(false);
                          setEditingField(null);
                        }
                      }}
                    >
                      <MapPinIcon className="w-4 h-4 text-white/90" />
                      <span className="text-white/85">Lokalizacja:</span>
                      <div ref={countryDropdownRef} className="relative w-full max-w-[150px]">
                        <div
                          ref={countryTriggerRef}
                          onClick={() => {
                            setCityDropdownOpen(false);
                            setCountryQuery(countryDraft);
                            setCountryDropdownOpen((prev) => !prev);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setCityDropdownOpen(false);
                              setCountryQuery(countryDraft);
                              setCountryDropdownOpen((prev) => !prev);
                            }
                            if (e.key === 'Escape') {
                              setCountryDropdownOpen(false);
                            }
                          }}
                          className={`board-country-trigger w-full inline-flex items-center justify-between gap-2 ${fieldInputClass}`}
                          aria-label="Wybierz państwo"
                          role="button"
                          tabIndex={0}
                          aria-expanded={countryDropdownOpen}
                        >
                          <span className="inline-flex items-center gap-2 truncate">
                            {(() => {
                              const selectedCountry = countries.find((option) => option.name === countryDraft);
                              return selectedCountry ? (
                                <img
                                  src={selectedCountry.flagUrl}
                                  alt={selectedCountry.code}
                                  className="h-3.5 w-5 rounded-[2px] object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="text-white/55">🏳️</span>
                              );
                            })()}
                            <span className={countryDraft ? 'text-white' : 'text-white/55'}>{countryDraft || 'Państwo'}</span>
                          </span>
                          <ChevronDownIcon className={`h-4 w-4 text-white/70 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                          {countryDropdownOpen && countryMenuStyle && createPortal(
                            <div
                              ref={countryMenuRef}
                              className="board-country-menu fixed min-w-max whitespace-nowrap rounded-lg border border-slate-600 bg-slate-950 p-1 z-[60]"
                              style={{
                                top: countryMenuStyle.top,
                                left: countryMenuStyle.left,
                                width: countryMenuStyle.width,
                              }}
                            >
                              <div className="px-1 pb-1">
                                <input
                                  value={countryQuery}
                                  onChange={(e) => setCountryQuery(e.target.value)}
                                  placeholder="Wpisz państwo"
                                  className="board-country-search w-full h-8 rounded-lg px-2.5 py-1 text-xs"
                                />
                              </div>
                              <div className="max-h-[240px] overflow-y-auto pr-1">
                                {visibleFilteredCountries.map((country) => (
                                  <div
                                    key={country.name}
                                    onClick={() => {
                                      applyCountrySelection(country.name);
                                      setTimeout(() => setCountryDropdownOpen(false), 0);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        applyCountrySelection(country.name);
                                        setTimeout(() => setCountryDropdownOpen(false), 0);
                                      }
                                    }}
                                    className="board-country-option w-full text-left px-3 py-1 rounded text-xs text-slate-100 transition whitespace-nowrap flex items-center gap-2"
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <img
                                      src={country.flagUrl}
                                      alt={country.code}
                                      className="h-3.5 w-5 rounded-[2px] object-cover"
                                      loading="lazy"
                                    />
                                    <span className="truncate">{country.name}</span>
                                  </div>
                                ))}
                              </div>
                              {visibleFilteredCountries.length === 0 && (
                                <div className="px-3 py-1 text-xs text-slate-400">Brak wyników</div>
                              )}
                            </div>,
                            document.body
                          )}
                      </div>
                      <div ref={cityDropdownRef} className="relative w-full max-w-[160px]">
                        <input
                          value={cityDraft}
                          onChange={(e) => {
                            const nextCity = e.target.value;
                            setCityDraft(nextCity);
                            setCityDropdownOpen(nextCity.trim().length > 0);
                            const nextLocation = composeLocation(nextCity, countryDraft);
                            setLocationDraft(nextLocation);
                            scheduleMainInfoSave({ location: nextLocation });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setCityDropdownOpen(false);
                              setEditingField(null);
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                            if (e.key === 'Enter' && citySuggestions.length > 0) {
                              e.preventDefault();
                              const first = citySuggestions[0];
                              if (first) {
                                suppressNextCitySuggestionRef.current = true;
                                setCityDraft(first.name);
                                const nextLocation = composeLocation(first.name, countryDraft || first.countryName);
                                setLocationDraft(nextLocation);
                                scheduleMainInfoSave({ location: nextLocation });
                                setCityDropdownOpen(false);
                              }
                            }
                          }}
                          autoFocus
                          placeholder="Miasto"
                          className={`w-full ${fieldInputClass}`}
                        />
                        {cityDropdownOpen && cityMenuStyle && createPortal(
                          <div
                            ref={cityMenuRef}
                            className="board-country-menu fixed min-w-max whitespace-nowrap rounded-lg border border-slate-600 bg-slate-950 p-1 z-[60]"
                            style={{
                              top: cityMenuStyle.top,
                              left: cityMenuStyle.left,
                              width: cityMenuStyle.width,
                            }}
                          >
                            <div className="max-h-[240px] overflow-y-auto pr-1">
                              {!cityLoading && visibleCitySuggestions.map((city) => (
                                <div
                                  key={`${city.name}-${city.countryCode}`}
                                  onClick={() => {
                                    suppressNextCitySuggestionRef.current = true;
                                    setCityDraft(city.name);
                                    const nextCountry = countryDraft || city.countryName;
                                    if (!countryDraft) {
                                      setCountryDraft(city.countryName);
                                      setCountryQuery(city.countryName);
                                    }
                                    const nextLocation = composeLocation(city.name, nextCountry);
                                    setLocationDraft(nextLocation);
                                    scheduleMainInfoSave({ location: nextLocation });
                                    setCityDropdownOpen(false);
                                  }}
                                  className="board-country-option w-full text-left px-3 py-1 rounded text-xs text-slate-100 transition whitespace-nowrap flex items-center justify-between gap-2"
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      suppressNextCitySuggestionRef.current = true;
                                      setCityDraft(city.name);
                                      const nextCountry = countryDraft || city.countryName;
                                      if (!countryDraft) {
                                        setCountryDraft(city.countryName);
                                        setCountryQuery(city.countryName);
                                      }
                                      const nextLocation = composeLocation(city.name, nextCountry);
                                      setLocationDraft(nextLocation);
                                      scheduleMainInfoSave({ location: nextLocation });
                                      setCityDropdownOpen(false);
                                    }
                                  }}
                                >
                                  <span className="truncate">{city.name}</span>
                                  <span className="text-[10px] text-slate-300 truncate">{city.countryName}</span>
                                </div>
                              ))}
                              {!cityLoading && visibleCitySuggestions.length === 0 && (
                                <div className="px-3 py-1 text-xs text-slate-400">Brak wyników</div>
                              )}
                            </div>
                          </div>,
                          document.body
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="group inline-flex items-center gap-2 w-full max-w-[460px] text-white/80 min-h-[2.25rem]">
                      <MapPinIcon className="w-4 h-4 text-white/90" />
                      <span className="text-white/85">Lokalizacja:</span>
                      <span className="truncate">{travelInfo.location || 'Brak lokalizacji'}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startInlineMainEdit('location')}
                          aria-label="Edytuj lokalizację"
                          className={`ml-1 ${inlineEditButtonClass}`}
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {infoError && <p className="text-xs text-red-300">{infoError}</p>}

                <div className="mt-3 flex items-center gap-2">
                  {participants.length === 0 ? (
                    <p className="text-xs text-white/55">Brak członków tablicy.</p>
                  ) : (
                    <div className="flex items-center -space-x-4">
                      {participants.slice(0, 10).map((member) => (
                        <div key={member.id} className="group relative">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.name} className="w-8 h-8 rounded-full border border-slate-800 object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/10 border border-slate-800 text-[10px] text-white flex items-center justify-center font-semibold">
                              {getInitials(member.name)}
                            </div>
                          )}
                        </div>
                      ))}
                      {participants.length > 10 && (
                        <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-700 px-2 text-[11px] font-semibold text-white">
                          +{participants.length - 10}
                        </div>
                      )}
                    </div>
                  )}
                  {canInviteMembers && (
                    <button
                      type="button"
                      onClick={onOpenInviteMembers}
                      aria-label="Zaproś członka grupy do tablicy"
                      className="app-icon-btn"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  )}
                  {canManageBoardMembers && (
                    <button
                      type="button"
                      onClick={onOpenBoardMembersSettings}
                      aria-label="Ustawienia członków tablicy"
                      className="app-icon-btn"
                    >
                      <Cog6ToothIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-0.5">
                  <TravelInfoBar
                    activeType={activeType}
                    onSelect={(type) => {
                      openTravelType(type);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Opis podróży usunięty na życzenie użytkownika */}

          <div className="min-w-0 md:pl-1">
            <div className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <div className="mb-2 inline-flex items-center gap-2 text-xs text-white/80">
                <MapPinIcon className="h-4 w-4 text-white/90" />
                <span className="truncate">Mapa: {mapLocationLabel || 'Brak lokalizacji'}</span>
              </div>
              <div className="h-[220px] w-full rounded-lg border border-white/10 bg-slate-900/70">
                {mapLocationLabel ? (
                  <iframe
                    title={`Mapa Google: ${mapLocationLabel}`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(mapLocationLabel)}&z=12&output=embed`}
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-xs text-white/60">
                    Brak lokalizacji — mapa Google nie jest dostępna.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <TravelInfoModal
        open={modalOpen && !!activeType}
        activeType={activeType}
        details={travelInfo.details}
        canEdit={canEdit}
        onClose={closeModal}
        onAutoSave={onAutoSave}
      />
    </>
  );
});

const AddPostCard = React.memo(function AddPostCard({
  value,
  posting,
  onChange,
  onSubmit,
}: {
  value: string;
  posting: boolean;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-5 md:p-6 bg-white/[0.04] border-white/10">
      <h2 className="text-base font-semibold text-white">Dodaj post</h2>
      <textarea
        className="mt-3 w-full min-h-[110px] px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
        placeholder="Podziel się aktualizacją, pomysłem lub decyzją dla grupy…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="primary" disabled={!value.trim() || posting} onClick={onSubmit} className="px-4 py-2">
          {posting ? 'Dodawanie…' : 'Dodaj post'}
        </Button>
      </div>
    </Card>
  );
});

const PostCard = React.memo(function PostCard({
  post,
  canModerate,
  currentUserId,
  commentsOpen,
  commentDraft,
  commentSubmitting,
  onToggleComments,
  onCommentDraft,
  onCreateComment,
  onDeleteComment,
  onDeletePost,
  onLoadMoreComments,
}: {
  post: BoardPost;
  canModerate: boolean;
  currentUserId: string | null;
  commentsOpen: boolean;
  commentDraft: string;
  commentSubmitting: boolean;
  onToggleComments: () => void;
  onCommentDraft: (next: string) => void;
  onCreateComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onDeletePost: () => void;
  onLoadMoreComments: () => void;
}) {
  const canDeletePost = post.authorId === currentUserId || canModerate;

  return (
    <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-4 md:p-5 bg-white/[0.035] border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {post.authorAvatarUrl ? (
            <img src={post.authorAvatarUrl} alt={post.authorName} className="w-10 h-10 rounded-full object-cover border border-white/15" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-semibold">
              {getInitials(post.authorName)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">{post.authorName}</div>
            <div className="text-xs text-white/55">{formatDateTime(post.createdAt)}</div>
          </div>
        </div>

        {canDeletePost && (
          <button
            type="button"
            className="app-text-btn-danger text-xs px-2 py-1 rounded-lg"
            onClick={onDeletePost}
          >
            Usuń
          </button>
        )}
      </div>

      <p className="mt-3 text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{post.content}</p>

      <div className="mt-4 border-t border-white/10 pt-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
          onClick={onToggleComments}
        >
          {commentsOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          Komentarze ({post.comments.length})
        </button>

        {commentsOpen && (
          <div className="mt-3 space-y-2">
            {post.comments.length === 0 && (
              <div className="text-xs text-white/55">Brak komentarzy.</div>
            )}

            {post.comments.map((comment: BoardComment) => {
              const canDeleteComment = comment.authorId === currentUserId || canModerate;
              return (
                <div key={comment.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-white/65">
                      <span className="text-white/90 font-medium">{comment.authorName}</span> · {formatDateTime(comment.createdAt)}
                    </div>
                    {canDeleteComment && (
                      <button
                        type="button"
                        className="app-text-btn-danger text-[11px] px-2 py-0.5 rounded"
                        onClick={() => onDeleteComment(comment.id)}
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-white/90 whitespace-pre-wrap">{comment.content}</div>
                </div>
              );
            })}

            <div className="flex gap-2 pt-1">
              <input
                value={commentDraft}
                onChange={(e) => onCommentDraft(e.target.value)}
                placeholder="Dodaj komentarz…"
                className="flex-1 px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white text-sm"
              />
              <Button type="button" variant="secondary" className="px-3 py-2" disabled={!commentDraft.trim() || commentSubmitting} onClick={onCreateComment}>
                {commentSubmitting ? 'Trwa…' : 'Dodaj'}
              </Button>
            </div>

            {post.hasMoreComments && (
              <button
                type="button"
                className="text-xs px-2 py-1 rounded bg-white/10 text-white/85 hover:bg-white/20"
                onClick={onLoadMoreComments}
              >
                Pokaż więcej komentarzy
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
});

const TravelInfoSidebar = React.memo(function TravelInfoSidebar({
  travelInfo,
}: {
  travelInfo: BoardTravelInfo;
}) {
  const checklist = Array.isArray(travelInfo.checklist) ? travelInfo.checklist : [];
  const days = buildTripDays(travelInfo.startDate, travelInfo.endDate);

  return (
    <div className="space-y-4">
      <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-4 bg-white/[0.04] border-white/10">
        <h3 className="text-sm font-semibold text-white">Mini plan podróży</h3>
        <div className="mt-3 space-y-2 max-h-56 overflow-auto pr-1">
          {days.length === 0 ? (
            <p className="text-xs text-white/55">Dodaj datę startu i końca, aby zobaczyć plan dni.</p>
          ) : (
            days.map((day, index) => (
              <div key={day.key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[11px] text-white/55">Dzień {index + 1}</p>
                <p className="text-sm text-white/90">{day.label}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-4 bg-white/[0.04] border-white/10">
        <h3 className="text-sm font-semibold text-white">Szybkie sekcje</h3>
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-white/55">Dokumenty</p>
            <p className="text-sm text-white/90">Wkrótce</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-white/55">Zadania</p>
            <p className="text-sm text-white/90">{checklist.length} elementów</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-white/55">Budżet</p>
            <p className="text-sm text-white/90">{travelInfo.budget != null ? `${travelInfo.budget} PLN` : 'Nie ustawiono'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
});

export default function BoardDetailClient({ groupId, boardId }: { groupId: string; boardId: string }) {
  const router = useRouter();
  const toast = useToast();
  const {
    membersByGroupId,
    fetchMembers,
  } = useGroupContext();

  const {
    currentUserId,
    activeBoard,
    moderators,
    canModerate,
    activeBoardStatus,
    posts,
    postsNextCursor,
    hasMorePosts,
    loadingMorePosts,
    loading,
    error,
    loadBoard,
    loadPosts,
    loadMorePosts,
    createPost,
    deletePost,
    createComment,
    deleteComment,
    addModerator,
    removeModerator,
    loadMoreComments,
    updateBoardName,
    updateTravelInfo,
    clearBoardState,
  } = useBoard();

  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedInviteUserId, setSelectedInviteUserId] = useState('');
  const [invitePending, setInvitePending] = useState(false);
  const [memberSettingsModalOpen, setMemberSettingsModalOpen] = useState(false);
  const [memberMutationPendingId, setMemberMutationPendingId] = useState<string | null>(null);

  const mutationControllersRef = useRef<Set<AbortController>>(new Set());

  const registerController = () => {
    const controller = new AbortController();
    mutationControllersRef.current.add(controller);
    return controller;
  };

  const releaseController = (controller: AbortController) => {
    mutationControllersRef.current.delete(controller);
  };

  useEffect(() => {
    const controller = new AbortController();
    clearBoardState();
    void loadBoard(groupId, boardId, { signal: controller.signal });
    void loadPosts(groupId, boardId, { signal: controller.signal, cursor: null, append: false });
    return () => {
      controller.abort();
    };
  }, [boardId, clearBoardState, groupId, loadBoard, loadPosts]);

  useEffect(() => {
    return () => {
      mutationControllersRef.current.forEach((controller) => controller.abort());
      mutationControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (activeBoardStatus !== 401) return;
    toast.push({ type: 'error', title: 'Sesja', message: 'Sesja wygasła. Zaloguj się ponownie.' });
    router.replace('/login');
  }, [activeBoardStatus, router, toast]);

  useEffect(() => {
    if (activeBoardStatus !== 403 && activeBoardStatus !== 404) return;
    toast.push({ type: 'error', title: 'Tablica', message: 'Brak dostępu do tablicy. Przeniesiono do listy tablic.' });
    router.replace(`/dashboard/boards/${encodeURIComponent(groupId)}`);
  }, [activeBoardStatus, groupId, router, toast]);

  useEffect(() => {
    if (!activeBoard?.groupId) return;
    void fetchMembers(activeBoard.groupId);
  }, [activeBoard?.groupId, fetchMembers]);

  const loadBoardMembers = useCallback(async (boardIdToLoad: string, opts?: { signal?: AbortSignal }) => {
    if (!boardIdToLoad) return;
    const response = await fetch(`/api/boards/by-id/${encodeURIComponent(boardIdToLoad)}/members`, {
      credentials: 'include',
      cache: 'no-store',
      signal: opts?.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || 'Nie udało się pobrać członków tablicy.');
    }
    const payload = await response.json();
    const next = Array.isArray(payload?.members) ? (payload.members as BoardMember[]) : [];
    setBoardMembers(next);
  }, []);

  useEffect(() => {
    if (!activeBoard?.id) {
      setBoardMembers([]);
      setInviteModalOpen(false);
      setMemberSettingsModalOpen(false);
      setSelectedInviteUserId('');
      return;
    }

    const controller = new AbortController();
    void loadBoardMembers(activeBoard.id, { signal: controller.signal }).catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.push({
        type: 'error',
        title: 'Członkowie tablicy',
        message: err instanceof Error ? err.message : 'Nie udało się pobrać członków tablicy.',
      });
    });

    return () => controller.abort();
  }, [activeBoard?.id, loadBoardMembers, toast]);

  useEffect(() => {
    if (!activeBoard?.id) return;

    const boardId = activeBoard.id;
    const supabase = getBrowserSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (cancelled) return;
        void loadBoardMembers(boardId).catch(() => {
          // ignore transient realtime reload errors
        });
      }, 120);
    };

    (async () => {
      try {
        const tokenRes = await fetch('/api/supabase/realtime-token', { credentials: 'include', cache: 'no-store' });
        if (!tokenRes.ok || cancelled) return;
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (typeof tokenJson?.token !== 'string' || cancelled) return;
        supabase.realtime.setAuth(tokenJson.token);

        channel = supabase
          .channel(`board-members:${boardId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'board_members', filter: `board_id=eq.${boardId}` },
            scheduleReload
          )
          .subscribe();
      } catch {
        // ignore realtime bootstrap failures
      }
    })();

    return () => {
      cancelled = true;
      if (reloadTimer) clearTimeout(reloadTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeBoard?.id, loadBoardMembers]);

  const canEditInfo = canModerate;

  const postsByDay = useMemo(() => groupPostsByDay(posts), [posts]);

  const participants = useMemo<Participant[]>(() => {
    return boardMembers.map((member) => ({
      id: member.id,
      name: member.fullName || member.username || 'Użytkownik',
      avatarUrl: member.avatarUrl ?? null,
    }));
  }, [boardMembers]);

  const availableBoardInviteCandidates = useMemo(() => {
    if (!activeBoard) return [] as GroupMember[];
    const members: GroupMember[] = membersByGroupId[activeBoard.groupId] ?? [];
    const boardMemberIds = new Set(boardMembers.map((entry) => entry.id));
    return members.filter((member) => !boardMemberIds.has(member.id));
  }, [activeBoard, boardMembers, membersByGroupId]);

  useEffect(() => {
    if (!selectedInviteUserId) return;
    const stillAvailable = availableBoardInviteCandidates.some((member) => String(member.id) === selectedInviteUserId);
    if (!stillAvailable) setSelectedInviteUserId('');
  }, [availableBoardInviteCandidates, selectedInviteUserId]);

  const handleToggleModerator = useCallback(async (userId: string, currentlyModerator: boolean) => {
    if (!activeBoard || !userId || memberMutationPendingId) return;
    if (currentUserId && userId === currentUserId) {
      toast.push({ type: 'error', title: 'Moderatorzy', message: 'Nie możesz zmienić swoich własnych uprawnień moderatora.' });
      return;
    }
    setMemberMutationPendingId(userId);
    const controller = registerController();
    try {
      if (currentlyModerator) {
        await removeModerator(activeBoard.id, userId, { signal: controller.signal });
        toast.push({ type: 'success', title: 'Moderatorzy', message: 'Usunięto moderatora tablicy.' });
      } else {
        await addModerator(activeBoard.id, userId, { signal: controller.signal });
        toast.push({ type: 'success', title: 'Moderatorzy', message: 'Dodano moderatora tablicy.' });
      }
    } catch (err) {
      toast.push({
        type: 'error',
        title: 'Moderatorzy',
        message: err instanceof Error ? err.message : 'Nie udało się zaktualizować moderatora.',
      });
    } finally {
      releaseController(controller);
      setMemberMutationPendingId(null);
    }
  }, [activeBoard, addModerator, currentUserId, memberMutationPendingId, removeModerator, toast]);

  const handleRemoveBoardMember = useCallback(async (userId: string) => {
    if (!activeBoard || !userId || memberMutationPendingId) return;
    if (currentUserId && userId === currentUserId) {
      toast.push({ type: 'error', title: 'Tablica', message: 'Nie możesz usunąć siebie z tablicy.' });
      return;
    }
    if (userId === activeBoard.ownerId) {
      toast.push({ type: 'error', title: 'Tablica', message: 'Nie można usunąć właściciela tablicy.' });
      return;
    }

    setMemberMutationPendingId(userId);
    const controller = registerController();
    try {
      const response = await fetch(`/api/boards/by-id/${encodeURIComponent(activeBoard.id)}/members/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Nie udało się usunąć członka tablicy.');
      }

      const nextMembers = Array.isArray(payload?.members) ? (payload.members as BoardMember[]) : [];
      setBoardMembers(nextMembers);
      toast.push({ type: 'success', title: 'Tablica', message: 'Usunięto członka z tablicy.' });
    } catch (err) {
      toast.push({
        type: 'error',
        title: 'Tablica',
        message: err instanceof Error ? err.message : 'Nie udało się usunąć członka z tablicy.',
      });
    } finally {
      releaseController(controller);
      setMemberMutationPendingId(null);
    }
  }, [activeBoard, currentUserId, memberMutationPendingId, toast]);

  const handleInviteMemberToBoard = useCallback(async () => {
    if (!activeBoard || !selectedInviteUserId || invitePending) return;
    setInvitePending(true);
    const controller = registerController();
    try {
      const response = await fetch(`/api/boards/by-id/${encodeURIComponent(activeBoard.id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ userId: selectedInviteUserId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Nie udało się wysłać zaproszenia do tablicy.');
      }

      const nextMembers = Array.isArray(payload?.members) ? (payload.members as BoardMember[]) : [];
      setBoardMembers(nextMembers);
      setSelectedInviteUserId('');
      setInviteModalOpen(false);
      toast.push({ type: 'success', title: 'Tablica', message: 'Wysłano zaproszenie do tablicy.' });
    } catch (err) {
      toast.push({
        type: 'error',
        title: 'Tablica',
        message: err instanceof Error ? err.message : 'Nie udało się wysłać zaproszenia do tablicy.',
      });
    } finally {
      releaseController(controller);
      setInvitePending(false);
    }
  }, [activeBoard, invitePending, selectedInviteUserId, toast]);

  const handleAutoSaveTravelInfo = useCallback(
    async <T extends TravelInfoType>(
      type: T,
      payload: TravelInfoPayloadByType[T],
      opts?: { signal?: AbortSignal }
    ) => {
      if (!activeBoard) return;
      const currentInfo = activeBoard.travelInfo;
      const currentDetails = mergeDetails(currentInfo.details);
      const nextDetails: TravelInfoDetails = { ...currentDetails, [type]: payload };

      await updateTravelInfo(
        activeBoard.groupId,
        activeBoard.id,
        {
          location: currentInfo.location ?? null,
          startDate: currentInfo.startDate ?? null,
          endDate: currentInfo.endDate ?? null,
          description: currentInfo.description ?? null,
          budget: currentInfo.budget ?? null,
          checklist: Array.isArray(currentInfo.checklist) ? currentInfo.checklist : [],
          details: nextDetails,
        },
        opts
      );
    },
    [activeBoard, updateTravelInfo]
  );

  const handleRenameBoard = useCallback(
    async (nextName: string, opts?: { signal?: AbortSignal }) => {
      if (!activeBoard) return;
      await updateBoardName(activeBoard.groupId, activeBoard.id, nextName, opts);
    },
    [activeBoard, updateBoardName]
  );

  const handleUpdateMainInfo = useCallback(
    async (
      payload: { location?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null },
      opts?: { signal?: AbortSignal }
    ) => {
      if (!activeBoard) return;
      const currentInfo = activeBoard.travelInfo;

      await updateTravelInfo(
        activeBoard.groupId,
        activeBoard.id,
        {
          location: payload.location ?? currentInfo.location ?? null,
          startDate: payload.startDate ?? currentInfo.startDate ?? null,
          endDate: payload.endDate ?? currentInfo.endDate ?? null,
          description: payload.description ?? currentInfo.description ?? null,
          budget: currentInfo.budget ?? null,
          checklist: Array.isArray(currentInfo.checklist) ? currentInfo.checklist : [],
          details: mergeDetails(currentInfo.details),
        },
        opts
      );
    },
    [activeBoard, updateTravelInfo]
  );

  const handleCreatePost = async () => {
    if (!activeBoard || posting || !postContent.trim()) return;
    setPosting(true);
    const controller = registerController();
    try {
      await createPost(activeBoard.groupId, activeBoard.id, postContent, { signal: controller.signal });
      setPostContent('');
    } finally {
      releaseController(controller);
      setPosting(false);
    }
  };

  if ((loading || activeBoardStatus === null) && !activeBoard) {
    return (
      <div className="space-y-4 lg:pl-6">
        <div className="h-9 w-72 rounded-xl bg-white/10 animate-pulse" />
        <div className="h-36 rounded-2xl bg-white/10 animate-pulse" />
        <div className="h-80 rounded-2xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (!activeBoard) {
    return (
      <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-6 border-red-400/30 bg-red-500/10">
        <div className="text-red-200">Brak dostępu do tablicy lub tablica nie istnieje.</div>
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void loadBoard(groupId, boardId);
              void loadPosts(groupId, boardId, { cursor: null, append: false });
            }}
          >
            Spróbuj ponownie
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5 lg:pl-6">
      <BoardHeader
        boardName={activeBoard.boardName}
        groupName={activeBoard.groupName}
        boardAvatar={activeBoard.groupAvatarUrl}
        travelInfo={activeBoard.travelInfo}
        participants={participants}
        canInviteMembers={canModerate}
        onOpenInviteMembers={() => setInviteModalOpen(true)}
        canManageBoardMembers={canModerate}
        onOpenBoardMembersSettings={() => setMemberSettingsModalOpen(true)}
        canEdit={canEditInfo}
        onAutoSave={handleAutoSaveTravelInfo}
        onRenameBoard={handleRenameBoard}
        onUpdateMainInfo={handleUpdateMainInfo}
      />

      <Modal open={inviteModalOpen && canModerate} onClose={() => setInviteModalOpen(false)} title={undefined} showCloseButton={true} panelClassName="max-w-[30rem]">
        <div className="p-6 w-full overflow-hidden" style={{ overflow: 'hidden', height: '600px', minHeight: '600px', maxHeight: '600px' }}>
          <div className="mb-4 pb-4 border-b border-white/10">
            <div className="text-xl font-semibold text-white text-center">Zaproś do tablicy</div>
            <div className="text-xs text-white/60 text-center mt-2">Wybierz członka grupy, który ma dostać dostęp do tej tablicy.</div>
          </div>
          {availableBoardInviteCandidates.length > 0 && (
            <div className="h-[400px] overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-1">
              {availableBoardInviteCandidates.map((member) => {
                const memberIdRaw = (member as { id?: string; userId?: string; user_id?: string }).id
                  ?? (member as { id?: string; userId?: string; user_id?: string }).userId
                  ?? (member as { id?: string; userId?: string; user_id?: string }).user_id
                  ?? '';
                const memberId = String(memberIdRaw);
                const label = member.fullName || member.username || 'Użytkownik';
                const isSelected = selectedInviteUserId === memberId;
                return (
                  <button
                    key={memberId}
                    type="button"
                    onClick={() => {
                      if (!memberId) return;
                      setSelectedInviteUserId((prev) => (prev === memberId ? '' : memberId));
                    }}
                    aria-pressed={isSelected}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={`invite-select-btn w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? '!border-white/30 !bg-white/20 !text-white'
                        : '!border-transparent !bg-transparent !text-white/85 hover:!border-white/10 hover:!bg-white/10 hover:!text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {availableBoardInviteCandidates.length === 0 && (
            <p className="mt-2 text-xs text-white/60">Wszyscy członkowie grupy mają już dostęp do tej tablicy.</p>
          )}

          <div className="flex justify-center gap-2 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setInviteModalOpen(false)}
              className="app-text-btn-gradient min-w-[9rem]"
            >
              Anuluj
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                void handleInviteMemberToBoard();
              }}
              disabled={invitePending || !selectedInviteUserId}
              className="app-text-btn-gradient min-w-[9rem]"
            >
              {invitePending ? 'Dodawanie...' : 'Dodaj do tablicy'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={memberSettingsModalOpen && canModerate} onClose={() => setMemberSettingsModalOpen(false)} title={undefined} showCloseButton={true}>
        <div className="p-6 max-w-2xl mx-auto overflow-hidden" style={{ overflow: 'hidden', maxHeight: '90vh' }}>
          <div className="mb-4 pb-4 border-b border-white/10">
            <div className="text-xl font-semibold text-white text-center">Ustawienia tablicy</div>
            <div className="text-xs text-white/60 text-center mt-2">Zarządzaj członkami tablicy i uprawnieniami moderatora.</div>
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {boardMembers.length === 0 ? (
              <p className="text-sm text-white/60">Brak członków tablicy.</p>
            ) : (
              boardMembers.map((member) => {
                const displayName = member.fullName || member.username || 'Użytkownik';
                const isMemberModerator = moderators.some((entry) => entry.id === member.id);
                const isOwnerMember = activeBoard.ownerId === member.id;
                const isCurrentUserMember = currentUserId === member.id;
                const pending = memberMutationPendingId === member.id;

                return (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover border border-white/15" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-white/10 border border-white/15 text-[10px] text-white flex items-center justify-center font-semibold">
                          {getInitials(displayName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/90">{displayName}</div>
                        <div className="text-[11px] text-white/55">
                          {isOwnerMember ? 'Właściciel' : isMemberModerator ? 'Moderator' : 'Członek'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isOwnerMember && !isCurrentUserMember && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1.5 text-xs"
                          disabled={pending}
                          onClick={() => {
                            void handleToggleModerator(member.id, isMemberModerator);
                          }}
                        >
                          {isMemberModerator ? 'Usuń moderatora' : 'Nadaj moderatora'}
                        </Button>
                      )}
                      {!isOwnerMember && !isCurrentUserMember && (
                        <Button
                          type="button"
                          variant="danger"
                          className="px-2.5 py-1.5 text-xs"
                          disabled={pending}
                          onClick={() => {
                            void handleRemoveBoardMember(member.id);
                          }}
                        >
                          Usuń z tablicy
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-center gap-2 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMemberSettingsModalOpen(false)}
              className="app-text-btn-gradient min-w-[9rem]"
            >
              Zamknij
            </Button>
          </div>
        </div>
      </Modal>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePanelOpen((prev) => !prev)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 flex items-center justify-between"
        >
          <span>Panel podróży</span>
          {mobilePanelOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </button>
        {mobilePanelOpen && (
          <div className="mt-3">
            <TravelInfoSidebar travelInfo={activeBoard.travelInfo} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] gap-5 items-start">
        <div className="space-y-5">
          <AddPostCard value={postContent} posting={posting} onChange={setPostContent} onSubmit={handleCreatePost} />

          <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-5 md:p-6 bg-white/[0.04] border-white/10">
            <h2 className="text-base font-semibold text-white">Timeline</h2>

            {error && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2">
                <div className="text-sm text-red-200">{error}</div>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={() => {
                    void loadBoard(groupId, boardId);
                    void loadPosts(groupId, boardId, { cursor: null, append: false });
                  }}
                >
                  Retry
                </Button>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
                Brak postów. Dodaj pierwszy wpis i rozpocznij współpracę na tablicy.
              </div>
            ) : (
              <div className="mt-4 space-y-6">
                {postsByDay.map((section) => (
                  <div key={section.key}>
                    <div className="mb-3 sticky top-0 z-[1] backdrop-blur-sm bg-slate-900/20 rounded px-1 py-0.5">
                      <span className="text-xs uppercase tracking-wide text-white/50">{section.label}</span>
                    </div>
                    <div className="space-y-3">
                      {section.posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          canModerate={canModerate}
                          currentUserId={currentUserId}
                          commentsOpen={Boolean(commentsOpen[post.id])}
                          commentDraft={commentDrafts[post.id] ?? ''}
                          commentSubmitting={Boolean(commentSubmitting[post.id])}
                          onToggleComments={() => setCommentsOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                          onCommentDraft={(next) => setCommentDrafts((prev) => ({ ...prev, [post.id]: next }))}
                          onCreateComment={async () => {
                            if (commentSubmitting[post.id]) return;
                            const value = String(commentDrafts[post.id] ?? '');
                            if (!value.trim()) return;
                            setCommentSubmitting((prev) => ({ ...prev, [post.id]: true }));
                            const controller = registerController();
                            try {
                              await createComment(post.id, value, { signal: controller.signal });
                              setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
                            } finally {
                              releaseController(controller);
                              setCommentSubmitting((prev) => ({ ...prev, [post.id]: false }));
                            }
                          }}
                          onDeleteComment={(commentId) => {
                            void deleteComment(commentId);
                          }}
                          onDeletePost={() => {
                            void deletePost(post.id);
                          }}
                          onLoadMoreComments={() => {
                            void loadMoreComments(post.id);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {hasMorePosts && (
                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loadingMorePosts || !postsNextCursor}
                      onClick={() => void loadMorePosts(groupId, boardId)}
                    >
                      {loadingMorePosts ? 'Ładowanie…' : 'Pokaż więcej postów'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-6">
          <TravelInfoSidebar travelInfo={activeBoard.travelInfo} />
        </aside>
      </div>
    </div>
  );
}
