"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  AtSymbolIcon,
  ArrowRightCircleIcon,
  ArrowUpTrayIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EyeIcon,
  MapPinIcon,
  MagnifyingGlassPlusIcon,
  FaceSmileIcon,
  MagnifyingGlassMinusIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  QueueListIcon,
  TrashIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useBoard } from '../../hooks/useBoard';
import type {
  BoardComment,
  BoardPost,
  BoardPostAttachment,
  TripDay,
  TripActivity,
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

type ComposerPickedFile = {
  id: string;
  name: string;
  kind: 'file' | 'image';
  file: File;
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

function getInitials(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function getDayLabel(dateLike: string) {
  try {
    const d = new Date(dateLike);
    return d.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      reject(new Error('Nie udało się odczytać pliku.'));
    };
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(file);
  });
}

type UploadedBoardDocument = {
  fileName: string;
  filePath: string;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

function uploadBoardDocumentWithProgress(uploadUrl: string, file: File, onProgress: (progress: number) => void): Promise<UploadedBoardDocument> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file, file.name);

    onProgress(0);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const next = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
      onProgress(next);
    };

    xhr.onerror = () => reject(new Error('Nie udało się przesłać pliku.'));
    xhr.onload = () => {
      const raw = xhr.response;
      let payload: any = null;
      if (typeof raw === 'string') {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = null;
        }
      } else {
        payload = raw;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload?.error || 'Nie udało się przesłać pliku.'));
        return;
      }

      onProgress(100);
      resolve({
        fileName: typeof payload?.fileName === 'string' ? payload.fileName : file.name,
        filePath: typeof payload?.filePath === 'string' ? payload.filePath : '',
        fileUrl: typeof payload?.fileUrl === 'string' ? payload.fileUrl : null,
        mimeType: typeof payload?.mimeType === 'string' ? payload.mimeType : (file.type || null),
        sizeBytes: Number.isFinite(Number(payload?.sizeBytes)) ? Number(payload.sizeBytes) : file.size,
      });
    };

    xhr.open('POST', uploadUrl);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    xhr.send(formData);
  });
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFirstUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

