import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY);

export async function ensureUser() {
	const { data } = await supabase.auth.getSession();
	if (!data.session) await supabase.auth.signInAnonymously();
}