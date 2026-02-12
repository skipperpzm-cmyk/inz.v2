"use client";
import React, { useEffect, useRef, useState } from 'react';
import Card from '../Card';
import Button from '../ui/button';
import CopyPublicIdButton from '../CopyPublicIdButton';
import { useToast } from '../toast/ToastProvider';

export default function ProfileSettingsClient() {
  // (copy functionality removed) public ID remains as read-only text


  const toast = useToast();
  const defaultBackground = '/backgrounds/background_user_1.svg';

  const [pseudonim, setPseudonim] = useState('Przykładowy użytkownik');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [publicId, setPublicId] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedDefault, setSelectedDefault] = useState<string | null>(null);
  const [pseudonimError, setPseudonimError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savingPseudonim, setSavingPseudonim] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const storedBackgroundApplied = useRef(false);
  const copiedTimer = useRef<number | null>(null);
  const [copiedPublicId, setCopiedPublicId] = useState(false);

  const preloadedAvatars = Array.from({ length: 12 }, (_, i) => `/avatars/avatar_animals/avatar_animal_${i + 1}.png`);

  const [backgrounds, setBackgrounds] = useState<string[]>([defaultBackground]);
  // `selectedBackground` is the preview selection (undefined = no selection made yet)
  const [selectedBackground, setSelectedBackground] = useState<string | undefined>(undefined);
  const [previewCleared, setPreviewCleared] = useState(false);

  async function handlePseudonimSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPseudonimError(null);
    setSavingPseudonim(true);
    try {
      // Client-side validation: allow letters, digits, underscore, dot and hyphen; preserve case
      const usernameTrim = pseudonim.trim();
      if (!usernameTrim) throw new Error('Wprowadź nazwę');
      if (usernameTrim.length < 3) throw new Error('Nazwa jest za krótka (min 3 znaki)');
      if (usernameTrim.length > 64) throw new Error('Nazwa jest za długa (max 64 znaki)');
      if (!/^[A-Za-z0-9_.-]+$/.test(usernameTrim)) throw new Error('Nieprawidłowy format nazwy');

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: usernameTrim }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('Not authenticated');
      if (res.status === 409) throw new Error('Username already taken');
      if (!res.ok || json.error) throw new Error(json.error || 'Nie udało się zapisać pseudonimu');
      const updated = (json.profile && json.profile.username) ?? json.username ?? pseudonim;
      setPseudonim(updated);
      toast.push({ type: 'success', message: 'Pseudonim zapisany' });
      try { window.dispatchEvent(new CustomEvent('pseudonim-updated', { detail: updated })); } catch (err) { /* ignore */ }
    } catch (err) {
      // Translate common server error to user-friendly message
      const msg = err instanceof Error ? err.message : 'Nie udało się zapisać pseudonimu';
      if (msg === 'Not authenticated') setPseudonimError('Nie jesteś zalogowany');
      else if (msg.includes('Username already taken') || msg.includes('already taken')) setPseudonimError('Nazwa jest już zajęta');
      else setPseudonimError(msg);
    } finally {
      setSavingPseudonim(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/me', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        setPseudonim(json.username ?? '');
        setAvatarUrl(json.avatarUrl ?? '');
        setPublicId((json.publicId ?? json.public_id) ?? null);
        if (!storedBackgroundApplied.current) setBackgroundUrl(json.backgroundUrl ?? null);
        if (json.avatarUrl && preloadedAvatars.includes(json.avatarUrl)) {
          setSelectedDefault(json.avatarUrl);
          setPreviewUrl(json.avatarUrl);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Listen for external updates to the public id (keeps UI in sync if changed elsewhere)
  // Note: copying is handled by the copy button (and optional ClipboardJS). External updates still update the displayed value.

  // copy-to-clipboard functionality removed; no external clipboard scripts loaded
  useEffect(() => {
    function onPublicIdUpdate(e: any) {
      try {
        const next = e?.detail ?? null;
        setPublicId(next);
      } catch (err) {
        // ignore
      }
    }
    window.addEventListener('public-id-updated', onPublicIdUpdate as EventListener);
    return () => window.removeEventListener('public-id-updated', onPublicIdUpdate as EventListener);
  }, []);

  // copy handler for the public ID (used by inline button)
  async function handleCopyPublicId() {
    if (!publicId) return;
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicId);
        ok = true;
      }
    } catch (err) {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = publicId;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {
        ok = false;
      }
    }

    if (ok) {
      setCopiedPublicId(true);
      if (copiedTimer.current) { window.clearTimeout(copiedTimer.current); copiedTimer.current = null; }
      copiedTimer.current = window.setTimeout(() => { setCopiedPublicId(false); copiedTimer.current = null; }, 2000) as unknown as number;
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/backgrounds');
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json) && json.length) {
          const merged = Array.from(new Set([defaultBackground, ...json]));
          setBackgrounds(merged);
        } else setBackgrounds([defaultBackground]);
      } catch (e) {
        setBackgrounds([defaultBackground]);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tp_background');
      storedBackgroundApplied.current = true;
      if (stored) setBackgroundUrl(stored); else setBackgroundUrl(null);
    } catch (err) {
      storedBackgroundApplied.current = true;
      setBackgroundUrl(null);
    }
  }, [defaultBackground]);

  function openFilePicker() { inputRef.current?.click(); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAvatarError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Wybierz plik graficzny'); return; }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) { setAvatarError('Obraz jest za duży (maks. 2 MB)'); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setAvatarError(null);
    const input = inputRef.current;
    if (selectedDefault) {
      setUploading(true);
      try {
        const res = await fetch('/api/user/avatar/default', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ path: selectedDefault }) });
        const json = await res.json();
        if (!res.ok || json?.error) throw new Error(json?.error || 'Nie udało się zapisać awatara');
        setAvatarUrl(json.avatarUrl);
        window.dispatchEvent(new CustomEvent('avatar-updated', { detail: json.avatarUrl }));
        toast.push({ type: 'success', message: 'Awatar zapisany' });
        if (input) input.value = '';
        setPreviewUrl(null);
        setSelectedDefault(null);
      } catch (err) {
        setAvatarError(err instanceof Error ? err.message : 'Nie udało się zapisać awatara');
      } finally {
        setUploading(false);
      }
      return;
    }
    toast.push({ type: 'error', message: 'Brak wybranego awatara do zapisania' });
  }

  // Restore default animated background and persist the choice (clear server + localStorage)
  async function handleRestoreBackground() {
    try {
      // clear localStorage
      try { localStorage.removeItem('tp_background'); } catch (e) { /* ignore */ }

      // persist to server
      const res = await fetch('/api/user/background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ backgroundUrl: null }) });
      if (!res.ok) throw new Error('Server rejected restore');

      // update local UI state
      setSelectedBackground(undefined);
      setPreviewCleared(false);
      setBackgroundUrl(null);
      try { window.dispatchEvent(new CustomEvent('background-updated', { detail: null })); } catch (e) { /* ignore */ }
      toast.push({ type: 'success', message: 'Przywrócono domyślne tło' });
    } catch (err) {
      toast.push({ type: 'error', message: 'Nie udało się przywrócić tła' });
    }
  }

  async function handleSaveBackground() {
    // Determine target to persist: selected preview -> string, previewCleared -> null, otherwise keep current persisted value
    let target: string | null;
    if (selectedBackground !== undefined) target = selectedBackground;
    else if (previewCleared) target = null;
    else target = backgroundUrl ?? defaultBackground;

    if (typeof target === 'string' && !backgrounds.includes(target)) { toast.push({ type: 'error', message: 'Nieprawidłowe tło' }); return; }

    try {
      try {
        if (target === null) localStorage.removeItem('tp_background'); else localStorage.setItem('tp_background', target);
      } catch (e) { }

      setBackgroundUrl(target);
      try { window.dispatchEvent(new CustomEvent('background-updated', { detail: target })); } catch (e) { }
      try { await fetch('/api/user/background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ backgroundUrl: target }) }); } catch (e) { /* tolerate */ }
      toast.push({ type: 'success', message: 'Tło zapisane' });
      setSelectedBackground(undefined);
      setPreviewCleared(false);
    } catch (err) {
      toast.push({ type: 'error', message: err instanceof Error ? err.message : 'Nie udało się zapisać tła' });
    }
  }

  // Selection is preview-only; call `handleSaveBackground` to persist
  function selectBackground(next: string) {
    setSelectedBackground(next);
    setPreviewCleared(false);
  }

  const currentPreview = selectedBackground !== undefined ? selectedBackground : (previewCleared ? null : backgroundUrl);

  // Compute input width accounting for monospace ch units plus horizontal padding.
  // Use two variants: `inputWidthNoIcon` for when icon sits outside the input, and `inputWidth` kept for legacy usage.
  const publicIdStr = String(publicId ?? '—');
  const inputWidthNoIcon = `calc(${Math.max(1, publicIdStr.length)}ch + 1.25rem + 2px)`; // 1.25rem = 2 * 0.625rem padding, +2px border
  // Reserve extra space for separator + button so they don't wrap to next line
  const inputWidth = `calc(${Math.max(1, publicIdStr.length)}ch + 6.125rem + 2px)`; // increased reserve (was 3.125rem)

  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold mb-3">Ustawienia profilu</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 lg:grid-rows-2 gap-4 auto-rows-min">
        <Card className="dashboard-card rounded-2xl p-4 col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-1 lg:row-span-1 lg:col-start-1 lg:row-start-1 overflow-hidden justify-start">
          <div className="flex flex-col h-full gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Pseudonim</h2>
              <p className="text-sm text-white">Dopasuj nazwę widoczną w panelu.</p>
            </div>

            <div className="mt-4 flex flex-col flex-1 justify-between gap-4">
              <div>
                <form onSubmit={handlePseudonimSubmit} className="flex items-center gap-3">
                  <input value={pseudonim} onChange={(e) => setPseudonim(e.target.value)} placeholder="np. Mistrz podróży" className="flex-1 px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40" />
                  <Button type="submit" disabled={savingPseudonim} className="whitespace-nowrap">{savingPseudonim ? 'Zapisywanie…' : 'Zapisz'}</Button>
                </form>

                {pseudonimError && (
                  <p className="text-sm text-red-400 mt-2" role="alert" aria-live="assertive">{pseudonimError}</p>
                )}

                {/* Public ID (non-editable) - always shown under the error message (or under input if no error) */}
                <div className="mt-1" aria-live="polite" aria-atomic="true">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-white/60 whitespace-nowrap">ID publiczny:</p>
                    <div className="flex items-center gap-3">
                      <div
                        role="textbox"
                        aria-readonly="true"
                        tabIndex={0}
                        className="col-span-6 inline-grid items-center rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 font-mono"
                        style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}
                      >
                        <div className="truncate min-w-0">{publicId ?? '—'}</div>

                        <div className="h-5 w-px bg-gray-200 dark:bg-gray-600 mx-2" aria-hidden />

                        <button
                          type="button"
                          onClick={handleCopyPublicId}
                          aria-label="Kopiuj ID do schowka"
                          className={`inline-flex items-center justify-center rounded-md border border-transparent px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${copiedPublicId ? 'bg-white text-blue-700 dark:bg-gray-800 dark:text-blue-500' : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'}`}
                        >
                          <span className={copiedPublicId ? 'hidden' : 'inline-flex'} id="default-icon-public-id">
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" className="w-4 h-4" aria-hidden>
                              <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
                            </svg>
                          </span>
                          <span className={copiedPublicId ? 'inline-flex' : 'hidden'} id="success-icon-public-id">
                            <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="9" className="text-green-600" stroke="currentColor" />
                              <path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>
                      </div>

                      <div className="sr-only" aria-live="polite" role="status">{copiedPublicId ? `Skopiowano ${publicId}` : ''}</div>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 mt-1 italic">Udostępnij to ID znajomym, aby mogli szybko znaleźć Twój profil!</p>
                </div>
              </div>

              {/* Avatar area pinned to bottom of the card to fill space evenly */}
              <div className="mt-6 border-t border-white/6 pt-6">
                <h2 className="text-lg font-semibold text-white mb-3">Awatar</h2>
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-none">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openFilePicker}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openFilePicker(); }}
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-white/6 relative flex items-center justify-center ${!previewUrl && !avatarUrl ? 'border-2 border-dashed border-white/20' : 'border border-white/6'}`}
                      aria-label="Podgląd awataru — kliknij, aby wybrać plik"
                    >
                      <div className="absolute inset-0 rounded-full overflow-hidden">
                        {previewUrl ? (
                          <img src={previewUrl} alt="Podgląd awataru" className="w-full h-full object-cover" />
                        ) : avatarUrl ? (
                          <img src={avatarUrl} alt="Awatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><span className="text-sm text-white">Brak obrazu</span></div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <div className="flex flex-wrap gap-3 mb-3">
                      <Button type="button" onClick={openFilePicker} className="w-36">Wybierz z pliku</Button>
                      <Button type="button" onClick={handleSave} className="w-36">Zapisz</Button>
                    </div>
                    {avatarError && <p className="text-sm text-red-400">{avatarError}</p>}

                    <p className="text-sm text-white mt-3 mb-2">Domyślne avatary</p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {preloadedAvatars.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => { setSelectedDefault(f); setPreviewUrl(f); setAvatarError(null); }}
                          className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center focus:outline-none ring-0 bg-white/10 transition-colors duration-200 ease-in-out shadow-sm ${selectedDefault === f ? 'ring-2 ring-white/30' : ''}`}
                          aria-pressed={selectedDefault === f}
                        >
                          <img src={f} alt={f} className="w-full h-full object-cover rounded-full" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="dashboard-card rounded-2xl p-4 col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-1 overflow-hidden justify-start">
          <div className="flex flex-col h-full">
            <div>
              <h2 className="text-lg font-semibold text-white">Zmień tło</h2>
              <p className="text-sm text-white">Wybierz tło aplikacji spośród gotowych obrazów.</p>
            </div>

            <div className="mt-6 flex flex-col flex-1">
              <div className={`w-full rounded-3xl overflow-hidden bg-white/4 relative h-28 md:h-32 ${!currentPreview ? 'border-2 border-dashed border-white/20' : 'border border-white/6'}`} aria-hidden>
                {currentPreview ? (
                  (() => {
                    const isVideo = currentPreview.toLowerCase().endsWith('.mp4');
                    if (isVideo) {
                      return (
                        <video src={currentPreview} className="w-full h-full object-cover block rounded-3xl" autoPlay muted loop playsInline onLoadedMetadata={(e) => { try { (e.currentTarget as HTMLVideoElement).playbackRate = 0.5; } catch (err) { } }} />
                      );
                    }
                    return (
                      <div className="absolute inset-0 rounded-3xl overflow-hidden">
                        <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${currentPreview})` }} />
                        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} />
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-11/12 h-5/6 rounded-3xl flex items-center justify-center relative">
                      <span className="text-sm text-white">Nie wybrano tła</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <p className="text-sm text-white mt-4 mb-2">Dostępne tła</p>
                <div className="flex gap-3 overflow-x-auto py-2">
                  {backgrounds.map((v) => {
                    const currentPreview = selectedBackground !== undefined ? selectedBackground : (previewCleared ? null : backgroundUrl);
                    const isPreviewSelected = currentPreview === v; // which preview is chosen (preview-only)
                    const isVideo = v.toLowerCase().endsWith('.mp4');
                      return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => selectBackground(v)}
                        className={`min-w-[9rem] h-28 rounded-lg overflow-hidden flex-shrink-0 focus:outline-none bg-white/6 transition-colors duration-200 ease-in-out shadow-sm ${isPreviewSelected ? 'ring-2 ring-white/30' : ''}`} 
                      >
                        {isVideo ? (
                          <video
                            src={v}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                            playsInline
                            onLoadedMetadata={(e) => { try { (e.currentTarget as HTMLVideoElement).playbackRate = 0.5; } catch (err) { /* ignore */ } }}
                          />
                        ) : (
                          <img src={v} alt={v} className="w-full h-full object-cover" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex gap-3 items-center">
                  <Button type="button" onClick={handleSaveBackground} className="w-32">Zapisz</Button>
                  <Button type="button" variant="ghost" onClick={handleRestoreBackground} className="w-32">Przywróć</Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
