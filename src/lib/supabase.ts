import { createClient } from '@supabase/supabase-js';

// Le chiavi arrivano solo dalle variabili d'ambiente (.env.local o Vercel), mai dal codice.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configured = Boolean(url && key);
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing');
