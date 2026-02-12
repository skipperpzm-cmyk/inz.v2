"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Button from '../ui/button';
import { useRouter } from 'next/navigation';
import { useToast } from '../../components/toast/ToastProvider';
import Modal from '../Modal';
import { profileHref } from '../../lib/profileUrl';

type Member = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  public_id?: string | null;
  role: 'member' | 'admin';
};

export default function GroupMembersList({ members: initialMembers, groupSlug, myUserId, myRole, isPrivate }: { members: Member[]; groupSlug: string; myUserId: string | null; myRole: string | null; isPrivate: boolean; }) {
  // myUserId may be null for unauthenticated viewers
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function handleLeave() {
    setLoadingId('me');
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupSlug)}/leave`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to leave group');

      // Remove self from UI immediately
      setMembers((m) => m.filter((x) => x.id !== myUserId));

      // If the group is private, redirect out because user should no longer see members
      if (isPrivate) {
        router.push('/dashboard/groups');
        return;
      }
      // success toast
      try { toast.push({ type: 'success', message: 'You left the group!' }); } catch (e) { /* ignore */ }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Failed to leave group.';
      try { toast.push({ type: 'error', message: msg }); } catch (e) { /* ignore */ }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Usuń tego członka z grupy?')) return;
    setLoadingId(userId);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupSlug)}/members/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to remove member');
      setMembers((m) => m.filter((x) => x.id !== userId));
      try { toast.push({ type: 'success', message: 'Member removed' }); } catch (er) { }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Failed to remove member';
      try { toast.push({ type: 'error', message: msg }); } catch (er) { }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleJoin() {
    // If user is not signed in, prompt to login instead of calling API
    if (!myUserId) {
      setShowLoginModal(true);
      return;
    }
    setLoadingId('join');
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupSlug)}/join`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to join group');
      const member = json.member;
      if (member) setMembers((m) => [...m, { id: member.id, username: member.username, full_name: member.full_name, avatar_url: member.avatar_url, role: member.role }]);
      try { toast.push({ type: 'success', message: 'You joined the group!' }); } catch (e) { /* ignore */ }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Failed to join group. Please try again.';
      try { toast.push({ type: 'error', message: msg }); } catch (e) { /* ignore */ }
    } finally {
      setLoadingId(null);
    }
  }

  const isMember = members.some((m) => m.id === myUserId);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  function validateEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function handleInvite(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validateEmail(inviteEmail)) {
      try { toast.push({ type: 'error', message: 'Invalid email' }); } catch (er) { }
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupSlug)}/members/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to invite member');
      const member = json.member;
      if (member) {
        setMembers((m) => [...m, { id: member.id, username: member.username, full_name: member.full_name, avatar_url: member.avatar_url, role: member.role }]);
        try { toast.push({ type: 'success', message: 'Member added to group' }); } catch (er) { }
        setInviteEmail('');
        setInviteModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Failed to invite member';
      try { toast.push({ type: 'error', message: msg }); } catch (er) { /* ignore */ }
    } finally {
      setInviteLoading(false);
    }
  }

  function onLoginNow() {
    setShowLoginModal(false);
    router.push('/login');
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">Członkowie</h2>
      <div className="mb-4 flex items-center justify-end gap-3">
        {myRole === 'admin' ? (
          <div>
            <Button onClick={() => setInviteModalOpen(true)} className="rounded-lg">Invite</Button>
          </div>
        ) : null}

        {/* Join CTA for non-members (hidden for existing members). Disabled for private groups. */}
        {!isMember ? (
          <div>
            <Button onClick={handleJoin} disabled={loadingId === 'join' || isPrivate} className="rounded-lg">
              {loadingId === 'join' ? '...' : (isPrivate ? 'Prywatna — brak dostępu' : 'Dołącz')}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Invite modal for admins */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} title="Invite to group">
        <div className="text-slate-300 mb-3">Enter the email address of the user you want to add to this group.</div>
        <form onSubmit={handleInvite} className="flex flex-col gap-3">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            aria-label="Email address"
            className="w-full px-3 py-2 rounded-lg bg-white/6 border border-white/10 text-white"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviteModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={inviteLoading}>{inviteLoading ? 'Sending…' : 'Send Invite'}</Button>
          </div>
        </form>
      </Modal>

        <Modal open={showLoginModal} onClose={() => setShowLoginModal(false)} title="Login required">
          <div className="text-slate-300">You need to be logged in to join this group.</div>
          <div className="mt-4 flex gap-3">
            <Button onClick={onLoginNow}>Login</Button>
            <Button variant="ghost" onClick={() => setShowLoginModal(false)}>Cancel</Button>
          </div>
        </Modal>

      <div className="grid gap-3">
        {members.map((m) => {
          const href = profileHref(m.public_id ?? m.id ?? null);
          const identity = (
            <>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white/6 flex items-center justify-center text-sm text-white">
                {m.avatar_url ? <img src={m.avatar_url} alt={m.username ?? m.full_name ?? 'U'} className="w-full h-full object-cover" /> : (m.username || m.full_name || 'U').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div className="text-white">{m.full_name ?? m.username ?? 'Użytkownik'}</div>
                <div className="text-xs text-slate-400">{m.username ? `@${m.username}` : ''}</div>
              </div>
            </>
          );
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 bg-white/4 rounded-lg p-3">
              {href ? (
                <Link href={href} className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 text-left">
                  {identity}
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  {identity}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-300 mr-2">{m.role}</div>
                {m.id === myUserId ? (
                  <Button variant="ghost" onClick={handleLeave} disabled={loadingId === 'me'}>{loadingId === 'me' ? '...' : 'Opuść'}</Button>
                ) : (myRole === 'admin' ? (
                  <Button variant="danger" onClick={() => handleRemove(m.id)} disabled={loadingId === m.id}>{loadingId === m.id ? '...' : 'Usuń'}</Button>
                ) : null)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