function renderPostContent(content: string, mentionNames: string[]) {
  const mentionPatterns = mentionNames
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((name) => `@${name}`);

  const mentionRegex = mentionPatterns.length > 0
    ? new RegExp(`(${mentionPatterns.map((m) => escapeRegExp(m)).join('|')})`, 'g')
    : null;

  return content.split('\n').map((line, lineIndex) => {
    const tokens = line.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {tokens.map((token, tokenIndex) => {
          const code = token.match(/^`([^`]+)`$/);
          if (code) {
            return <code key={`token-${lineIndex}-${tokenIndex}`} className="rounded bg-black/30 px-1 py-0.5 text-xs text-emerald-200">{code[1]}</code>;
          }

          const bold = token.match(/^\*\*([^*]+)\*\*$/);
          if (bold) {
            return <strong key={`token-${lineIndex}-${tokenIndex}`}>{bold[1]}</strong>;
          }

          const italic = token.match(/^\*([^*]+)\*$/);
          if (italic) {
            return <em key={`token-${lineIndex}-${tokenIndex}`}>{italic[1]}</em>;
          }

          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const chunks = token.split(urlRegex).filter(Boolean);

          return chunks.map((chunk, chunkIndex) => {
            if (/^https?:\/\//i.test(chunk)) {
              return (
                <a
                  key={`url-${lineIndex}-${tokenIndex}-${chunkIndex}`}
                  href={chunk}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 underline decoration-sky-400/60 underline-offset-2"
                >
                  {chunk}
                </a>
              );
            }

            if (!mentionRegex) {
              return <React.Fragment key={`text-${lineIndex}-${tokenIndex}-${chunkIndex}`}>{chunk}</React.Fragment>;
            }

            const mentionParts = chunk.split(mentionRegex).filter(Boolean);
            return mentionParts.map((part, partIndex) => (
              mentionPatterns.includes(part)
                ? <span key={`mention-${lineIndex}-${tokenIndex}-${chunkIndex}-${partIndex}`} className="text-indigo-200 font-medium">{part}</span>
                : <React.Fragment key={`plain-${lineIndex}-${tokenIndex}-${chunkIndex}-${partIndex}`}>{part}</React.Fragment>
            ));
          });
        })}
        {lineIndex < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    );
  });
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
  items: [],
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
    <div className="flex flex-col items-stretch gap-2">
      {TRAVEL_INFO_ITEMS.map(({ type, label, Icon }) => {
        const active = activeType === type;
        return (
          <button
            key={type}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onSelect(type)}
            className={`app-icon-btn app-icon-btn-row w-full justify-start text-xs ${active ? 'app-icon-btn-row-active' : ''}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
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
  groupId,
  boardId,
  details,
  canEdit,
  onClose,
  onAutoSave,
}: {
  open: boolean;
  activeType: TravelInfoType | null;
  groupId: string;
  boardId: string;
  details?: TravelInfoDetails;
  canEdit: boolean;
  onClose: () => void;
  onAutoSave: <T extends TravelInfoType>(type: T, payload: TravelInfoPayloadByType[T], opts?: { signal?: AbortSignal }) => Promise<void>;
}) {
  const [localDetails, setLocalDetails] = useState<TravelInfoDetails>(() => mergeDetails(details));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [documentsDropActive, setDocumentsDropActive] = useState(false);
  const [pendingDocumentFile, setPendingDocumentFile] = useState<{ file: File; previewUrl: string | null; uploaded: UploadedBoardDocument } | null>(null);
  const [pendingDocumentUploading, setPendingDocumentUploading] = useState(false);
  const [pendingDocumentUploadProgress, setPendingDocumentUploadProgress] = useState<number | null>(null);
  const [documentUploadProgressById, setDocumentUploadProgressById] = useState<Record<string, number>>({});
  const pendingPreviewUrlRef = useRef<string | null>(null);
  const pendingUploadedPathRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const documentsCreateInputRef = useRef<HTMLInputElement | null>(null);

  const uploadUrl = useMemo(
    () => `/api/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}/documents`,
    [boardId, groupId]
  );

  const revokePreview = useCallback((previewUrl?: string) => {
    if (!previewUrl) return;
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, []);

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
    pendingPreviewUrlRef.current = pendingDocumentFile?.previewUrl ?? null;
  }, [pendingDocumentFile?.previewUrl]);

  useEffect(() => {
    pendingUploadedPathRef.current = pendingDocumentFile?.uploaded.filePath ?? null;
  }, [pendingDocumentFile?.uploaded.filePath]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      controllerRef.current?.abort();
      if (pendingPreviewUrlRef.current) revokePreview(pendingPreviewUrlRef.current);
      if (pendingUploadedPathRef.current) {
        void fetch(uploadUrl, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: pendingUploadedPathRef.current }),
        }).catch(() => {
          // ignore cleanup errors
        });
      }
    };
  }, [revokePreview, uploadUrl]);

  const deleteCloudDocument = useCallback(async (filePath?: string | null) => {
    const normalized = (filePath ?? '').trim();
    if (!normalized) return;
    try {
      await fetch(uploadUrl, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: normalized }),
      });
    } catch {
      // ignore cleanup errors
    }
  }, [uploadUrl]);

  useEffect(() => {
    if (!activeType) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    setSaving(false);
    setError(null);
    setPendingDocumentUploading(false);
    setPendingDocumentUploadProgress(null);
    setDocumentUploadProgressById({});
  }, [activeType]);

  useEffect(() => {
    if (activeType !== 'documents' && pendingDocumentFile?.previewUrl) {
      revokePreview(pendingDocumentFile.previewUrl);
      void deleteCloudDocument(pendingDocumentFile.uploaded.filePath);
      setPendingDocumentFile(null);
    }
  }, [activeType, deleteCloudDocument, pendingDocumentFile, revokePreview]);

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

  const documentItems = useMemo(() => (localDetails.documents?.items ?? []), [localDetails.documents?.items]);

  const attachFileToDocument = useCallback(async (documentId: string, file: File) => {
    setError(null);
    setDocumentUploadProgressById((prev) => ({ ...prev, [documentId]: 0 }));

    try {
      const uploaded = await uploadBoardDocumentWithProgress(uploadUrl, file, (progress) => {
        setDocumentUploadProgressById((prev) => ({ ...prev, [documentId]: progress }));
      });

      const matched = documentItems.find((entry) => entry.id === documentId);
      if (matched) {
        const previousPath = matched.filePath ?? null;
        updateTypePayload('documents', {
          items: documentItems.map((entry) => entry.id === documentId ? {
            ...entry,
            fileName: uploaded.fileName,
            fileUrl: uploaded.fileUrl,
            filePath: uploaded.filePath,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          } : entry),
        });
        if (previousPath && previousPath !== uploaded.filePath) {
          void deleteCloudDocument(previousPath);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się przesłać pliku.');
    } finally {
      setDocumentUploadProgressById((prev) => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    }
  }, [deleteCloudDocument, documentItems, updateTypePayload, uploadUrl]);

  const stageDocumentFile = useCallback(async (file: File) => {
    setError(null);
    setPendingDocumentUploading(true);
    setPendingDocumentUploadProgress(0);
    try {
      const uploaded = await uploadBoardDocumentWithProgress(uploadUrl, file, (progress) => {
        setPendingDocumentUploadProgress(progress);
      });
      setPendingDocumentFile((prev) => {
        if (prev?.previewUrl) revokePreview(prev.previewUrl);
        return {
          file,
          previewUrl: uploaded.fileUrl,
          uploaded,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się przesłać pliku.');
      setPendingDocumentFile((prev) => {
        if (prev?.previewUrl) revokePreview(prev.previewUrl);
        return null;
      });
    } finally {
      setPendingDocumentUploading(false);
    }
  }, [revokePreview, uploadUrl]);

  const commitPendingDocument = useCallback(() => {
    if (!pendingDocumentFile || pendingDocumentUploading) return;
    const nextId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedName = newDocumentName.trim() || pendingDocumentFile.file.name;
    updateTypePayload('documents', {
      items: [...documentItems, {
        id: nextId,
        name: normalizedName,
        fileName: pendingDocumentFile.uploaded.fileName,
        fileUrl: pendingDocumentFile.uploaded.fileUrl,
        filePath: pendingDocumentFile.uploaded.filePath,
        mimeType: pendingDocumentFile.uploaded.mimeType,
        sizeBytes: pendingDocumentFile.uploaded.sizeBytes,
      }],
    });
    setPendingDocumentFile(null);
    setPendingDocumentUploadProgress(null);
    setNewDocumentName('');
  }, [documentItems, newDocumentName, pendingDocumentFile, pendingDocumentUploading, updateTypePayload]);

  const handleDocumentsDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDocumentsDropActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) return;
    void stageDocumentFile(files[0]);
  }, [stageDocumentFile]);

  const removeDocument = useCallback((documentId: string) => {
    const matched = documentItems.find((entry) => entry.id === documentId);
    if (matched?.filePath) {
      void deleteCloudDocument(matched.filePath);
    }
    updateTypePayload('documents', { items: documentItems.filter((entry) => entry.id !== documentId) });
  }, [deleteCloudDocument, documentItems, updateTypePayload]);

  if (!activeType) return null;

  const title = TRAVEL_INFO_ITEMS.find((item) => item.type === activeType)?.label ?? 'Informacje podróży';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      showCloseButton={true}
      panelClassName="max-w-2xl"
    >
      <div className="space-y-3">
        {!canEdit && <p className="text-xs text-white/60">Brak uprawnień do edycji tych danych.</p>}
        {saving && <p className="text-xs text-white/70">Zapisywanie…</p>}

        <div>
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
            <div className="space-y-4">
              <p className="text-sm text-white/85">Lista dokumentów</p>

              <div className="grid grid-cols-1 gap-2">
                <input
                  className="rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-sm text-white"
                  placeholder="Nazwa dokumentu"
                  value={newDocumentName}
                  onChange={(e) => setNewDocumentName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
                <div
                  className={`flex items-center justify-center rounded-xl border border-dashed px-3 py-4 text-center ${documentsDropActive ? 'border-white/35 bg-white/10' : 'border-white/15 bg-white/5'}`}
                  onClick={() => documentsCreateInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDocumentsDropActive(true);
                  }}
                  onDragLeave={() => setDocumentsDropActive(false)}
                  onDrop={handleDocumentsDrop}
                >
                  <div className="flex w-full flex-col items-center justify-center py-1">
                    <ArrowUpTrayIcon className="mb-2 h-7 w-7 text-white/80" />
                    <p className="text-sm text-white/85">Przeciągnij plik lub kliknij, aby wybrać</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="h-full min-h-[96px] rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!pendingDocumentFile || pendingDocumentUploading}
                  onClick={commitPendingDocument}
                >
                  {pendingDocumentUploading ? (
                    <span className="inline-flex items-center gap-2">
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      {pendingDocumentUploadProgress ?? 0}%
                    </span>
                  ) : (
                    'Wrzuć plik'
                  )}
                </button>

                <input
                  ref={documentsCreateInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void stageDocumentFile(file);
                    event.currentTarget.value = '';
                  }}
                />
              </div>

              {pendingDocumentFile && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="mb-2 text-xs text-white/65">Podgląd pliku do wrzucenia</p>
                  <div className="flex items-center gap-3">
                    {pendingDocumentFile.file.type.startsWith('image/') && pendingDocumentFile.previewUrl ? (
                      <img src={pendingDocumentFile.previewUrl} alt={pendingDocumentFile.file.name} className="h-12 w-12 rounded-md object-cover border border-white/10" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-white/10">
                        <DocumentTextIcon className="h-6 w-6 text-white/80" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white/90">{pendingDocumentFile.file.name}</p>
                      <p className="text-xs text-white/60">{Math.max(0.01, pendingDocumentFile.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      {pendingDocumentUploading && (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/75">
                          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                          Przesyłanie: {pendingDocumentUploadProgress ?? 0}%
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="app-icon-btn app-icon-btn-sm ml-auto"
                      aria-label="Usuń wybrany plik"
                      disabled={pendingDocumentUploading}
                      onClick={() => {
                        if (pendingDocumentFile.previewUrl) revokePreview(pendingDocumentFile.previewUrl);
                        void deleteCloudDocument(pendingDocumentFile.uploaded.filePath);
                        setPendingDocumentFile(null);
                        setPendingDocumentUploadProgress(null);
                      }}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {documentItems.length === 0 && <p className="text-xs text-white/55">Brak dodanych dokumentów.</p>}
                {documentItems.map((entry) => {
                  const fileUrl = entry.fileUrl ?? null;
                  const mimeType = entry.mimeType ?? null;
                  const isImage = Boolean(mimeType && mimeType.startsWith('image/'));
                  const uploadProgress = documentUploadProgressById[entry.id];
                  const isUploading = typeof uploadProgress === 'number';
                  return (
                    <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {isImage && fileUrl ? (
                            <img src={fileUrl} alt={entry.name} className="h-10 w-10 rounded-md border border-white/10 object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/10">
                              <DocumentTextIcon className="h-5 w-5 text-white/80" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-white/90 truncate">{entry.name}</p>
                            <p className="text-xs text-white/55 truncate">{entry.fileName || 'Brak pliku'}</p>
                            {isUploading && (
                              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/75">
                                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                Przesyłanie: {uploadProgress}%
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="app-icon-btn app-icon-btn-sm"
                            aria-label={`Podgląd dokumentu ${entry.name}`}
                            title="Podgląd"
                            disabled={!fileUrl || isUploading}
                            onClick={() => {
                              if (!fileUrl) return;
                              window.open(fileUrl, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <label className={`app-icon-btn app-icon-btn-sm ${isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`} aria-label={`Zmień plik dla ${entry.name}`} title="Zmień">
                            <ArrowUpTrayIcon className="h-4 w-4" />
                            <input
                              type="file"
                              className="hidden"
                              disabled={isUploading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void attachFileToDocument(entry.id, file);
                                event.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="app-icon-btn app-icon-btn-sm"
                            aria-label={`Usuń dokument ${entry.name}`}
                            title="Usuń"
                            disabled={isUploading}
                            onClick={() => removeDocument(entry.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        </div>
      </div>
    </Modal>
  );
});

const BoardHeader = React.memo(function BoardHeader({
  boardName,
  groupName,
  boardAvatar,
  boardCreatedAt,
  travelInfo,
  participants,
  canInviteMembers,
  onOpenInviteMembers,
  canManageBoardMembers,
  onOpenBoardMembersSettings,
  canEdit,
  onRenameBoard,
  onUpdateMainInfo,
}: {
  boardName: string;
  groupName: string;
  boardAvatar?: string | null;
  boardCreatedAt?: string | null;
  travelInfo: BoardTravelInfo;
  participants: Participant[];
  canInviteMembers: boolean;
  onOpenInviteMembers: () => void;
  canManageBoardMembers: boolean;
  onOpenBoardMembersSettings: () => void;
  canEdit: boolean;
  onRenameBoard: (nextName: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  onUpdateMainInfo: (payload: { location?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null }, opts?: { signal?: AbortSignal }) => Promise<void>;
}) {
  const [expandedDescription, setExpandedDescription] = useState(false);
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
  const [datePickerHoverIso, setDatePickerHoverIso] = useState('');
  const [datePickerMenuStyle, setDatePickerMenuStyle] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState(travelInfo.description ?? '');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameControllerRef = useRef<AbortController | null>(null);
  const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoControllerRef = useRef<AbortController | null>(null);
  const pendingInfoPayloadRef = useRef<{ location?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null } | null>(null);
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
  const [progressNow, setProgressNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setProgressNow(new Date());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const tripProgress = useMemo(() => {
    const startDate = parseIsoDate(travelInfo.startDate);
    const endDate = parseIsoDate(travelInfo.endDate);

    if (!startDate || !endDate) {
      return {
        visible: true,
        progressPercent: 0,
        progressLabel: 'Ustaw datę startu i końca, aby śledzić postęp podróży.',
        statusHeadline: '⏳ Plan jeszcze bez osi czasu',
        statusDetail: 'Dodaj terminy, a uruchomi się pasek odliczania i etapy podróży.',
      };
    }

    const currentDay = new Date(progressNow);
    currentDay.setHours(0, 0, 0, 0);

    const tripStartDay = new Date(startDate);
    tripStartDay.setHours(0, 0, 0, 0);
    const tripEndDay = new Date(endDate);
    tripEndDay.setHours(0, 0, 0, 0);

    const dayInMs = 24 * 60 * 60 * 1000;
    const tripDurationDays = Math.max(1, Math.floor((tripEndDay.getTime() - tripStartDay.getTime()) / dayInMs) + 1);

    const createdDateRaw = boardCreatedAt ? new Date(boardCreatedAt) : null;
    const boardCreatedDay = createdDateRaw && !Number.isNaN(createdDateRaw.getTime())
      ? new Date(createdDateRaw.getFullYear(), createdDateRaw.getMonth(), createdDateRaw.getDate())
      : null;

    if (currentDay < tripStartDay) {
      const fallbackPreparationStart = new Date(tripStartDay);
      fallbackPreparationStart.setDate(fallbackPreparationStart.getDate() - 30);
      const preparationStartDay = boardCreatedDay && boardCreatedDay < tripStartDay
        ? boardCreatedDay
        : fallbackPreparationStart;

      const effectivePreparationStart = preparationStartDay > currentDay ? currentDay : preparationStartDay;
      const preparationTotalDays = Math.max(1, Math.ceil((tripStartDay.getTime() - effectivePreparationStart.getTime()) / dayInMs));
      const preparationElapsedDays = Math.max(0, Math.floor((currentDay.getTime() - effectivePreparationStart.getTime()) / dayInMs));
      const progressPercent = Math.max(0, Math.min(100, (preparationElapsedDays / preparationTotalDays) * 100));
      const daysToStart = Math.max(1, Math.ceil((tripStartDay.getTime() - currentDay.getTime()) / dayInMs));

      let statusHeadline = '🚀 Rozpęd przed przygodą trwa';
      let statusDetail = `Do rozpoczęcia podróży pozostało ${daysToStart} ${daysToStart === 1 ? 'dzień' : 'dni'}.`;

      if (daysToStart > 60) {
        statusHeadline = '🧱 Fundamenty planu dopiero się budują';
        statusDetail = 'To dobry moment, żeby domknąć budżet i kluczowe rezerwacje.';
      } else if (daysToStart > 30) {
        statusHeadline = '🗂️ Faza organizacji w pełnym biegu';
        statusDetail = 'Masz jeszcze sporo czasu — uporządkuj plan dni i transport.';
      } else if (daysToStart > 21) {
        statusHeadline = '🧭 Trasa nabiera konkretów';
        statusDetail = 'Warto potwierdzić noclegi i dojazdy między punktami.';
      } else if (daysToStart > 14) {
        statusHeadline = '🚀 Rozpęd przed przygodą trwa';
        statusDetail = 'Przed Tobą dwa intensywne tygodnie dopinania szczegółów.';
      } else if (daysToStart > 10) {
        statusHeadline = '📦 Pakowanie mentalne rozpoczęte';
        statusDetail = 'Sprawdź checklistę, dokumenty i priorytety na pierwsze dni.';
      } else if (daysToStart > 7) {
        statusHeadline = '🧳 Tydzień do wyjazdu';
        statusDetail = 'To idealny moment na finalne potwierdzenia i plan awaryjny.';
      } else if (daysToStart > 5) {
        statusHeadline = '🧭 Ostatnia prosta przed startem';
        statusDetail = 'Odliczanie trwa — zostały już tylko ostatnie poprawki.';
      } else if (daysToStart > 3) {
        statusHeadline = '🎫 Finalne potwierdzenia';
        statusDetail = 'Upewnij się, że bilety, adresy i kontakty są pod ręką.';
      } else if (daysToStart > 1) {
        statusHeadline = '🎒 Finalne dopięcia przed wyjazdem';
        statusDetail = 'Start coraz bliżej — zaplanuj dokładnie dzień 1 podróży.';
      } else {
        statusHeadline = '🌙 Ostatni wieczór przed startem';
        statusDetail = 'Jutro ruszasz — przygotuj dokumenty i odpocznij przed wyjazdem.';
      }

      return {
        visible: true,
        progressPercent,
        progressLabel: `Pozostało: ${daysToStart} ${daysToStart === 1 ? 'dzień' : 'dni'}`,
        statusHeadline,
        statusDetail,
      };
    }

    if (currentDay > tripEndDay) {
      const daysAfterTrip = Math.max(0, Math.floor((currentDay.getTime() - tripEndDay.getTime()) / dayInMs));
      let statusHeadline = '🏁 Meta osiągnięta';
      let statusDetail = daysAfterTrip === 0
        ? 'To był ostatni dzień podróży. Czas na podsumowanie!'
        : `Podróż zakończyła się ${daysAfterTrip} ${daysAfterTrip === 1 ? 'dzień' : 'dni'} temu.`;

      if (daysAfterTrip === 0) {
        statusHeadline = '🏁 Meta osiągnięta';
        statusDetail = 'To był ostatni dzień podróży. Czas na podsumowanie!';
      } else if (daysAfterTrip === 1) {
        statusHeadline = '📸 Pierwszy dzień po powrocie';
        statusDetail = 'Świetny moment, żeby opisać wspomnienia i uporządkować zdjęcia.';
      } else if (daysAfterTrip <= 3) {
        statusHeadline = '🧾 Krótki czas na domknięcie wyprawy';
        statusDetail = 'Uzupełnij koszty i krótkie notatki z każdego dnia.';
      } else if (daysAfterTrip <= 7) {
        statusHeadline = '🗃️ Etap archiwizacji wspomnień';
        statusDetail = 'Warto zebrać najważniejsze punkty i zachować plan na przyszłość.';
      } else if (daysAfterTrip <= 30) {
        statusHeadline = '✨ Wspomnienia wciąż świeże';
        statusDetail = 'Możesz wrócić do tablicy i wyciągnąć wnioski na kolejne podróże.';
      } else {
        statusHeadline = '🧭 Podróż zamknięta, inspiracja zostaje';
        statusDetail = 'Ten plan może być bazą do następnego wyjazdu.';
      }

      return {
        visible: true,
        progressPercent: 100,
        progressLabel: 'Podróż zakończona: 100%',
        statusHeadline,
        statusDetail,
      };
    }

    const currentTripDayIndex = Math.max(0, Math.floor((currentDay.getTime() - tripStartDay.getTime()) / dayInMs));
    const clampedTripDayIndex = Math.min(currentTripDayIndex, tripDurationDays - 1);
    const progressPercent = tripDurationDays <= 1
      ? 100
      : Math.max(0, Math.min(100, (clampedTripDayIndex / (tripDurationDays - 1)) * 100));

    const currentTripDayNumber = clampedTripDayIndex + 1;
    const remainingTripDays = Math.max(0, tripDurationDays - currentTripDayNumber);

    const progressRatio = tripDurationDays <= 1 ? 1 : clampedTripDayIndex / (tripDurationDays - 1);
    let statusHeadline = '🗺️ Podróż w toku';
    let statusDetail = `Aktualnie trwa dzień ${currentTripDayNumber} z ${tripDurationDays}. Pozostało ${remainingTripDays} ${remainingTripDays === 1 ? 'dzień' : 'dni'}.`;

    if (currentTripDayNumber === 1) {
      statusHeadline = '🌅 Dzień 1 — start podróży';
      statusDetail = 'Pierwszy dzień wyprawy — wejdź w rytm i trzymaj tempo planu.';
    } else if (currentTripDayNumber === 2) {
      statusHeadline = '🧩 Dzień 2 — stabilizacja planu';
      statusDetail = 'Po starcie łatwiej korygować detale i poprawiać harmonogram.';
    } else if (remainingTripDays === 0) {
      statusHeadline = '✨ Finał podróży';
      statusDetail = 'To ostatni dzień wyprawy — wykorzystaj go na maksa!';
    } else if (remainingTripDays === 1) {
      statusHeadline = '🎯 Przedostatni etap';
      statusDetail = 'Przed Tobą końcówka podróży — domknij najważniejsze punkty.';
    } else if (progressRatio < 0.25) {
      statusHeadline = '🚶 Wejście w rytm podróży';
      statusDetail = 'Jesteś na początku trasy — najważniejsze kierunki są już ustawione.';
    } else if (progressRatio < 0.5) {
      statusHeadline = '🧭 Pierwsza połowa wyprawy';
      statusDetail = 'Dobrze idzie — utrzymuj tempo i notuj kluczowe obserwacje.';
    } else if (progressRatio < 0.75) {
      statusHeadline = '🔥 Druga połowa nabiera rozpędu';
      statusDetail = 'Jesteś po półmetku — to dobry czas na priorytety i najlepsze punkty.';
    } else if (progressRatio < 0.9) {
      statusHeadline = '🏔️ Końcówka trasy na horyzoncie';
      statusDetail = 'Zostało niewiele dni — warto dopiąć wszystkie punkty obowiązkowe.';
    } else {
      statusHeadline = '⌛ Ostatnie chwile podróży';
      statusDetail = 'Finisz jest blisko — zbierz wspomnienia i domknij plan końcowy.';
    }

    return {
      visible: true,
      progressPercent,
      progressLabel: `Przebieg podróży: ${Math.round(progressPercent)}%`,
      statusHeadline,
      statusDetail,
    };
  }, [boardCreatedAt, progressNow, travelInfo.endDate, travelInfo.startDate]);

  const progressFillStyle = useMemo(() => {
    const normalized = Math.max(0, Math.min(100, tripProgress.progressPercent));
    const currentHue = 120 - (120 * (normalized / 100));
    const leadingHue = Math.max(0, Math.min(120, currentHue + 12));
    const trailingHue = Math.max(0, Math.min(120, currentHue - 12));
    return {
      width: `${normalized}%`,
      background: `linear-gradient(90deg, hsl(${leadingHue}, 84%, 52%), hsl(${trailingHue}, 86%, 48%))`,
    };
  }, [tripProgress.progressPercent]);

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
    setDatePickerHoverIso('');
    setDateSelectionStep('start');
    setDatePickerMonth(parseIsoDate(travelInfo.startDate) ?? parseIsoDate(travelInfo.endDate) ?? new Date());
    setDescriptionDraft(travelInfo.description ?? '');
  }, [travelInfo.description, travelInfo.location, travelInfo.startDate, travelInfo.endDate]);

  useEffect(() => {
    return () => {
      if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
      renameControllerRef.current?.abort();
      const hadPendingInfoTimer = Boolean(infoTimerRef.current);
      if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
      if (hadPendingInfoTimer && pendingInfoPayloadRef.current && canEdit) {
        void onUpdateMainInfo(pendingInfoPayloadRef.current);
      }
      if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);
      citySearchControllerRef.current?.abort();
    };
  }, [canEdit, onUpdateMainInfo]);

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
      pendingInfoPayloadRef.current = null;
      return;
    }

    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    infoControllerRef.current?.abort();
    pendingInfoPayloadRef.current = payload;

    infoTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      infoControllerRef.current = controller;
      setInfoSaving(true);
      setInfoError(null);
      try {
        await onUpdateMainInfo(payload, { signal: controller.signal });
        pendingInfoPayloadRef.current = null;
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
    setDatePickerHoverIso('');
    setDatePickerMonth(parseIsoDate(startDateDraft) ?? parseIsoDate(endDateDraft) ?? new Date());
    setDatePickerOpen(true);
  };


  const applyDatePicker = () => {
    setStartDateDraft(datePickerTempStart);
    setEndDateDraft(datePickerTempEnd);
    setDatePickerHoverIso('');
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
    setDatePickerHoverIso('');
    setDateSelectionStep('start');
    setDatePickerOpen(false);
    setEditingField(null);
  };

  const pickDateFromCalendar = (isoDate: string) => {
    if (!isValidIsoDate(isoDate)) return;

    if (dateSelectionStep === 'start') {
      setDatePickerTempStart(isoDate);
      setDatePickerTempEnd('');
      setDatePickerHoverIso('');
      setDateSelectionStep('end');
      return;
    }

    if (!datePickerTempStart) {
      setDatePickerTempStart(isoDate);
      setDatePickerTempEnd('');
      setDatePickerHoverIso('');
      setDateSelectionStep('end');
      return;
    }

    if (isoDate < datePickerTempStart) {
      setDatePickerTempEnd(datePickerTempStart);
      setDatePickerTempStart(isoDate);
    } else {
      setDatePickerTempEnd(isoDate);
    }

    setDatePickerHoverIso('');
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

                          <div
                            className="grid grid-cols-7 gap-1"
                            onMouseLeave={() => setDatePickerHoverIso('')}
                          >
                            {(() => {
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              const todayIso = toIsoDate(today);
                              return calendarCells.map((cell) => {
                                const isStart = datePickerTempStart === cell.iso;
                                const isEnd = datePickerTempEnd === cell.iso;
                                const startDateObj = parseIsoDate(datePickerTempStart);
                                const endDateObj = parseIsoDate(datePickerTempEnd);
                                const hoverDateObj = parseIsoDate(datePickerHoverIso);
                                const cellDateObj = parseIsoDate(cell.iso);
                                const hasRangeBounds = Boolean(startDateObj && endDateObj && cellDateObj);
                                const startTime = hasRangeBounds ? (startDateObj as Date).getTime() : null;
                                const endTime = hasRangeBounds ? (endDateObj as Date).getTime() : null;
                                const cellTime = hasRangeBounds ? (cellDateObj as Date).getTime() : null;
                                const minRangeTime = startTime != null && endTime != null ? Math.min(startTime, endTime) : null;
                                const maxRangeTime = startTime != null && endTime != null ? Math.max(startTime, endTime) : null;
                                const inRange = Boolean(
                                  minRangeTime != null &&
                                  maxRangeTime != null &&
                                  cellTime != null &&
                                  cellTime >= minRangeTime &&
                                  cellTime <= maxRangeTime
                                );
                                const hasPreviewBounds = Boolean(
                                  dateSelectionStep === 'end' &&
                                  startDateObj &&
                                  !endDateObj &&
                                  hoverDateObj &&
                                  cellDateObj
                                );
                                const previewStartTime = hasPreviewBounds
                                  ? Math.min((startDateObj as Date).getTime(), (hoverDateObj as Date).getTime())
                                  : null;
                                const previewEndTime = hasPreviewBounds
                                  ? Math.max((startDateObj as Date).getTime(), (hoverDateObj as Date).getTime())
                                  : null;
                                const previewCellTime = hasPreviewBounds ? (cellDateObj as Date).getTime() : null;
                                const inPreviewRange = Boolean(
                                  previewStartTime != null &&
                                  previewEndTime != null &&
                                  previewCellTime != null &&
                                  previewCellTime >= previewStartTime &&
                                  previewCellTime <= previewEndTime
                                );
                                const isPast = cell.iso < todayIso;

                                const dayStyle: React.CSSProperties = {
                                  width: '2rem',
                                  height: '2rem',
                                  minHeight: 0,
                                  borderRadius: '9999px',
                                  border: '0',
                                  padding: 0,
                                  outline: 'none',
                                  boxShadow: 'none',
                                  backgroundColor: 'transparent',
                                  color: cell.inCurrentMonth ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)',
                                  fontSize: '11px',
                                  lineHeight: 1,
                                  fontWeight: 500,
                                  cursor: isPast ? 'not-allowed' : 'pointer',
                                  opacity: isPast ? 0.4 : 1,
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none',
                                  transition: 'background-color 140ms ease, color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
                                };

                                if (isStart || isEnd) {
                                  dayStyle.backgroundColor = '#ffffff';
                                  dayStyle.color = '#0f172a';
                                  dayStyle.fontWeight = 600;
                                } else if (inRange) {
                                  dayStyle.backgroundColor = 'rgba(99, 102, 241, 0.35)';
                                  dayStyle.color = '#ffffff';
                                  dayStyle.boxShadow = 'inset 0 0 0 1px rgba(165, 180, 252, 0.55)';
                                } else if (inPreviewRange) {
                                  dayStyle.backgroundColor = 'rgba(129, 140, 248, 0.58)';
                                  dayStyle.color = '#ffffff';
                                  dayStyle.boxShadow = 'inset 0 0 0 1px rgba(199, 210, 254, 0.9)';
                                }

                                if (!isPast && !inRange && !inPreviewRange && !(isStart || isEnd) && datePickerHoverIso === cell.iso) {
                                  dayStyle.backgroundColor = 'rgba(255, 255, 255, 0.10)';
                                  dayStyle.color = '#ffffff';
                                }

                                return (
                                  <div
                                    key={cell.iso}
                                    role="button"
                                    tabIndex={isPast ? -1 : 0}
                                    aria-disabled={isPast}
                                    onClick={() => !isPast && pickDateFromCalendar(cell.iso)}
                                    onMouseEnter={() => {
                                      if (isPast || dateSelectionStep !== 'end') return;
                                      setDatePickerHoverIso(cell.iso);
                                    }}
                                    onKeyDown={(event) => {
                                      if (isPast) return;
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        pickDateFromCalendar(cell.iso);
                                      }
                                    }}
                                    className="flex items-center justify-center rounded-full"
                                    style={dayStyle}
                                  >
                                    {cell.date.getDate()}
                                  </div>
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

                {tripProgress.visible && (
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-white/75">
                      <span>{tripProgress.progressLabel}</span>
                      <span>{Math.round(tripProgress.progressPercent)}%</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full transition-all duration-700" style={progressFillStyle} />
                    </div>
                    <p className="mt-2 text-xs font-medium text-white/90">{tripProgress.statusHeadline}</p>
                    <p className="mt-1 text-[11px] text-white/65">{tripProgress.statusDetail}</p>
                  </div>
                )}

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

    </>
  );
});

const AddPostCard = React.memo(function AddPostCard({
  value,
  posting,
  onChange,
  onSubmit,
  onEmoji,
  mentionCandidates,
  mentions,
  onMentionsChange,
  charLimit,
}: {
  value: string;
  posting: boolean;
  onChange: (next: string) => void;
  onSubmit: (pickedFiles: ComposerPickedFile[]) => Promise<boolean>;
  onEmoji: (emoji: string) => void;
  mentionCandidates: string[];
  mentions: string[];
  onMentionsChange: (next: string[]) => void;
  charLimit: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerAnchorRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiOverlayPosition, setEmojiOverlayPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [pickedFiles, setPickedFiles] = useState<ComposerPickedFile[]>([]);

  const remaining = charLimit - value.length;
  const firstUrl = useMemo(() => extractFirstUrl(value), [value]);

  const filteredMentions = useMemo(() => {
    const query = normalizeSearchText(mentionQuery);
    if (!query) return mentionCandidates.slice(0, 6);
    return mentionCandidates
      .filter((entry) => normalizeSearchText(entry).includes(query))
      .slice(0, 6);
  }, [mentionCandidates, mentionQuery]);

  const updateMentionState = useCallback((nextValue: string, selectionStart: number) => {
    const beforeCaret = nextValue.slice(0, selectionStart);
    const atMatch = beforeCaret.match(/(^|\s)@([\p{L}\p{N}_.-]{1,40})$/u);
    if (!atMatch) {
      setMentionOpen(false);
      setMentionQuery('');
      return;
    }
    setMentionOpen(true);
    setMentionQuery(atMatch[2] ?? '');
  }, []);

  const handleChange = useCallback((next: string, selectionStart: number) => {
    if (next.length <= charLimit) {
      onChange(next);
      onMentionsChange(mentions.filter((entry) => next.includes(`@${entry}`)));
      updateMentionState(next, selectionStart);
    }
  }, [charLimit, mentions, onChange, onMentionsChange, updateMentionState]);

  const applyMention = useCallback((name: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const atMatch = before.match(/(^|\s)@([\p{L}\p{N}_.-]{0,40})$/u);
    if (!atMatch) return;

    const prefix = before.slice(0, before.length - (atMatch[0]?.length ?? 0));
    const spacer = atMatch[1] ?? '';
    const mention = `${spacer}@${name} `;
    const next = `${prefix}${mention}${after}`;
    if (next.length > charLimit) return;

    onChange(next);
    if (!mentions.includes(name)) {
      onMentionsChange([...mentions, name]);
    }
    setMentionOpen(false);
    setMentionQuery('');

    requestAnimationFrame(() => {
      const nextCursor = (prefix + mention).length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }, [charLimit, mentions, onChange, onMentionsChange, value]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      if (!posting && (value.trim() || pickedFiles.length > 0) && value.length <= charLimit) {
        void onSubmit(pickedFiles).then((didPost) => {
          if (didPost) setPickedFiles([]);
        });
      }
      return;
    }

    if (event.key === 'Enter' && mentionOpen && filteredMentions.length > 0) {
      event.preventDefault();
      applyMention(filteredMentions[0]);
      return;
    }
  }, [applyMention, charLimit, filteredMentions, mentionOpen, onSubmit, posting, value]);

  const insertEmojiAtCursor = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onEmoji(emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    if (next.length > charLimit) return;
    onChange(next);
    requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
      updateMentionState(next, cursor);
    });
  }, [charLimit, onChange, onEmoji, updateMentionState, value]);

  const appendPickedFiles = useCallback((fileList: FileList | null, kind: 'file' | 'image') => {
    if (!fileList) return;
    const nextFiles = Array.from(fileList)
      .slice(0, 5)
      .map((file) => ({
        id: `${kind}-${file.name}-${file.size}-${file.lastModified}-${Date.now()}`,
        name: file.name,
        kind,
        file,
      }));

    if (nextFiles.length === 0) return;
    setPickedFiles((prev) => [...prev, ...nextFiles].slice(-8));
  }, []);

  const removePickedFile = useCallback((id: string) => {
    setPickedFiles((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const submitPost = useCallback(() => {
    if (posting) return;
    void onSubmit(pickedFiles).then((didPost) => {
      if (didPost) setPickedFiles([]);
    });
  }, [onSubmit, pickedFiles, posting]);

  const emojiPickerTheme = useMemo(() => ({
    '--epr-bg-color': 'rgba(15, 23, 42, 0.95)',
    '--epr-text-color': 'rgba(255, 255, 255, 0.92)',
    '--epr-search-input-bg-color': 'rgba(255, 255, 255, 0.06)',
    '--epr-search-border-color': 'rgba(255, 255, 255, 0.16)',
    '--epr-search-border-color-active': 'rgba(255, 255, 255, 0.30)',
    '--epr-category-label-bg-color': 'rgba(15, 23, 42, 0.96)',
    '--epr-category-icon-active-color': 'rgba(255, 255, 255, 0.92)',
    '--epr-category-icon-disabled-color': 'rgba(255, 255, 255, 0.40)',
    '--epr-highlight-color': 'rgba(255, 255, 255, 0.22)',
    '--epr-hover-bg-color': 'rgba(255, 255, 255, 0.10)',
    '--epr-hover-bg-color-reduced-opacity': 'rgba(255, 255, 255, 0.08)',
    '--epr-focus-bg-color': 'rgba(255, 255, 255, 0.14)',
    '--epr-picker-border-color': 'rgba(255, 255, 255, 0.08)',
    '--epr-emoji-hover-color': 'rgba(255, 255, 255, 0.14)',
    '--epr-active-skin-hover-color': 'rgba(255, 255, 255, 0.14)',
    '--epr-emoji-variation-indicator-color': 'rgba(255, 255, 255, 0.35)',
    '--epr-emoji-variation-indicator-color-hover': 'rgba(255, 255, 255, 0.55)',
    '--epr-active-skin-tone-indicator-border-color': 'rgba(255, 255, 255, 0.92)',

    '--epr-dark-highlight-color': 'rgba(255, 255, 255, 0.22)',
    '--epr-dark-text-color': 'rgba(255, 255, 255, 0.92)',
    '--epr-dark-hover-bg-color': 'rgba(255, 255, 255, 0.10)',
    '--epr-dark-hover-bg-color-reduced-opacity': 'rgba(255, 255, 255, 0.08)',
    '--epr-dark-focus-bg-color': 'rgba(255, 255, 255, 0.14)',
    '--epr-dark-search-input-bg-color': 'rgba(255, 255, 255, 0.06)',
    '--epr-dark-search-input-bg-color-active': 'rgba(255, 255, 255, 0.10)',
    '--epr-dark-category-label-bg-color': 'rgba(15, 23, 42, 0.96)',
    '--epr-dark-picker-border-color': 'rgba(255, 255, 255, 0.08)',
    '--epr-dark-bg-color': 'rgba(15, 23, 42, 0.95)',
    '--epr-dark-reactions-bg-color': 'rgba(15, 23, 42, 0.90)',
    '--epr-dark-emoji-variation-picker-bg-color': 'rgba(15, 23, 42, 0.95)',
    '--epr-dark-emoji-variation-indicator-color': 'rgba(255, 255, 255, 0.35)',
    '--epr-dark-category-icon-active-color': 'rgba(255, 255, 255, 0.92)',
    '--epr-dark-skin-tone-picker-menu-color': 'rgba(15, 23, 42, 0.95)',
    '--epr-dark-skin-tone-outer-border-color': 'rgba(255, 255, 255, 0.16)',
    '--epr-dark-skin-tone-inner-border-color': 'transparent',
  }) as React.CSSProperties, []);

  const toggleEmoji = useCallback(() => {
    setEmojiOpen((prev) => !prev);
  }, []);

  const updateEmojiOverlayPosition = useCallback(() => {
    const anchor = composerAnchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setEmojiOverlayPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!emojiOpen) return;
    updateEmojiOverlayPosition();

    const handleViewportChange = () => updateEmojiOverlayPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [emojiOpen, updateEmojiOverlayPosition]);

  return (
    <div className="relative overflow-visible">
      <div ref={composerAnchorRef} className="relative">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          <textarea
            ref={textareaRef}
            className="w-full min-h-[128px] resize-none bg-transparent px-3 py-3 text-sm text-white outline-none"
            placeholder="Napisz wiadomość…"
            value={value}
            onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={handleKeyDown}
          />

          {pickedFiles.length > 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {pickedFiles.map((entry) => (
                <span key={entry.id} className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/8 px-2 py-1 text-[11px] text-white/85">
                  {entry.kind === 'image' ? '🖼️' : '📎'} {entry.name}
                  <button
                    type="button"
                    className="ml-1 text-white/60 hover:text-white"
                    onClick={() => removePickedFile(entry.id)}
                    aria-label="Usuń wybrany plik"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <ComposerInputToolbar
            valueLength={value.length}
            charLimit={charLimit}
            remaining={remaining}
            posting={posting}
            canSubmit={(Boolean(value.trim()) || pickedFiles.length > 0) && value.length <= charLimit && !posting}
            onToggleEmoji={toggleEmoji}
            onAttachFile={() => attachmentInputRef.current?.click()}
            onAttachImage={() => imageInputRef.current?.click()}
            onSubmit={submitPost}
          />

          <input
            ref={attachmentInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              appendPickedFiles(event.target.files, 'file');
              event.currentTarget.value = '';
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              appendPickedFiles(event.target.files, 'image');
              event.currentTarget.value = '';
            }}
          />

          {mentionOpen && filteredMentions.length > 0 && (
            <div className="absolute left-2 right-2 bottom-12 rounded-lg border border-white/10 bg-slate-900/95 p-1.5 z-20">
              {filteredMentions.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => applyMention(candidate)}
                  className="w-full rounded-md px-2 py-1 text-left text-xs text-white/85 hover:bg-white/10"
                >
                  <AtSymbolIcon className="inline-block h-3 w-3 mr-1" />
                  {candidate}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {emojiOpen && emojiOverlayPosition && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1300]"
          onMouseDown={() => setEmojiOpen(false)}
        >
          <div
            className="absolute rounded-xl border border-white/10 bg-slate-900/95 p-2.5 shadow-2xl"
            style={{
              top: emojiOverlayPosition.top,
              left: emojiOverlayPosition.left,
              width: emojiOverlayPosition.width,
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <EmojiPicker
              className="composer-emoji-picker"
              theme={Theme.DARK}
              style={emojiPickerTheme}
              width="100%"
              height={340}
              lazyLoadEmojis={true}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled={false}
              searchDisabled={false}
              searchPlaceholder="Szukaj"
              searchPlaceHolder="Szukaj"
              onEmojiClick={(emojiData: EmojiClickData) => {
                insertEmojiAtCursor(emojiData.emoji);
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {firstUrl && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          Podgląd linku: <a href={firstUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline">{firstUrl}</a>
        </div>
      )}

    </div>
  );
});

const ComposerInputToolbar = React.memo(function ComposerInputToolbar({
  valueLength,
  charLimit,
  remaining,
  posting,
  canSubmit,
  onToggleEmoji,
  onAttachFile,
  onAttachImage,
  onSubmit,
}: {
  valueLength: number;
  charLimit: number;
  remaining: number;
  posting: boolean;
  canSubmit: boolean;
  onToggleEmoji: () => void;
  onAttachFile: () => void;
  onAttachImage: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/10 px-2 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="app-icon-btn app-icon-btn-sm"
          onClick={onToggleEmoji}
          title="Emoji"
          aria-label="Emoji"
        >
          <FaceSmileIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="app-icon-btn app-icon-btn-sm"
          onClick={onAttachFile}
          title="Dodaj plik"
          aria-label="Dodaj plik"
        >
          <PaperClipIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="app-icon-btn app-icon-btn-sm"
          onClick={onAttachImage}
          title="Dodaj obraz"
          aria-label="Dodaj obraz"
        >
          <PhotoIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-2 text-[11px]">
        <span className="text-white/45">Ctrl+Enter</span>
        <span className={remaining < 0 ? 'text-red-300' : 'text-white/55'}>{valueLength}/{charLimit}</span>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="px-3 py-1.5 text-xs"
        >
          {posting ? 'Dodawanie…' : 'Dodaj post'}
        </Button>
      </div>
    </div>
  );
});

const TripPlanSection = React.memo(function TripPlanSection({
  tripDays,
  loading,
  canEdit,
  onUpdateDay,
  onReorder,
}: {
  tripDays: TripDay[];
  loading: boolean;
  canEdit: boolean;
  onUpdateDay: (dayId: string, payload: Partial<TripDay>) => Promise<void>;
  onReorder: (orderedDayIds: string[]) => Promise<void>;
}) {
  const [expandedDayIds, setExpandedDayIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TripDay>>({});
  const [draggingDayId, setDraggingDayId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'single'>('list');
  const [singleDayIndex, setSingleDayIndex] = useState(0);

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, TripDay> = {};
      for (const day of tripDays) {
        next[day.id] = prev[day.id] ? { ...prev[day.id], ...day } : { ...day };
      }
      return next;
    });
    setExpandedDayIds((prev) => prev.filter((id) => tripDays.some((day) => day.id === id)));
    setSingleDayIndex((prev) => {
      if (tripDays.length === 0) return 0;
      return Math.min(prev, tripDays.length - 1);
    });
  }, [tripDays]);

  const singleDay = useMemo(() => {
    if (tripDays.length === 0) return null;
    return tripDays[singleDayIndex] ?? null;
  }, [singleDayIndex, tripDays]);

  const updateDraftField = useCallback((dayId: string, key: keyof TripDay, value: string) => {
    setDrafts((prev) => {
      const current = prev[dayId];
      if (!current) return prev;
      const nextDay = { ...current, [key]: value } as TripDay;
      return { ...prev, [dayId]: nextDay };
    });
  }, []);

  const persistDayDraft = useCallback(async (dayId: string) => {
    const sourceDay = tripDays.find((day) => day.id === dayId);
    if (!sourceDay) return;
    const draft = drafts[dayId] ?? sourceDay;

    const normalizeText = (value?: string | null) => (value == null || value === '' ? null : value);
    const normalizeBudget = (value: unknown) => {
      if (value == null || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const dayPayload: Partial<TripDay> = {
      title: normalizeText(draft.title),
      date: normalizeText(draft.date),
      location: normalizeText(draft.location),
      estimatedBudget: normalizeBudget(draft.estimatedBudget),
      accommodation: normalizeText(draft.accommodation),
      description: normalizeText(draft.description),
    };

    const dayChanged = (
      dayPayload.title !== (sourceDay.title ?? null) ||
      dayPayload.date !== (sourceDay.date ?? null) ||
      dayPayload.location !== (sourceDay.location ?? null) ||
      dayPayload.estimatedBudget !== (sourceDay.estimatedBudget ?? null) ||
      dayPayload.accommodation !== (sourceDay.accommodation ?? null) ||
      dayPayload.description !== (sourceDay.description ?? null)
    );

    if (dayChanged) {
      await onUpdateDay(dayId, dayPayload);
    }
  }, [drafts, onUpdateDay, tripDays]);

  const toggleDayExpanded = useCallback((dayId: string) => {
    setExpandedDayIds((prev) => {
      const isOpen = prev.includes(dayId);
      if (isOpen) {
        void persistDayDraft(dayId);
        return prev.filter((id) => id !== dayId);
      }
      return [...prev, dayId];
    });
  }, [persistDayDraft]);

  const togglePlanViewMode = useCallback(() => {
    if (viewMode === 'list') {
      expandedDayIds.forEach((dayId) => {
        void persistDayDraft(dayId);
      });
      setViewMode('single');
      return;
    }

    if (singleDay) {
      void persistDayDraft(singleDay.id);
    }
    setViewMode('list');
  }, [expandedDayIds, persistDayDraft, singleDay, viewMode]);

  const goToDay = useCallback((direction: -1 | 1) => {
    if (!singleDay) return;
    void persistDayDraft(singleDay.id);
    setSingleDayIndex((prev) => {
      const next = prev + direction;
      if (next < 0 || next >= tripDays.length) return prev;
      return next;
    });
  }, [persistDayDraft, singleDay, tripDays.length]);

  useEffect(() => {
    return () => {
      expandedDayIds.forEach((dayId) => {
        void persistDayDraft(dayId);
      });
      if (viewMode === 'single' && singleDay) {
        void persistDayDraft(singleDay.id);
      }
    };
  }, [expandedDayIds, persistDayDraft, singleDay, viewMode]);

  const renderDayEditor = useCallback((day: TripDay) => {
    const draft = drafts[day.id] ?? day;
    return (
      <div className="border-t border-white/10 px-3 py-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="rounded-lg bg-white/6 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.title ?? ''}
            onChange={(e) => updateDraftField(day.id, 'title', e.target.value)}
            placeholder="Tytuł dnia"
            disabled={!canEdit}
          />
          <input
            className="rounded-lg bg-white/6 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.location ?? ''}
            onChange={(e) => updateDraftField(day.id, 'location', e.target.value)}
            placeholder="Lokalizacja"
            disabled={!canEdit}
          />
          <input
            className="rounded-lg bg-white/6 border border-white/10 px-3 py-2 text-sm text-white"
            value={draft.estimatedBudget != null ? String(draft.estimatedBudget) : ''}
            onChange={(e) => updateDraftField(day.id, 'estimatedBudget', e.target.value)}
            placeholder="Szacowany budżet"
            disabled={!canEdit}
          />
          <input
            className="rounded-lg bg-white/6 border border-white/10 px-3 py-2 text-sm text-white md:col-span-2"
            value={draft.accommodation ?? ''}
            onChange={(e) => updateDraftField(day.id, 'accommodation', e.target.value)}
            placeholder="Nocleg"
            disabled={!canEdit}
          />
        </div>

        <textarea
          className="w-full rounded-lg bg-white/6 border border-white/10 px-3 py-2 text-sm text-white min-h-[84px]"
          value={draft.description ?? ''}
          onChange={(e) => updateDraftField(day.id, 'description', e.target.value)}
          placeholder="Opis dnia"
          disabled={!canEdit}
        />

      </div>
    );
  }, [canEdit, drafts, updateDraftField]);

  const handleDrop = useCallback((targetDayId: string) => {
    if (!draggingDayId || draggingDayId === targetDayId) return;
    const ids = tripDays.map((day) => day.id);
    const from = ids.indexOf(draggingDayId);
    const to = ids.indexOf(targetDayId);
    if (from === -1 || to === -1) return;

    const reordered = [...ids];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setDraggingDayId(null);
    void onReorder(reordered);
  }, [draggingDayId, onReorder, tripDays]);

  return (
    <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-5 md:p-6 bg-white/[0.04] border-white/10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">🗓 Plan podróży</h2>
        <div className="flex items-center gap-2">
          {viewMode === 'single' && singleDay && (
            <span className="text-xs text-white/65">Dzień {singleDay.dayNumber} / {tripDays.length}</span>
          )}
          <button
            type="button"
            className="app-icon-btn"
            onClick={togglePlanViewMode}
            title={viewMode === 'list' ? 'Przełącz na widok pojedynczego dnia' : 'Przełącz na widok listy'}
            aria-label={viewMode === 'list' ? 'Widok pojedynczego dnia' : 'Widok listy'}
          >
            {viewMode === 'list' ? <CalendarDaysIcon className="h-4 w-4" /> : <QueueListIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-16 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-16 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-16 rounded-lg bg-white/10 animate-pulse" />
        </div>
      ) : tripDays.length === 0 ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/60">
          Brak zaplanowanych dni. {canEdit ? 'Dodaj pierwszy dzień podróży.' : 'Plan nie został jeszcze utworzony.'}
        </div>
      ) : viewMode === 'single' && singleDay ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="app-icon-btn"
              onClick={() => goToDay(-1)}
              disabled={singleDayIndex <= 0}
              title="Poprzedni dzień"
              aria-label="Poprzedni dzień"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <p className="text-xs text-white/65">Przeglądaj dni strzałkami</p>
            <button
              type="button"
              className="app-icon-btn"
              onClick={() => goToDay(1)}
              disabled={singleDayIndex >= tripDays.length - 1}
              title="Następny dzień"
              aria-label="Następny dzień"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5">
            <div className="w-full rounded-xl px-3 py-2.5 flex items-center justify-between text-left">
              <div className="min-w-0">
                <p className="text-sm text-white/90 font-medium truncate">Dzień {singleDay.dayNumber} – {singleDay.title?.trim() || 'Bez tytułu'}</p>
                <p className="text-[10px] text-white/55 truncate">{formatDate(singleDay.date)}{singleDay.location ? ` · ${singleDay.location}` : ''}</p>
              </div>
            </div>
            {renderDayEditor(singleDay)}
          </div>
        </div>
      ) : (
        <div className={`mt-3 space-y-2 ${tripDays.length > 5 ? 'max-h-[300px] overflow-y-auto pr-1' : ''}`}>
          {tripDays.map((day) => {
            const expanded = expandedDayIds.includes(day.id);
            return (
              <div
                key={day.id}
                draggable={canEdit}
                onDragStart={() => setDraggingDayId(day.id)}
                onDragOver={(event) => {
                  if (!canEdit) return;
                  event.preventDefault();
                }}
                onDrop={() => handleDrop(day.id)}
                className="rounded-xl border border-white/10 bg-white/5"
              >
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-1.5 flex items-center justify-between text-left hover:bg-white/10 transition"
                  onClick={() => toggleDayExpanded(day.id)}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white/90 font-medium truncate">Dzień {day.dayNumber} – {day.title?.trim() || 'Bez tytułu'}</p>
                    <p className="text-[10px] text-white/55 truncate">{formatDate(day.date)}{day.location ? ` · ${day.location}` : ''}</p>
                  </div>
                  {expanded ? <ChevronUpIcon className="w-4 h-4 text-white/70" /> : <ChevronDownIcon className="w-4 h-4 text-white/70" />}
                </button>
                {expanded ? renderDayEditor(day) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
});

const PostCard = React.memo(function PostCard({
  post,
  canModerate,
  readOnly,
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
  readOnly: boolean;
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
  const canDeletePost = !readOnly && (post.authorId === currentUserId || canModerate);
  const firstUrl = useMemo(() => extractFirstUrl(post.content), [post.content]);
  const postMentionNames = useMemo(() => (post.mentions ?? []).map((entry) => entry.name), [post.mentions]);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commentAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const commentImageInputRef = useRef<HTMLInputElement | null>(null);
  const [commentEmojiOpen, setCommentEmojiOpen] = useState(false);
  const commentEmojiAnchorRef = useRef<HTMLDivElement | null>(null);
  const [commentEmojiOverlayPosition, setCommentEmojiOverlayPosition] = useState<{ top: number; left: number } | null>(null);
  const [commentPickedFiles, setCommentPickedFiles] = useState<Array<{ id: string; name: string; kind: 'file' | 'image' }>>([]);
  const [replyTarget, setReplyTarget] = useState<{ id: string; authorName: string } | null>(null);
  const [reactionHoverTarget, setReactionHoverTarget] = useState<string | null>(null);
  const [reactionMenuPosition, setReactionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedReactions, setSelectedReactions] = useState<Record<string, string>>({});
  const [activeImagePreview, setActiveImagePreview] = useState<{ src: string; name: string } | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const reactionCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const reactionOptions = useMemo(() => ([
    { key: 'like', label: 'Lubię to', emoji: '👍' },
    { key: 'love', label: 'Super', emoji: '❤️' },
    { key: 'haha', label: 'Haha', emoji: '😄' },
    { key: 'wow', label: 'Wow', emoji: '😮' },
  ]), []);

  const reactionEmojiByKey = useMemo(() => {
    const map = new Map<string, string>();
    reactionOptions.forEach((reaction) => map.set(reaction.key, reaction.emoji));
    return map;
  }, [reactionOptions]);

  const getReactionEmoji = useCallback((reactionKey?: string | null) => {
    if (!reactionKey) return '👍';
    return reactionEmojiByKey.get(reactionKey) ?? '👍';
  }, [reactionEmojiByKey]);

  const openReactionMenu = useCallback((target: string) => {
    if (reactionCloseTimerRef.current) {
      clearTimeout(reactionCloseTimerRef.current);
      reactionCloseTimerRef.current = null;
    }
    const anchor = reactionAnchorRefs.current[target];
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      setReactionMenuPosition({
        top: rect.bottom + 6,
        left: rect.left,
      });
    }
    setReactionHoverTarget(target);
  }, []);

  const scheduleCloseReactionMenu = useCallback((target: string) => {
    if (reactionCloseTimerRef.current) clearTimeout(reactionCloseTimerRef.current);
    reactionCloseTimerRef.current = setTimeout(() => {
      setReactionHoverTarget((prev) => {
        if (prev !== target) return prev;
        setReactionMenuPosition(null);
        return null;
      });
      reactionCloseTimerRef.current = null;
    }, 180);
  }, []);

  const setReactionAnchorRef = useCallback((target: string) => (node: HTMLDivElement | null) => {
    reactionAnchorRefs.current[target] = node;
  }, []);

  useEffect(() => {
    return () => {
      if (reactionCloseTimerRef.current) clearTimeout(reactionCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!reactionHoverTarget) return;

    const updatePosition = () => {
      const anchor = reactionAnchorRefs.current[reactionHoverTarget];
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setReactionMenuPosition({ top: rect.bottom + 6, left: rect.left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [reactionHoverTarget]);

  const appendCommentFiles = useCallback((fileList: FileList | null, kind: 'file' | 'image') => {
    if (!fileList) return;
    const next = Array.from(fileList).slice(0, 5).map((file) => ({
      id: `${kind}-${file.name}-${file.size}-${file.lastModified}-${Date.now()}`,
      name: file.name,
      kind,
    }));
    if (!next.length) return;
    setCommentPickedFiles((prev) => [...prev, ...next].slice(-8));
  }, []);

  const insertCommentEmojiAtCursor = useCallback((emoji: string) => {
    const textarea = commentTextareaRef.current;
    if (!textarea) {
      onCommentDraft(`${commentDraft}${emoji}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${commentDraft.slice(0, start)}${emoji}${commentDraft.slice(end)}`;
    onCommentDraft(next);
    requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }, [commentDraft, onCommentDraft]);

  const updateCommentEmojiOverlayPosition = useCallback(() => {
    const anchor = commentEmojiAnchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setCommentEmojiOverlayPosition({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, []);

  useEffect(() => {
    if (!commentEmojiOpen) return;
    updateCommentEmojiOverlayPosition();

    const handleViewportChange = () => updateCommentEmojiOverlayPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [commentEmojiOpen, updateCommentEmojiOverlayPosition]);

  const emojiPickerTheme = useMemo(() => ({
    '--epr-bg-color': 'rgba(15, 23, 42, 0.95)',
    '--epr-text-color': 'rgba(255, 255, 255, 0.92)',
    '--epr-search-input-bg-color': 'rgba(255, 255, 255, 0.06)',
    '--epr-search-border-color': 'rgba(255, 255, 255, 0.16)',
    '--epr-search-border-color-active': 'rgba(255, 255, 255, 0.30)',
    '--epr-category-label-bg-color': 'rgba(15, 23, 42, 0.96)',
    '--epr-hover-bg-color': 'rgba(255, 255, 255, 0.10)',
    '--epr-focus-bg-color': 'rgba(255, 255, 255, 0.14)',
    '--epr-picker-border-color': 'rgba(255, 255, 255, 0.08)',
  }) as React.CSSProperties, []);

  return (
    <Card className="group/post relative z-0 hover:z-20 dashboard-card !min-h-0 !h-auto !max-h-none !overflow-visible !justify-start rounded-2xl p-4 md:p-5 bg-white/[0.035] border-white/10">
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
            className="app-icon-btn app-icon-btn-sm opacity-0 transition-opacity duration-150 group-hover/post:opacity-100"
            onClick={onDeletePost}
            aria-label="Usuń post"
            title="Usuń post"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{renderPostContent(post.content, postMentionNames)}</div>

      {Array.isArray(post.attachments) && post.attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {post.attachments.map((attachment) => {
              const src = attachment.dataUrl ?? null;
              if (attachment.kind === 'image' && src) {
                return (
                  <div key={attachment.id} className="group/att relative rounded-lg border border-white/10 bg-white/5 p-1">
                    <div
                      role="button"
                      tabIndex={0}
                      className="block w-full cursor-zoom-in rounded-md text-left"
                      onClick={() => {
                        setPreviewScale(1);
                        setActiveImagePreview({ src, name: attachment.name });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        setPreviewScale(1);
                        setActiveImagePreview({ src, name: attachment.name });
                      }}
                      aria-label={`Powiększ obraz ${attachment.name}`}
                      title="Powiększ obraz"
                    >
                      <img src={src} alt={attachment.name} className="w-full max-h-[28rem] rounded-md object-contain bg-black/20" />
                    </div>

                    <div className="pointer-events-none absolute inset-1 flex items-start justify-end gap-1 rounded-md bg-black/0 p-2 opacity-0 transition-opacity duration-150 group-hover/att:pointer-events-auto group-hover/att:bg-black/30 group-hover/att:opacity-100">
                      <button
                        type="button"
                        className="pointer-events-auto app-icon-btn app-icon-btn-sm"
                        onClick={() => {
                          setPreviewScale(1);
                          setActiveImagePreview({ src, name: attachment.name });
                        }}
                        aria-label={`Powiększ obraz ${attachment.name}`}
                        title="Powiększ"
                      >
                        <MagnifyingGlassPlusIcon className="h-4 w-4" />
                      </button>
                      <a
                        className="pointer-events-auto app-icon-btn app-icon-btn-sm"
                        href={src}
                        download={attachment.name}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Pobierz obraz ${attachment.name}`}
                        title="Pobierz"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                );
              }

              return (
                <a
                  key={attachment.id}
                  href={src || '#'}
                  download={src ? attachment.name : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 ${src ? 'hover:bg-white/10' : 'cursor-default opacity-70 pointer-events-none'}`}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/10">
                    <PaperClipIcon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{attachment.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {firstUrl && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          Link: <a href={firstUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline">{firstUrl}</a>
        </div>
      )}

      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="flex items-center gap-3 text-xs">
          <div
            ref={setReactionAnchorRef(`post:${post.id}`)}
            className="relative"
            onMouseEnter={() => openReactionMenu(`post:${post.id}`)}
            onMouseLeave={() => scheduleCloseReactionMenu(`post:${post.id}`)}
          >
            <button type="button" className="board-text-action-btn text-xs text-white/65 hover:text-white hover:underline underline-offset-2">
              Lubię to
            </button>
          </div>

          <button
            type="button"
            className="board-text-action-btn text-xs text-white/70 hover:text-white hover:underline underline-offset-2"
            onClick={onToggleComments}
          >
            Komentarze ({post.comments.length})
          </button>

          {selectedReactions[`post:${post.id}`] && (
            <span
              role="button"
              tabIndex={0}
              className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-md bg-white/0 text-sm leading-none text-white/90 transition-colors duration-150 hover:bg-white/10"
              aria-label="Usuń reakcję"
              title="Usuń reakcję"
              onClick={() => {
                setSelectedReactions((prev) => {
                  const next = { ...prev };
                  delete next[`post:${post.id}`];
                  return next;
                });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                setSelectedReactions((prev) => {
                  const next = { ...prev };
                  delete next[`post:${post.id}`];
                  return next;
                });
              }}
            >
              {getReactionEmoji(selectedReactions[`post:${post.id}`])}
            </span>
          )}
        </div>

        {commentsOpen && (
          <div className="mt-3 space-y-2">
            {post.comments.length === 0 && (
              <div className="text-xs text-white/55">Brak komentarzy.</div>
            )}

            {post.comments.map((comment: BoardComment) => {
              const canDeleteComment = !readOnly && (comment.authorId === currentUserId || canModerate);
              return (
                <div key={comment.id} className="group/comment rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-white/65">
                      <span className="text-white/90 font-medium">{comment.authorName}</span> · {formatDateTime(comment.createdAt)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canDeleteComment && (
                        <button
                          type="button"
                          className="app-icon-btn app-icon-btn-sm opacity-0 transition-opacity duration-150 group-hover/comment:opacity-100"
                          onClick={() => onDeleteComment(comment.id)}
                          aria-label="Usuń komentarz"
                          title="Usuń komentarz"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-white/90 whitespace-pre-wrap">{comment.content}</div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        ref={setReactionAnchorRef(`comment:${comment.id}`)}
                        className="relative"
                        onMouseEnter={() => openReactionMenu(`comment:${comment.id}`)}
                        onMouseLeave={() => scheduleCloseReactionMenu(`comment:${comment.id}`)}
                      >
                        <button type="button" className="board-text-action-btn text-[11px] text-white/60 hover:text-white hover:underline underline-offset-2">
                          Lubię to
                        </button>
                      </div>

                      {selectedReactions[`comment:${comment.id}`] && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-md bg-white/0 text-sm leading-none text-white/90 transition-colors duration-150 hover:bg-white/10"
                          aria-label="Usuń reakcję"
                          title="Usuń reakcję"
                          onClick={() => {
                            setSelectedReactions((prev) => {
                              const next = { ...prev };
                              delete next[`comment:${comment.id}`];
                              return next;
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            setSelectedReactions((prev) => {
                              const next = { ...prev };
                              delete next[`comment:${comment.id}`];
                              return next;
                            });
                          }}
                        >
                          {getReactionEmoji(selectedReactions[`comment:${comment.id}`])}
                        </span>
                      )}

                      {!readOnly && (
                        <button
                          type="button"
                          className="board-text-action-btn text-[11px] text-white/60 hover:text-white"
                          onClick={() => {
                            const nextDraft = `@${comment.authorName} `;
                            onCommentDraft(nextDraft);
                            setReplyTarget({ id: comment.id, authorName: comment.authorName });
                            requestAnimationFrame(() => commentTextareaRef.current?.focus());
                          }}
                        >
                          Odpowiedz
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {readOnly ? (
              <div className="pt-1 text-xs text-white/55">Komentowanie jest wyłączone dla zarchiwizowanej tablicy.</div>
            ) : (
            <div className="pt-1 space-y-2">
              {replyTarget && (
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75">
                  Odpowiedź do: <span className="font-medium text-white/90">{replyTarget.authorName}</span>
                  <button
                    type="button"
                    className="text-white/60 hover:text-white"
                    onClick={() => setReplyTarget(null)}
                    aria-label="Anuluj odpowiedź"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <textarea
                  ref={commentTextareaRef}
                  value={commentDraft}
                  onChange={(e) => onCommentDraft(e.target.value)}
                  placeholder="Dodaj komentarz…"
                  className="w-full min-h-[96px] resize-none bg-transparent px-3 py-3 text-sm text-white outline-none"
                />

                {commentPickedFiles.length > 0 && (
                  <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                    {commentPickedFiles.map((entry) => (
                      <span key={entry.id} className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/8 px-2 py-1 text-[11px] text-white/85">
                        {entry.kind === 'image' ? '🖼️' : '📎'} {entry.name}
                        <button
                          type="button"
                          className="ml-1 text-white/60 hover:text-white"
                          onClick={() => setCommentPickedFiles((prev) => prev.filter((item) => item.id !== entry.id))}
                          aria-label="Usuń wybrany plik"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div ref={commentEmojiAnchorRef}>
                      <button type="button" className="app-icon-btn app-icon-btn-sm" onClick={() => setCommentEmojiOpen((prev) => !prev)} aria-label="Dodaj emoji" title="Emoji">
                        <FaceSmileIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <button type="button" className="app-icon-btn app-icon-btn-sm" onClick={() => commentAttachmentInputRef.current?.click()} aria-label="Dodaj załącznik" title="Załącznik">
                      <PaperClipIcon className="h-4 w-4" />
                    </button>
                    <button type="button" className="app-icon-btn app-icon-btn-sm" onClick={() => commentImageInputRef.current?.click()} aria-label="Dodaj obraz" title="Obraz">
                      <PhotoIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="app-icon-btn cursor-pointer disabled:cursor-not-allowed"
                    disabled={!commentDraft.trim() || commentSubmitting}
                    onClick={() => {
                      onCreateComment();
                      setReplyTarget(null);
                      setCommentEmojiOpen(false);
                      setCommentPickedFiles([]);
                    }}
                    aria-label="Wyślij komentarz"
                    title="Wyślij"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>

                <input
                  ref={commentAttachmentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    appendCommentFiles(event.target.files, 'file');
                    event.currentTarget.value = '';
                  }}
                />
                <input
                  ref={commentImageInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    appendCommentFiles(event.target.files, 'image');
                    event.currentTarget.value = '';
                  }}
                />
              </div>

              {commentEmojiOpen && commentEmojiOverlayPosition && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[1700]" onMouseDown={() => setCommentEmojiOpen(false)}>
                  <div
                    className="absolute rounded-xl border border-white/10 bg-slate-900/95 p-1.5 shadow-2xl"
                    style={{ top: commentEmojiOverlayPosition.top, left: commentEmojiOverlayPosition.left }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <EmojiPicker
                      width={320}
                      height={360}
                      lazyLoadEmojis
                      skinTonesDisabled
                      theme={Theme.DARK}
                      className="composer-emoji-picker"
                      style={emojiPickerTheme}
                      previewConfig={{ showPreview: false }}
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        insertCommentEmojiAtCursor(emojiData.emoji);
                        setCommentEmojiOpen(false);
                      }}
                    />
                  </div>
                </div>,
                document.body
              )}
            </div>
            )}

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

      {reactionHoverTarget && reactionMenuPosition && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[1750] flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"
          style={{ top: reactionMenuPosition.top, left: reactionMenuPosition.left }}
          onMouseEnter={() => openReactionMenu(reactionHoverTarget)}
          onMouseLeave={() => scheduleCloseReactionMenu(reactionHoverTarget)}
        >
          {reactionOptions.map((reaction) => (
            <span
              key={reaction.key}
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-base leading-none transition-colors duration-150 hover:bg-slate-700"
              aria-label={reaction.label}
              title={reaction.label}
              onClick={() => {
                setSelectedReactions((prev) => ({ ...prev, [reactionHoverTarget]: reaction.key }));
                setReactionHoverTarget(null);
                setReactionMenuPosition(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                setSelectedReactions((prev) => ({ ...prev, [reactionHoverTarget]: reaction.key }));
                setReactionHoverTarget(null);
                setReactionMenuPosition(null);
              }}
            >
              {reaction.emoji}
            </span>
          ))}
        </div>,
        document.body
      )}

      {activeImagePreview && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1800] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4" onMouseDown={() => setActiveImagePreview(null)}>
          <div className="relative z-10 inline-flex w-auto max-h-[92vh] max-w-[96vw] flex-col rounded-3xl border border-white/10 bg-white/5 shadow-glass backdrop-blur-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-white/80">
              <span className="truncate pr-3">{activeImagePreview.name}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="app-icon-btn app-icon-btn-sm"
                  onClick={() => setPreviewScale((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                  aria-label="Powiększ obraz"
                  title="Powiększ"
                >
                  <MagnifyingGlassPlusIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="app-icon-btn app-icon-btn-sm"
                  onClick={() => setPreviewScale((prev) => Math.max(0.25, Number((prev - 0.25).toFixed(2))))}
                  aria-label="Pomniejsz obraz"
                  title="Pomniejsz"
                >
                  <MagnifyingGlassMinusIcon className="h-4 w-4" />
                </button>
                <a
                  className="app-icon-btn app-icon-btn-sm"
                  href={activeImagePreview.src}
                  download={activeImagePreview.name}
                  aria-label="Pobierz obraz"
                  title="Pobierz"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  className="app-icon-btn app-icon-btn-sm"
                  onClick={() => setActiveImagePreview(null)}
                  aria-label="Zamknij podgląd"
                  title="Zamknij"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-3">
              <img
                src={activeImagePreview.src}
                alt={activeImagePreview.name}
                className="block h-auto w-auto max-w-[90vw] max-h-[78vh]"
                style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </Card>
  );
});

const TravelInfoSidebar = React.memo(function TravelInfoSidebar({
  travelInfo,
}: {
  travelInfo: BoardTravelInfo;
}) {
  const checklist = Array.isArray(travelInfo.checklist) ? travelInfo.checklist : [];

  return (
    <div className="space-y-4">
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
  if (process.env.NODE_ENV === 'development') {
    console.count('BoardDetailClient render');
  }

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
    tripDays,
    loadingTripDays,
    composerState,
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
    addTripDay,
    updateTripDay,
    deleteTripDay,
    reorderTripDays,
    setComposerState,
    insertEmoji,
    updateBoardName,
    updateTravelInfo,
    clearBoardState,
  } = useBoard();

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
  const [archivePending, setArchivePending] = useState(false);
  const syncingTripDaysRef = useRef(false);
  const previousTravelRangeKeyRef = useRef<string | null>(null);
  const headerSectionRef = useRef<HTMLDivElement | null>(null);
  const boardGridRef = useRef<HTMLDivElement | null>(null);
  const quickNavRef = useRef<HTMLElement | null>(null);
  const [navLeftOffset, setNavLeftOffset] = useState<number>(16);
  const [travelInfoActiveType, setTravelInfoActiveType] = useState<TravelInfoType | null>(null);
  const [travelInfoModalOpen, setTravelInfoModalOpen] = useState(false);
  const travelInfoModalCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      if (travelInfoModalCloseTimerRef.current) clearTimeout(travelInfoModalCloseTimerRef.current);
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

  const isBoardArchived = Boolean(activeBoard?.isArchived);
  const canEditBoard = canModerate && !isBoardArchived;
  const canEditInfo = canEditBoard;

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

  const mentionCandidates = useMemo(() => {
    const names = boardMembers
      .map((member) => (member.fullName || member.username || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [boardMembers]);

  useEffect(() => {
    if (!selectedInviteUserId) return;
    const stillAvailable = availableBoardInviteCandidates.some((member) => String(member.id) === selectedInviteUserId);
    if (!stillAvailable) setSelectedInviteUserId('');
  }, [availableBoardInviteCandidates, selectedInviteUserId]);

  const handleToggleModerator = useCallback(async (userId: string, currentlyModerator: boolean) => {
    if (!activeBoard || !userId || memberMutationPendingId || isBoardArchived) return;
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
  }, [activeBoard, addModerator, currentUserId, isBoardArchived, memberMutationPendingId, removeModerator, toast]);

  const handleRemoveBoardMember = useCallback(async (userId: string) => {
    if (!activeBoard || !userId || memberMutationPendingId || isBoardArchived) return;
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
  }, [activeBoard, currentUserId, isBoardArchived, memberMutationPendingId, toast]);

  const handleInviteMemberToBoard = useCallback(async () => {
    if (!activeBoard || !selectedInviteUserId || invitePending || isBoardArchived) return;
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
  }, [activeBoard, invitePending, isBoardArchived, selectedInviteUserId, toast]);

  const handleArchiveBoard = useCallback(async () => {
    if (!activeBoard || archivePending || isBoardArchived) return;
    setArchivePending(true);
    const controller = registerController();
    try {
      const response = await fetch(`/api/boards/${encodeURIComponent(activeBoard.groupId)}/${encodeURIComponent(activeBoard.id)}/archive`, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Nie udało się zarchiwizować tablicy.');
      }

      toast.push({ type: 'success', title: 'Tablica', message: 'Tablica została zarchiwizowana.' });
      setMemberSettingsModalOpen(false);
      router.push('/dashboard/archive');
    } catch (err) {
      toast.push({
        type: 'error',
        title: 'Tablica',
        message: err instanceof Error ? err.message : 'Nie udało się zarchiwizować tablicy.',
      });
    } finally {
      releaseController(controller);
      setArchivePending(false);
    }
  }, [activeBoard, archivePending, isBoardArchived, router, toast]);

  const handleAutoSaveTravelInfo = useCallback(
    async <T extends TravelInfoType>(
      type: T,
      payload: TravelInfoPayloadByType[T],
      opts?: { signal?: AbortSignal }
    ) => {
      if (!activeBoard || isBoardArchived) return;
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
    [activeBoard, isBoardArchived, updateTravelInfo]
  );

  const handleRenameBoard = useCallback(
    async (nextName: string, opts?: { signal?: AbortSignal }) => {
      if (!activeBoard || isBoardArchived) return;
      await updateBoardName(activeBoard.groupId, activeBoard.id, nextName, opts);
    },
    [activeBoard, isBoardArchived, updateBoardName]
  );

  const handleUpdateMainInfo = useCallback(
    async (
      payload: { location?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null },
      opts?: { signal?: AbortSignal }
    ) => {
      if (!activeBoard || isBoardArchived) return;
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
    [activeBoard, isBoardArchived, updateTravelInfo]
  );

  const openTravelInfoType = useCallback((type: TravelInfoType) => {
    if (travelInfoModalCloseTimerRef.current) {
      clearTimeout(travelInfoModalCloseTimerRef.current);
      travelInfoModalCloseTimerRef.current = null;
    }
    setTravelInfoActiveType(type);
    setTravelInfoModalOpen(true);
  }, []);

  const closeTravelInfoModal = useCallback(() => {
    setTravelInfoModalOpen(false);
    if (travelInfoModalCloseTimerRef.current) clearTimeout(travelInfoModalCloseTimerRef.current);
    travelInfoModalCloseTimerRef.current = setTimeout(() => {
      setTravelInfoActiveType(null);
      travelInfoModalCloseTimerRef.current = null;
    }, 280);
  }, []);

  const handleCreatePost = async (pickedFiles: ComposerPickedFile[] = []) => {
    const content = composerState.content;
    if (!activeBoard || posting || isBoardArchived || (!content.trim() && pickedFiles.length === 0)) return false;
    if (content.length > 5000) {
      toast.push({ type: 'error', title: 'Post', message: 'Treść posta nie może przekraczać 5000 znaków.' });
      return false;
    }

    setPosting(true);
    const controller = registerController();
    try {
      const attachments: BoardPostAttachment[] = await Promise.all(
        pickedFiles.slice(0, 8).map(async (entry) => {
          const mimeType = entry.file.type?.trim() || undefined;
          const dataUrl = await fileToDataUrl(entry.file);
          return {
            id: entry.id,
            name: entry.name,
            kind: entry.kind === 'image' || (mimeType ? mimeType.startsWith('image/') : false) ? 'image' : 'file',
            mimeType,
            dataUrl,
          };
        })
      );

      await createPost(activeBoard.groupId, activeBoard.id, {
        content,
        mentions: composerState.mentions,
        attachments,
      }, { signal: controller.signal });
      return true;
    } catch (error) {
      console.error('BoardDetailClient.handleCreatePost error', error);
      return false;
    } finally {
      releaseController(controller);
      setPosting(false);
    }
  };

  const jumpToBoardSection = useCallback((sectionId: string) => {
    if (typeof document === 'undefined') return;
    const element = document.getElementById(sectionId);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const updateNavOffset = () => {
      const grid = boardGridRef.current;
      if (!grid || typeof window === 'undefined') return;

      const rect = grid.getBoundingClientRect();
      const navWidth = quickNavRef.current?.offsetWidth ?? 36;
      const left = rect.left - navWidth - 12;
      setNavLeftOffset(Math.max(8, left));
    };

    updateNavOffset();
    window.addEventListener('resize', updateNavOffset);
    window.addEventListener('scroll', updateNavOffset, { passive: true });
    return () => {
      window.removeEventListener('resize', updateNavOffset);
      window.removeEventListener('scroll', updateNavOffset);
    };
  }, [activeBoard?.id]);

  useEffect(() => {
    if (!activeBoard || !canModerate || isBoardArchived) return;
    if (syncingTripDaysRef.current) return;

    const rangeKey = `${activeBoard.travelInfo.startDate ?? ''}|${activeBoard.travelInfo.endDate ?? ''}`;
    if (previousTravelRangeKeyRef.current === null) {
      previousTravelRangeKeyRef.current = rangeKey;
      return;
    }
    if (previousTravelRangeKeyRef.current === rangeKey) return;
    previousTravelRangeKeyRef.current = rangeKey;

    const rangeDays = buildTripDays(activeBoard.travelInfo.startDate, activeBoard.travelInfo.endDate);
    if (rangeDays.length === 0) return;

    const sortedDays = [...tripDays].sort((a, b) => a.dayNumber - b.dayNumber);
    if (sortedDays.length !== rangeDays.length) return;

    const mismatchedDayIds = sortedDays
      .map((day, index) => ({ day, targetDate: rangeDays[index]?.key ?? null }))
      .filter((entry) => entry.day.date !== entry.targetDate)
      .map((entry) => entry.day.id);

    if (mismatchedDayIds.length === 0) return;

    syncingTripDaysRef.current = true;

    (async () => {
      try {
        for (let index = 0; index < Math.min(sortedDays.length, rangeDays.length); index += 1) {
          const day = sortedDays[index];
          const targetDate = rangeDays[index]?.key ?? null;
          if (!day || day.date === targetDate) continue;
          await updateTripDay(activeBoard.groupId, activeBoard.id, day.id, {
            title: day.title ?? null,
            date: targetDate,
            location: day.location ?? null,
            description: day.description ?? null,
            accommodation: day.accommodation ?? null,
            estimatedBudget: day.estimatedBudget ?? null,
          });
        }
      } finally {
        syncingTripDaysRef.current = false;
      }
    })().catch((error) => {
      console.warn('Trip days sync failed', error);
    });
  }, [activeBoard, canModerate, isBoardArchived, tripDays, updateTripDay]);

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
    <div className="lg:pl-6 space-y-5 overflow-x-hidden">
      <div id="board-section-header" ref={headerSectionRef}>
      <BoardHeader
        boardName={activeBoard.boardName}
        groupName={activeBoard.groupName}
        boardAvatar={activeBoard.groupAvatarUrl}
        boardCreatedAt={activeBoard.createdAt}
        travelInfo={activeBoard.travelInfo}
        participants={participants}
        canInviteMembers={canEditBoard}
        onOpenInviteMembers={() => setInviteModalOpen(true)}
        canManageBoardMembers={canEditBoard}
        onOpenBoardMembersSettings={() => setMemberSettingsModalOpen(true)}
        canEdit={canEditInfo}
        onRenameBoard={handleRenameBoard}
        onUpdateMainInfo={handleUpdateMainInfo}
      />
      </div>

      {isBoardArchived && (
        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
          Tablica jest zarchiwizowana — dostęp tylko do odczytu.
        </div>
      )}

      <TravelInfoModal
        open={travelInfoModalOpen && !!travelInfoActiveType}
        activeType={travelInfoActiveType}
        groupId={groupId}
        boardId={boardId}
        details={activeBoard.travelInfo.details}
        canEdit={canEditInfo}
        onClose={closeTravelInfoModal}
        onAutoSave={handleAutoSaveTravelInfo}
      />

      <Modal open={inviteModalOpen && canEditBoard} onClose={() => setInviteModalOpen(false)} title={undefined} showCloseButton={true} panelClassName="max-w-[30rem]">
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

      <Modal open={memberSettingsModalOpen && canEditBoard} onClose={() => setMemberSettingsModalOpen(false)} title={undefined} showCloseButton={true}>
        <div className="p-6 max-w-2xl mx-auto overflow-hidden" style={{ overflow: 'hidden', maxHeight: '90vh' }}>
          <div className="mb-4 pb-4 border-b border-white/10">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
              <button
                type="button"
                className="app-icon-btn app-icon-btn-sm justify-self-start"
                onClick={() => {
                  void handleArchiveBoard();
                }}
                disabled={archivePending || isBoardArchived}
                title={archivePending ? 'Archiwizowanie…' : 'Archiwizuj tablicę'}
                aria-label={archivePending ? 'Archiwizowanie tablicy' : 'Archiwizuj tablicę'}
              >
                {archivePending ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArchiveBoxIcon className="h-4 w-4" />}
              </button>
              <div className="text-xl font-semibold text-white text-center">Ustawienia tablicy</div>
              <div aria-hidden="true" className="h-8 w-8 justify-self-end" />
            </div>
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
            <TravelInfoSidebar
              travelInfo={activeBoard.travelInfo}
            />
          </div>
        )}
      </div>


      <nav
        ref={quickNavRef}
        className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-40 flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md w-[48px]"
        style={{ left: `${navLeftOffset}px` }}
      >
        <button
          type="button"
          onClick={() => jumpToBoardSection('board-section-header')}
          className="rounded-lg px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
          title="Nagłówek"
        >
          H
        </button>
        <button
          type="button"
          onClick={() => jumpToBoardSection('board-section-compose')}
          className="rounded-lg px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
          title="Dodaj post"
        >
          P
        </button>
        <button
          type="button"
          onClick={() => jumpToBoardSection('board-section-timeline')}
          className="rounded-lg px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
          title="Timeline"
        >
          T
        </button>
        <button
          type="button"
          onClick={() => jumpToBoardSection('board-section-plan')}
          className="rounded-lg px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
          title="Plan podróży"
        >
          M
        </button>
      </nav>

      <div ref={boardGridRef} className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-5 items-start">
        <aside className="hidden lg:block lg:sticky lg:top-6 min-w-0">
          <Card className="dashboard-card min-h-0 h-auto justify-start rounded-2xl p-4 bg-white/[0.04] border-white/10">
            <h3 className="text-sm font-semibold text-white">Szczegóły podróży</h3>
            <div className="mt-3">
              <TravelInfoBar
                activeType={travelInfoActiveType}
                onSelect={(type) => {
                  openTravelInfoType(type);
                }}
              />
            </div>
          </Card>
        </aside>

        <div className="min-w-0 space-y-5">
            <div id="board-section-plan">
              <TripPlanSection
                tripDays={tripDays}
                loading={loadingTripDays}
                canEdit={canEditBoard}
                onUpdateDay={async (dayId, payload) => {
                  if (!activeBoard) return;
                  const currentDay = tripDays.find((day) => day.id === dayId);
                  await updateTripDay(activeBoard.groupId, activeBoard.id, dayId, {
                    title: payload.title !== undefined ? payload.title : (currentDay?.title ?? null),
                    date: payload.date !== undefined ? payload.date : (currentDay?.date ?? null),
                    location: payload.location !== undefined ? payload.location : (currentDay?.location ?? null),
                    description: payload.description !== undefined ? payload.description : (currentDay?.description ?? null),
                    accommodation: payload.accommodation !== undefined ? payload.accommodation : (currentDay?.accommodation ?? null),
                    estimatedBudget: payload.estimatedBudget !== undefined ? payload.estimatedBudget : (currentDay?.estimatedBudget ?? null),
                  });
                }}
                onReorder={async (orderedDayIds) => {
                  if (!activeBoard) return;
                  await reorderTripDays(activeBoard.groupId, activeBoard.id, orderedDayIds);
                }}
              />
            </div>

          <div id="board-section-timeline">
          <Card className="dashboard-card !min-h-0 !h-auto !max-h-none !overflow-visible !justify-start rounded-2xl p-5 md:p-6 bg-white/[0.04] border-white/10">
              <div id="board-section-compose" className="mb-4">
                {isBoardArchived ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
                    Publikowanie postów jest wyłączone dla zarchiwizowanej tablicy.
                  </div>
                ) : (
                  <AddPostCard
                    value={composerState.content}
                    posting={posting}
                    onChange={(next) => setComposerState({ content: next })}
                    onSubmit={handleCreatePost}
                    onEmoji={insertEmoji}
                    mentionCandidates={mentionCandidates}
                    mentions={composerState.mentions}
                    onMentionsChange={(next) => setComposerState({ mentions: next })}
                    charLimit={5000}
                  />
                )}
              </div>

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
                          readOnly={isBoardArchived}
                          currentUserId={currentUserId}
                          commentsOpen={Boolean(commentsOpen[post.id])}
                          commentDraft={commentDrafts[post.id] ?? ''}
                          commentSubmitting={Boolean(commentSubmitting[post.id])}
                          onToggleComments={() => setCommentsOpen((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                          onCommentDraft={(next) => setCommentDrafts((prev) => ({ ...prev, [post.id]: next }))}
                          onCreateComment={async () => {
                            if (isBoardArchived) return;
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
                            if (isBoardArchived) return;
                            void deleteComment(commentId);
                          }}
                          onDeletePost={() => {
                            if (isBoardArchived) return;
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

        </div>

        <aside className="hidden lg:block lg:sticky lg:top-6 min-w-0">
          <TravelInfoSidebar
            travelInfo={activeBoard.travelInfo}
          />
        </aside>
      </div>
    </div>
  );
}
