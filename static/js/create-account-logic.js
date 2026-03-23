import { createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/static/js/firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('createAccountBtn');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const loadingBar = document.getElementById('loadingBar');
    const loadingFill = document.querySelector('.loading-fill');
    const preloader = document.getElementById('app-preloader');
    const loginStatus = document.getElementById('loginStatus');

    function setStatus(message, type = 'info') {
        if (!loginStatus) return;
        loginStatus.textContent = message || '';
        loginStatus.className = `login-status ${type}`;
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
        const email = (emailInput?.value || '').trim();
        const password = passwordInput?.value || '';
        const confirmPassword = confirmPasswordInput?.value || '';

        if (!email || !password || !confirmPassword) {
            setStatus('Please fill in all fields.', 'warn');
            return;
        }

        if (password.length < 6) {
            setStatus('Password must be at least 6 characters.', 'warn');
            return;
        }

        if (password !== confirmPassword) {
            setStatus('Passwords do not match.', 'warn');
            return;
        }

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
            } else {
                setStatus(`Create account failed: ${error.message}`, 'error');
            }
        }
    });
});
