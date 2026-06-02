const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';
window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordError = document.getElementById('passwordError');
const confirmPasswordInput = document.getElementById('confirmPassword');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const submitButton = document.getElementById('submitBtn');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');

// 1. AUTO-DETECT INVITED USER ON PAGE LOAD
async function checkInvitedUser() {
    try {
        // Supabase parsing the hash fragments automatically authenticates the user locally
        const { data: { user }, error } = await window._supabase.auth.getUser();
        
        if (error || !user) {
            throw new Error("No active setup session found.");
        }
        
        // Show their email address inside the read-only box
        emailInput.value = user.email;
    } catch (err) {
        console.error(err.message);
        document.getElementById('errorDesc').innerText = "This invitation link is invalid or has already expired.";
        errorModal.showModal();
        submitButton.disabled = true;
    }
}

window.addEventListener('DOMContentLoaded', checkInvitedUser);

// 2. LIVE INPUT VALIDATION
passwordInput.addEventListener('input', function () {
    if (this.value.length >= 6) {
        this.classList.remove('invalid');
        this.classList.add('valid');
        passwordError.classList.remove('show');
    } else {
        this.classList.remove('valid');
        passwordError.classList.add('show');
    }
});

confirmPasswordInput.addEventListener('input', function () {
    if (this.value === passwordInput.value && this.value.length > 0) {
        this.classList.remove('invalid');
        this.classList.add('valid');
        confirmPasswordError.classList.remove('show');
    } else {
        this.classList.remove('valid');
        confirmPasswordError.classList.add('show');
    }
});

// 3. FLEXIBLE PASSWORD TOGGLE
function togglePassword(inputId, iconId, buttonId) {
    const input = document.getElementById(inputId);
    const toggleIcon = document.getElementById(iconId);
    const toggleButton = document.getElementById(buttonId);

    if (input.type === 'password') {
        input.type = 'text';
        toggleButton.setAttribute('aria-pressed', 'true');
        toggleButton.setAttribute('aria-label', 'Hide password');
        toggleIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    } else {
        input.type = 'password';
        toggleButton.setAttribute('aria-pressed', 'false');
        toggleButton.setAttribute('aria-label', 'Show password');
        toggleIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    }
}

document.getElementById('modalCloseBtn').addEventListener('click', () => errorModal.close());

// 4. SUBMIT AND SET PASSWORD
document.getElementById('setupForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    let isValid = true;

    if (password.length < 6) {
        passwordInput.classList.add('invalid');
        passwordError.classList.add('show');
        isValid = false;
    }

    if (password !== confirmPassword || confirmPassword.length === 0) {
        confirmPasswordInput.classList.add('invalid');
        confirmPasswordError.classList.add('show');
        isValid = false;
    }

    if (!isValid) return;

    submitButton.disabled = true;
    submitButton.classList.add('loading');

    try {
        // Updates the user's account password via the active invitation token
        const { data: updateData, error: updateError } = await window._supabase.auth.updateUser({
            password: password
        });

        if (updateError) throw updateError;

        // Fetch user profile properties to setup local storage routing data
        const { data: profileData, error: profileError } = await window._supabase
            .from('profiles')
            .select('type, display_id, name')
            .eq('id', updateData.user.id)
            .single();

        if (profileError) throw profileError;

        // Setup session tracking values
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userEmail', updateData.user.email);
        sessionStorage.setItem('userName', profileData.name);
        sessionStorage.setItem('userRole', profileData.type); 
        sessionStorage.setItem('userId', profileData.display_id); 

        successModal.showModal();

        setTimeout(() => {
            if (profileData.type === 'Super Admin') {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'admin_dashboard.html';
            }
        }, 2000);

    } catch (error) {
        console.error('Setup execution failed:', error.message);
        document.getElementById('errorDesc').innerText = error.message || "An unexpected error occurred.";
        errorModal.showModal();
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
    }
});
