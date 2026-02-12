import { cookies } from 'next/headers';
import { getUserById } from '../src/db/repositories/user.repository';
import { getUserIdByToken } from '../src/db/repositories/session.repository';

const SESSION_COOKIE = 'travel-planner-session';

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await getUserIdByToken(token);
  if (!userId) return null;
  return getUserById(userId);
}
