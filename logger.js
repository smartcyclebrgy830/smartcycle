const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';

// Use ONE global client
window._supabase = window._supabase || supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.logAction = async function(action, page = '') {
    try {
        const { data: { user } } = await window._supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await window._supabase
            .from('profiles')
            .select('id, name, type')
            .eq('auth_id', user.id)
            .single();

        if (error || !profile) return;

        await window._supabase.from('logs').insert({
            user_id: profile.id,
            user_name: profile.name,
            user_role: profile.type,
            action: action,
            page: page
        });

    } catch (err) {
        console.error('Log error:', err);
    }
}
