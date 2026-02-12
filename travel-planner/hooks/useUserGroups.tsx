"use client";

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '../lib/supabaseClient';

export type UserGroup = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_private: boolean;
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
        const supabase = getBrowserSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? null;
        if (!userId) {
          if (mounted) setGroups([]);
          return;
        }

        const { data, error } = await supabase
          .from('group_members')
          .select('role, groups(id, name, slug, description, is_private)')
          .eq('user_id', userId);

        if (error) throw error;

        const rows = (data ?? []) as Array<any>;
        const mapped: UserGroup[] = rows
          .map((r) => {
            const g = r.groups ?? {};
            if (!g || !g.id) return null;
            return {
              id: String(g.id),
              name: String(g.name ?? ''),
              slug: String(g.slug ?? ''),
              description: g.description ?? null,
              is_private: Boolean(g.is_private),
              role: r.role === 'admin' ? 'admin' : 'member',
            } as UserGroup;
          })
          .filter(Boolean) as UserGroup[];

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
