import { setOnlineStatus } from '@/src/db/repositories/profile.repository';
import { getCurrentUser } from '@/lib/auth';

export default async function setOnlineAfterSignIn() {
  const user = await getCurrentUser();
  if (user) {
    await setOnlineStatus(user.id, true);
  }
}
