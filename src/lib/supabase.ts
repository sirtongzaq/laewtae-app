import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY);

/** ให้แน่ใจว่ามี session (anonymous) แล้วคืน user */
export async function ensureUser() {
	const { data } = await supabase.auth.getSession();
	if (data.session) return data.session.user;

	const { data: signedIn, error } = await supabase.auth.signInAnonymously();
	if (error || !signedIn.user) throw error ?? new Error('sign in failed');
	return signedIn.user;
}
