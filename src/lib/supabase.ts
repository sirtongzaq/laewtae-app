import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY);

/**
 * ให้แน่ใจว่ามี session (anonymous) ที่ใช้งานได้จริงแล้วคืน user
 * ถ้า session เก่าใช้ไม่ได้ (เช่น user ถูกลบโดย job ล้าง anonymous users) จะ sign in ใหม่ให้เอง
 */
export async function ensureUser() {
	const { data } = await supabase.auth.getSession();

	if (data.session) {
		const { data: checked, error } = await supabase.auth.getUser();
		if (checked.user && !error) return checked.user;
		await supabase.auth.signOut({ scope: 'local' });
	}

	const { data: signedIn, error } = await supabase.auth.signInAnonymously();
	if (error || !signedIn.user) throw error ?? new Error('sign in failed');
	return signedIn.user;
}
