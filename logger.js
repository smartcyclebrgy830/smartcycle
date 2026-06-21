const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';

// Use ONE global 
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

        const isViewReceipt = action.includes('Viewed receipt');
        const isViewAction = action.includes('Viewed'); // Add this

        // Add this block to block 'Viewed' actions completely
        if (isViewAction) {
            console.log('⛔ Skipped (view action):', action);
            return;
        }
        
        // SESSION CONTROL (skip for receipts)
        if (!isViewReceipt) {
            const sessionKey = `visited_${profile.id}_${action}_${page}`;
            if (sessionStorage.getItem(sessionKey)) {
                console.log('⛔ Skipped (session):', action);
                return;
            }
            sessionStorage.setItem(sessionKey, 'true');
        }

        // 🔥 TIME-BASED COOLDOWN (30 seconds)
        const now = Date.now();
        const cooldownKey = `lastLog_${action}_${page}`;
        const lastTime = localStorage.getItem(cooldownKey);

        if (lastTime && (now - lastTime < 30000)) {
            console.log('⛔ Skipped (cooldown):', action);
            return;
        }

        localStorage.setItem(cooldownKey, now);

        // ✅ Insert log
        await window._supabase.from('logs').insert({
            user_id: profile.id,
            user_name: profile.name,
            user_role: profile.type,
            action: action,
            page: page
        });

        console.log('✅ Logged:', action);

    } catch (err) {
        console.error('❌ Log error:', err);
    }
};
