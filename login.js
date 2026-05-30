const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';
window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const emailInput = document.getElementById('email');
const emailError = document.getElementById('emailError');
const passwordInput = document.getElementById('password');
const passwordError = document.getElementById('passwordError');
const loginButton = document.querySelector('.login-button');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// EMAIL VALIDATION
emailInput.addEventListener('input', function () {
    const email = this.value.trim();

    if (email.length > 0) {
        if (emailPattern.test(email)) {
            this.classList.remove('invalid');
            this.classList.add('valid');
            this.setAttribute('aria-invalid', 'false');
            emailError.classList.remove('show');
        } else {
            this.classList.remove('valid');
            this.classList.add('invalid');
            this.setAttribute('aria-invalid', 'true');
            emailError.classList.add('show');
        }
    } else {
        this.classList.remove('valid', 'invalid');
        this.setAttribute('aria-invalid', 'false');
        emailError.classList.remove('show');
    }
});

// PASSWORD VALIDATION
passwordInput.addEventListener('input', function () {
    if (this.value.length > 0) {
        this.classList.remove('invalid');
        this.classList.add('valid');
        this.setAttribute('aria-invalid', 'false');
        passwordError.classList.remove('show');
    } else {
        this.classList.remove('valid', 'invalid');
        this.setAttribute('aria-invalid', 'false');
        passwordError.classList.remove('show');
    }
});

// PASSWORD TOGGLE
function togglePassword() {
    const toggleIcon = document.getElementById('toggleIcon');
    const toggleButton = document.getElementById('toggleButton');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.setAttribute('aria-pressed', 'true');
        toggleButton.setAttribute('aria-label', 'Hide password');
        toggleIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    } else {
        passwordInput.type = 'password';
        toggleButton.setAttribute('aria-pressed', 'false');
        toggleButton.setAttribute('aria-label', 'Show password');
        toggleIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    }
}


// MODAL CONTROLS
function closeModal(modal) {
    modal.close();
}

document.getElementById('modalCloseBtn').addEventListener('click', function () {
    closeModal(errorModal);
});


// FORM SUBMISSION
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let isValid = true;

    if (!emailPattern.test(email)) {
        emailInput.classList.add('invalid');
        emailInput.classList.remove('valid');
        emailInput.setAttribute('aria-invalid', 'true');
        emailError.classList.add('show');
        emailInput.focus();
        isValid = false;
    } else {
        emailInput.classList.remove('invalid');
        emailInput.classList.add('valid');
        emailInput.setAttribute('aria-invalid', 'false');
        emailError.classList.remove('show');
    }

    if (password.length === 0) {
        passwordInput.classList.add('invalid');
        passwordInput.classList.remove('valid');
        passwordInput.setAttribute('aria-invalid', 'true');
        passwordError.classList.add('show');
        if (emailPattern.test(email)) passwordInput.focus();
        isValid = false;
    } else {
        passwordInput.classList.remove('invalid');
        passwordInput.classList.add('valid');
        passwordInput.setAttribute('aria-invalid', 'false');
        passwordError.classList.remove('show');
    }

    if (!isValid) return;

    // Ensure you have initialized your Supabase client at the top of your file
    // const supabase = supabase.createClient('YOUR_URL', 'YOUR_ANON_KEY');
    
    loginButton.disabled = true;
    loginButton.classList.add('loading');
    
    try {
        // 1. Authenticate the email and password with Supabase
        const { data, error } = await window._supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
    
        if (error) throw error;
    
        // 2. Fetch the user's role from your profiles table
        const { data: profileData, error: profileError } = await window._supabase
            .from('profiles')
            .select('type, display_id, name')
            .eq('id', data.user.id)
            .single();
    
        if (profileError) throw profileError;
    
        // 3. Store session data and route based on role
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userEmail', email);
        sessionStorage.setItem('userName', profileData.name);
        sessionStorage.setItem('userRole', profileData.type); 
        sessionStorage.setItem('userId', profileData.display_id); 
    
        successModal.showModal();
    
        setTimeout(() => {
            // You can route differently based on the role
            if (profileData.type === 'Super Admin') {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'admin_dashboard.html';
            }
        }, 2000);
    
    } catch (error) {
        console.error('Login error:', error.message);
        errorModal.showModal();
    } finally {
        loginButton.disabled = false;
        loginButton.classList.remove('loading');
    }
});
