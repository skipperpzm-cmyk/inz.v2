"use client";

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '../lib/supabaseClient';
import type { Profile } from '../lib/getProfile';

type UseProfileResult = {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
};

export default function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = getBrowserSupabase();

    async function load() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const userId = user?.id ?? null;
        if (!userId) {
          if (mounted) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error) throw error;
        if (mounted) setProfile((data as Profile) ?? null);
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

  return { profile, loading, error };
}
