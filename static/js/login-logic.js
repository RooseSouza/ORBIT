import { signInWithPopup, onAuthStateChanged, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, provider } from "/static/js/firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const loadingBar = document.getElementById('loadingBar');
    const loadingFill = document.querySelector('.loading-fill');
    const guestBtn = document.getElementById('guestBtn');
    const preloader = document.getElementById('app-preloader');
    const loginStatus = document.getElementById('loginStatus');
    let loginFlowStarted = false;
    let transitionTriggered = false;
    let progressTimer = null;

    function setStatus(message, type = 'info') {
        if (!loginStatus) return;
        loginStatus.textContent = message || '';
        loginStatus.className = `login-status ${type}`;
    }

    function startSlowProgress() {
        if (!loadingBar || !loadingFill) return;
        loadingBar.style.display = 'block';
        loadingFill.style.width = '8%';
        loadingFill.style.transition = 'width 0.45s ease';

        if (progressTimer) clearInterval(progressTimer);
        progressTimer = setInterval(() => {
            const current = parseFloat(loadingFill.style.width) || 0;
            // Keep slowly moving toward ~92% until auth resolves.
            if (current < 92 && !transitionTriggered) {
                const step = current < 55 ? 4 : (current < 80 ? 2.2 : 0.8);
                loadingFill.style.width = `${Math.min(92, current + step)}%`;
            }
        }, 280);
    }

    function stopSlowProgress() {
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
    }

    function runLoginTransition() {
        if (transitionTriggered) return;
        transitionTriggered = true;
        stopSlowProgress();
        setStatus('Signed in. Preparing your dashboard...', 'success');

        if (loadingBar) loadingBar.style.display = 'block';
        if (loadingFill) {
            loadingFill.style.transition = 'width 0.45s ease';
            loadingFill.style.width = '100%';
        }

        // Reuse the same gradient element and animate it into header height.
        setTimeout(() => {
            document.body.classList.add('logged-in');
        }, 100);

        setTimeout(() => {
            window.location.href = '/home';
        }, 950);
    }

    function runGuestTransition() {
        if (transitionTriggered) return;
        transitionTriggered = true;
        stopSlowProgress();
        setStatus('Continuing as guest...', 'success');

        if (loadingBar) loadingBar.style.display = 'block';
        if (loadingFill) {
            loadingFill.style.transition = 'width 0.55s ease';
            loadingFill.style.width = '100%';
        }

        setTimeout(() => {
            document.body.classList.add('logged-in');
        }, 90);

        setTimeout(() => {
            window.location.href = '/home';
        }, 950);
    }

    // 1. ADD SCOPES
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    provider.addScope('https://www.googleapis.com/auth/tasks.readonly');

    // 2. *** CRITICAL FIX: FORCE GOOGLE TO ASK FOR PERMISSIONS AGAIN ***
    // This ensures the new token actually includes the Tasks permission
    provider.setCustomParameters({
        prompt: 'consent'
    });

    onAuthStateChanged(auth, (user) => {
        const isGuest = localStorage.getItem('isOrbitGuest') === 'true';
        if (user) {
            if (loginFlowStarted) runLoginTransition();
            else window.location.href = '/home';
        } else if (isGuest) {
            window.location.href = '/home';
        } else {
            if(preloader) preloader.classList.add('hide');
            requestAnimationFrame(() => {
                document.body.classList.add('login-ready');
            });
        }
    });

    if (loginBtn) {
        loginBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            localStorage.removeItem('isOrbitGuest'); 
            loginFlowStarted = true;
            setStatus('Opening Google sign-in...', 'info');
            
            // UI
            loginBtn.style.display = 'none';
            startSlowProgress();

            try {
                // This will now pop up the window asking you to "Allow" again
                const result = await signInWithPopup(auth, provider);
                const credential = GoogleAuthProvider.credentialFromResult(result);
                
                // Save the NEW token which now has Task permissions
                localStorage.setItem('googleCalendarToken', credential.accessToken);
                runLoginTransition();

            } catch (error) {
                console.error("Login Error:", error);
                loginFlowStarted = false;
                transitionTriggered = false;
                stopSlowProgress();
                loadingFill.style.width = '0%';
                loadingBar.style.display = 'none';
                loginBtn.style.display = 'flex';

                if (error && error.code === 'auth/popup-closed-by-user') {
                    setStatus('Google login was closed. Click "Log in with Google" to try again.', 'warn');
                } else {
                    setStatus(`Login failed: ${error.message}`, 'error');
                }
            }
        });
    }

    if (guestBtn) {
        guestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('isOrbitGuest', 'true');
            localStorage.removeItem('googleCalendarToken');

            if (loginBtn) loginBtn.style.display = 'none';
            startSlowProgress();
            setStatus('Preparing guest session...', 'info');

            setTimeout(() => {
                runGuestTransition();
            }, 420);
        });
    }
});