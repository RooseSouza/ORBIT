import { createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/static/js/firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('createAccountBtn');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const emailErrorEl = document.getElementById('emailError');
    const passwordErrorEl = document.getElementById('passwordError');
    const confirmPasswordErrorEl = document.getElementById('confirmPasswordError');
    const loadingBar = document.getElementById('loadingBar');
    const loadingFill = document.querySelector('.loading-fill');
    const preloader = document.getElementById('app-preloader');
    const loginStatus = document.getElementById('loginStatus');

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const UPPERCASE_REGEX = /[A-Z]/;
    const LOWERCASE_REGEX = /[a-z]/;
    const NUMBER_REGEX = /\d/;
    const SPECIAL_REGEX = /[^A-Za-z0-9]/;

    function setStatus(message, type = 'info') {
        if (!loginStatus) return;
        loginStatus.textContent = message || '';
        loginStatus.className = `login-status ${type}`;
    }

    function setFieldError(inputEl, errorEl, message) {
        if (errorEl) {
            errorEl.textContent = message || '';
            errorEl.classList.toggle('show', !!message);
        }
        if (inputEl) inputEl.classList.toggle('input-error', !!message);
    }

    function clearFieldErrors() {
        setFieldError(emailInput, emailErrorEl, '');
        setFieldError(passwordInput, passwordErrorEl, '');
        setFieldError(confirmPasswordInput, confirmPasswordErrorEl, '');
    }

    function validateEmail(email) {
        if (!email) return 'Please enter your email address.';
        if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email address.';
        if (email.length > 254) return 'Email is too long.';
        return null;
    }

    function validateRegisterPassword(password) {
        if (!password) return 'Please enter a password.';
        if (password.length < 8) return 'Password must be at least 8 characters.';
        if (password.length > 128) return 'Password is too long.';
        if (/\s/.test(password)) return 'Password cannot contain spaces.';
        if (!UPPERCASE_REGEX.test(password)) return 'Password must include at least one uppercase letter.';
        if (!LOWERCASE_REGEX.test(password)) return 'Password must include at least one lowercase letter.';
        if (!NUMBER_REGEX.test(password)) return 'Password must include at least one number.';
        if (!SPECIAL_REGEX.test(password)) return 'Password must include at least one special character.';
        return null;
    }

    function startProgress() {
        if (!loadingBar || !loadingFill) return;
        loadingBar.style.display = 'block';
        loadingFill.style.transition = 'width 0.45s ease';
        loadingFill.style.width = '35%';
    }

    function finishProgress() {
        if (!loadingBar || !loadingFill) return;
        loadingFill.style.width = '100%';
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = '/home';
            return;
        }

        if (preloader) preloader.classList.add('hide');
        requestAnimationFrame(() => {
            document.body.classList.add('login-ready');
        });
    });

    if (!createBtn) return;

    createBtn.addEventListener('click', async () => {
        clearFieldErrors();
        const email = (emailInput?.value || '').trim().toLowerCase();
        const password = passwordInput?.value || '';
        const confirmPassword = confirmPasswordInput?.value || '';

        const emailError = validateEmail(email);
        if (emailError) {
            setFieldError(emailInput, emailErrorEl, emailError);
            return;
        }

        const passwordError = validateRegisterPassword(password);
        if (passwordError) {
            setFieldError(passwordInput, passwordErrorEl, passwordError);
            return;
        }

        if (!confirmPassword) {
            setFieldError(confirmPasswordInput, confirmPasswordErrorEl, 'Please confirm your password.');
            return;
        }

        if (password !== confirmPassword) {
            setFieldError(confirmPasswordInput, confirmPasswordErrorEl, 'Passwords do not match.');
            return;
        }

        setStatus('', 'info');

        createBtn.disabled = true;
        setStatus('Creating your account...', 'info');
        startProgress();

        try {
            localStorage.removeItem('isOrbitGuest');
            localStorage.removeItem('googleCalendarToken');
            await createUserWithEmailAndPassword(auth, email, password);
            setStatus('Account created. Redirecting...', 'success');
            finishProgress();
            setTimeout(() => {
                document.body.classList.add('logged-in');
            }, 100);
            setTimeout(() => {
                window.location.href = '/home';
            }, 900);
        } catch (error) {
            createBtn.disabled = false;
            if (loadingFill) loadingFill.style.width = '0%';
            if (loadingBar) loadingBar.style.display = 'none';
            if (error && error.code === 'auth/operation-not-allowed') {
                setStatus('Create account is currently disabled. Admin must enable Email/Password in Firebase Auth > Sign-in method.', 'error');
            } else if (error && error.code === 'auth/email-already-in-use') {
                setFieldError(emailInput, emailErrorEl, 'That email is already registered.');
            } else if (error && error.code === 'auth/invalid-email') {
                setFieldError(emailInput, emailErrorEl, 'Please enter a valid email address.');
            } else if (error && error.code === 'auth/weak-password') {
                setFieldError(passwordInput, passwordErrorEl, 'Password is too weak. Use 8+ chars with uppercase, lowercase, number, and special character.');
            } else {
                setStatus(`Create account failed: ${error.message}`, 'error');
            }
        }
    });

    if (emailInput) {
        emailInput.addEventListener('input', () => setFieldError(emailInput, emailErrorEl, ''));
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', () => setFieldError(passwordInput, passwordErrorEl, ''));
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => setFieldError(confirmPasswordInput, confirmPasswordErrorEl, ''));
    }

    [emailInput, passwordInput, confirmPasswordInput].forEach((input) => {
        if (!input) return;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createBtn.click();
            }
        });
    });
});
