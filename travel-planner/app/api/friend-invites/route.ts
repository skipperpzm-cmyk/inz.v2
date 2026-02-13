import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchPendingInvitesForUser, fetchPendingInvitesForUserWithBothSides, createInvite } from '@/src/db/repositories/friendInvites.repository';
import { getProfileByPublicId, getUserById } from 'src/db/repositories/user.repository';

export async function GET(req: Request) {
  // Support two modes:
  // 1) Authenticated: return invites for the current user (default)
  // 2) Public lookup (dev/tunnel): allow fetching invites for a known public_id
  try {
    const url = new URL(req.url);
    const publicId = url.searchParams.get('publicId');

    if (publicId) {
      // Allow public lookup by 8-digit publicId so tunneled recipients
      // can poll for invites when they cannot share cookies across domains.
      if (!/^\d{8}$/.test(publicId)) return NextResponse.json({ error: 'Invalid publicId' }, { status: 400 });
      const profile = await getProfileByPublicId(publicId);
      if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      const invites = await fetchPendingInvitesForUser(profile.id);
      return NextResponse.json(invites);
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    // Return pending invites where the current user is either the recipient or the sender
    const invites = await fetchPendingInvitesForUserWithBothSides(user.id);
    return NextResponse.json(invites);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await req.json();
    let toUserId = body?.toUserId;
    if (!toUserId) return NextResponse.json({ error: 'Missing toUserId' }, { status: 400 });

    // If caller passed an 8-digit public_id, resolve it to the real user id
    if (/^\d{8}$/.test(String(toUserId))) {
      try {
        const profile = await getProfileByPublicId(String(toUserId));
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        toUserId = profile.id;
      } catch (err) {
        console.error('Failed to resolve public id:', err);
        return NextResponse.json({ error: 'Failed to resolve public id' }, { status: 500 });
      }
    }

    if (toUserId === user.id) return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 });

    // ensure the target user exists
    try {
      const target = await getUserById(String(toUserId));
      if (!target) return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    } catch (err) {
      console.error('Failed to verify target user:', err);
      return NextResponse.json({ error: 'Failed to verify target user' }, { status: 500 });
    }

    const created = await createInvite(user.id, String(toUserId));
    return NextResponse.json(created);
  } catch (err: any) {
    console.error('API /api/friend-invites error:', err);
    return NextResponse.json({ error: err?.message ?? 'Failed to create invite' }, { status: 500 });
  }
}
