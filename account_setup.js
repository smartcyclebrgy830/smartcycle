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
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{6,30}$/;

// 1. LISTEN FOR AUTH STATE INITIALIZATION (Fixes the "Loading email..." race condition)
window._supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        // Token processed successfully, display the email
        emailInput.value = session.user.email;
        submitButton.disabled = false;
    } else {
        // If initial evaluation finishes and there is no session, the link is invalid/expired
        if (event === 'INITIAL_SESSION') {
            document.getElementById('errorDesc').innerText = "This invitation link is invalid or has already expired.";
            errorModal.showModal();
            submitButton.disabled = true;
            emailInput.value = "Session expired";
        }
    }
});

// 2. LIVE INPUT VALIDATION
passwordInput.addEventListener('input', function () {
    const password = this.value;

    if (password.length > 0) {
        if (passwordPattern.test(password)) {
            this.classList.remove('invalid');
            this.classList.add('valid');
            this.setAttribute('aria-invalid', 'false');
            passwordError.classList.remove('show');
        } else {
            this.classList.remove('valid');
            this.classList.add('invalid');
            this.setAttribute('aria-invalid', 'true');

            passwordError.textContent =
                "6–30 chars, include uppercase, lowercase, number, and special character";
            passwordError.classList.add('show');
        }
    } else {
        this.classList.remove('valid', 'invalid');
        this.setAttribute('aria-invalid', 'false');
        passwordError.classList.remove('show');
    }
});

confirmPasswordInput.addEventListener('input', function () {
    const confirmPassword = this.value;

    if (confirmPassword.length > 0) {
        if (confirmPassword === passwordInput.value) {
            this.classList.remove('invalid');
            this.classList.add('valid');
            this.setAttribute('aria-invalid', 'false');
            confirmPasswordError.classList.remove('show');
        } else {
            this.classList.remove('valid');
            this.classList.add('invalid');
            this.setAttribute('aria-invalid', 'true');

            confirmPasswordError.textContent = "Passwords do not match";
            confirmPasswordError.classList.add('show');
        }
    } else {
        this.classList.remove('valid', 'invalid');
        this.setAttribute('aria-invalid', 'false');
        confirmPasswordError.classList.remove('show');
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

    if (!passwordPattern.test(password)) {
        passwordInput.classList.add('invalid');
        passwordInput.classList.remove('valid');
        passwordInput.setAttribute('aria-invalid', 'true');
    
        passwordError.textContent =
            "Password must be 6–30 chars and include uppercase, lowercase, number, and special character";
        passwordError.classList.add('show');
    
        isValid = false;
    }
    
    if (password !== confirmPassword || confirmPassword.length === 0) {
        confirmPasswordInput.classList.add('invalid');
        confirmPasswordInput.setAttribute('aria-invalid', 'true');
    
        confirmPasswordError.textContent = "Passwords do not match";
        confirmPasswordError.classList.add('show');
    
        isValid = false;
    }

    if (!isValid) return;

    submitButton.disabled = true;
    submitButton.classList.add('loading');

    try {
        // Finalize credentials via active invite token link
        const { data: updateData, error: updateError } = await window._supabase.auth.updateUser({
            password: password
        });

        if (updateError) throw updateError;

        // FIX: Changed target column parameter from 'id' to 'auth_id' to match your schema
        const { data: profileData, error: profileError } = await window._supabase
            .from('profiles')
            .select('type, display_id, name')
            .eq('auth_id', updateData.user.id) 
            .single();

        if (profileError) throw profileError;

        // Store active browser session data
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
                window.location.href = 'dashboard.html';
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
