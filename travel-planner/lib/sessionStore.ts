// Deprecated compatibility shim.
// Prefer importing session helpers directly from `src/db/repositories/session.repository`.
// This file remains to avoid breaking older imports but will be removed in a future release.

import {
  createSession as createSessionRecord,
  deleteSessionByToken,
  getUserIdByToken,
} from '../src/db/repositories/session.repository';

export async function createSession(userId: string) {
  console.warn('[DEPRECATED] lib/sessionStore.createSession is deprecated. Import from src/db/repositories/session.repository instead.');
  return createSessionRecord(userId);
}

export async function getUserId(token: string) {
  console.warn('[DEPRECATED] lib/sessionStore.getUserId is deprecated. Import getUserIdByToken from src/db/repositories/session.repository instead.');
  return getUserIdByToken(token);
}

export async function deleteSession(token: string) {
  console.warn('[DEPRECATED] lib/sessionStore.deleteSession is deprecated. Import deleteSessionByToken from src/db/repositories/session.repository instead.');
  return deleteSessionByToken(token);
}

export default {
  createSession,
  getUserId,
  deleteSession,
};
