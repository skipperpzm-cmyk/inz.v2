import { cookies } from 'next/headers';
import { isConnectTimeoutError } from '@/lib/db-errors';
import { getUserById } from '../src/db/repositories/user.repository';
import { getUserIdByToken } from '../src/db/repositories/session.repository';

const SESSION_COOKIE = 'travel-planner-session';

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export type AuthResolutionReason = 'ok' | 'not-authenticated' | 'db-timeout';

export type CurrentUserIdResolution = {
  userId: string | null;
  reason: AuthResolutionReason;
};

export type CurrentUserResolution = {
  user: Awaited<ReturnType<typeof getUserById>> | null;
  reason: AuthResolutionReason;
};

export async function getCurrentUserIdWithReason(): Promise<CurrentUserIdResolution> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return { userId: null, reason: 'not-authenticated' };

    const userId = await getUserIdByToken(token);
    if (!userId) return { userId: null, reason: 'not-authenticated' };
    return { userId, reason: 'ok' };
  } catch (error: any) {
    if (isConnectTimeoutError(error)) {
      console.warn('Auth lookup timed out');
      return { userId: null, reason: 'db-timeout' };
    }
    throw error;
  }
}

export async function getCurrentUserId() {
  const result = await getCurrentUserIdWithReason();
  return result.userId;
}

export async function getCurrentUserWithReason(): Promise<CurrentUserResolution> {
  const userIdResult = await getCurrentUserIdWithReason();
  if (!userIdResult.userId) {
    return { user: null, reason: userIdResult.reason };
  }

  try {
    const user = await getUserById(userIdResult.userId);
    if (!user) return { user: null, reason: 'not-authenticated' };
    return { user, reason: 'ok' };
  } catch (error: any) {
    if (isConnectTimeoutError(error)) {
      console.warn('User profile lookup timed out');
      return { user: null, reason: 'db-timeout' };
    }
    throw error;
  }
}

export async function getCurrentUser() {
  const result = await getCurrentUserWithReason();
  return result.user;
}
