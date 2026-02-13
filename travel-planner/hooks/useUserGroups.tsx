"use client";

import { useEffect, useState } from 'react';

export type UserGroup = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  is_private: boolean;
  memberCount: number;
  role: 'member' | 'admin';
};

export default function useUserGroups() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/groups/list', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch groups');
        const data = await res.json();
        const mapped: UserGroup[] = Array.isArray(data)
          ? data.map((g: any) => ({
              id: String(g.id),
              name: String(g.name ?? ''),
              slug: g.slug ?? null,
              description: g.description ?? null,
              is_private: Boolean(g.isPrivate ?? g.is_private),
              memberCount: Number(g.memberCount ?? g.member_count ?? 0),
              role: g.role === 'admin' ? 'admin' : 'member',
            }))
          : [];
        if (mounted) setGroups(mapped);
      } catch (err: any) {
        if (mounted) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return { groups, loading, error } as const;
}
