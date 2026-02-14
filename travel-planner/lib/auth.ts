import { cookies } from 'next/headers';
import { isConnectTimeoutError } from '@/lib/db-errors';
import { getUserById } from '../src/db/repositories/user.repository';
import { getUserIdByToken } from '../src/db/repositories/session.repository';

const SESSION_COOKIE = 'travel-planner-session';

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export async function getCurrentUserId() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return getUserIdByToken(token);
  } catch (error: any) {
    if (isConnectTimeoutError(error)) {
      console.warn('Auth lookup timed out');
      return null;
    }
    throw error;
  }
}

export async function getCurrentUser() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    return await getUserById(userId);
  } catch (error: any) {
    if (isConnectTimeoutError(error)) {
      console.warn('User profile lookup timed out');
      return null;
    }
    throw error;
  }
}
