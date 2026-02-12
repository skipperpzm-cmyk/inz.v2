import { setOnlineStatus } from '@/src/db/repositories/profile.repository';
import { getCurrentUser } from '@/lib/auth';

export default async function LogoutPage() {
  const user = await getCurrentUser();
  if (user) {
    await setOnlineStatus(user.id, false);
  }
  // ...existing logout logic (clear session, redirect, etc.)
  return null;
}
