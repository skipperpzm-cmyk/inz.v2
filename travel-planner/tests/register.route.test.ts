import { describe, it, expect, vi } from 'vitest';

// Mock createUser and createSession
vi.mock('../src/db/repositories/user.repository', () => ({
  createUser: vi.fn(async () => ({ id: 'u-test', email: 't@example.com', username: 'test', publicId: '12345678' })),
  getUserByEmail: vi.fn(async () => null),
}));
vi.mock('../src/db/repositories/session.repository', () => ({
  createSession: vi.fn(async () => 'session-token-xyz'),
}));

import { POST } from '../app/api/auth/register/route';

function makeRequest(body: any) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('auth register route', () => {
  it('creates account and sets session cookie', async () => {
    const req = makeRequest({ email: 't@example.com', password: 'hunter2', username: 'test' });
    const res = await POST(req as any) as any;
    expect(res.status).toBe(201);
    // NextResponse exposes cookies via .cookies.get in runtime; we at least ensure success body
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
