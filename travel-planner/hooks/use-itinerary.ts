import { useEffect, useState } from 'react';

// Placeholder hook: avoid importing Supabase client in this skeleton.
// TODO: replace with real data fetching via server actions or repository.
type Itinerary = {
  id: string;
  destination?: string;
  date?: string;
  notes?: string;
};

const useItinerary = () => {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: fetch from server/repository; currently using empty placeholder
    setItineraries([]);
  }, []);

  return { itineraries, loading, error };
};

export default useItinerary;