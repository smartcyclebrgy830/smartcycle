const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// EMAIL VALIDATION

const emailInput = document.getElementById('email');
const emailError = document.getElementById('emailError');
const resetButton = document.querySelector('.reset-button');
const form = document.getElementById('forgotPasswordForm');
const successMessage = document.getElementById('successMessage');
const resendButton = document.getElementById('resendButton');

// Email regex pattern
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Real-time email validation on input
emailInput.addEventListener('input', function() {
    const email = this.value.trim();
    
    // Only validate if there's input
    if (email.length > 0) {
        if (emailPattern.test(email)) {
            // Valid email
            this.classList.remove('invalid');
            this.classList.add('valid');
            this.setAttribute('aria-invalid', 'false');
            emailError.classList.remove('show');
        } else {
            // Invalid email
            this.classList.remove('valid');
            this.classList.add('invalid');
            this.setAttribute('aria-invalid', 'true');
            emailError.classList.add('show');
        }
    } else {
        // Empty - reset to neutral
        this.classList.remove('valid', 'invalid');
        this.setAttribute('aria-invalid', 'false');
        emailError.classList.remove('show');
    }
});

// FORM SUBMISSION
form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();

    if (!emailPattern.test(email)) {
        emailInput.classList.add('invalid');
        emailError.classList.add('show');
        return;
    }

    resetButton.disabled = true;
    resetButton.textContent = "Sending...";

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "https://louisvillaflor.github.io/smartcycle/account_setup.html"
        });

        if (error) throw error;

        // Show success UI
        form.style.display = 'none';
        successMessage.classList.add('show');

        sessionStorage.setItem('resetEmail', email);

    } catch (err) {
        alert("Error: " + err.message);
    }

    resetButton.disabled = false;
    resetButton.textContent = "Send reset link";
});


// RESEND EMAIL FUNCTIONALITY
let resendCooldown = false;

resendButton.addEventListener('click', async function () {
    const email = sessionStorage.getItem('resetEmail');
    if (!email) return;

    this.disabled = true;
    this.textContent = "Sending...";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://louisvillaflor.github.io/smartcycle/account_setup.html"
    });

    if (error) {
        alert(error.message);
    } else {
        this.textContent = "Email sent!";
    }

    setTimeout(() => {
        this.textContent = "Resend Email";
        this.disabled = false;
    }, 2000);
});
