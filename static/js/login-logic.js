import { signInWithPopup, onAuthStateChanged, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, provider } from "/static/js/firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const loadingBar = document.getElementById('loadingBar');
    const loadingFill = document.querySelector('.loading-fill');
    const guestBtn = document.getElementById('guestBtn');
    const preloader = document.getElementById('app-preloader');

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
        if (user || isGuest) {
            window.location.href = '/home';
        } else {
            if(preloader) preloader.classList.add('hide');
        }
    });

    if (loginBtn) {
        loginBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            localStorage.removeItem('isOrbitGuest'); 
            
            // UI
            loginBtn.style.display = 'none';
            loadingBar.style.display = 'block';
            loadingFill.style.transition = "width 10s ease"; 
            setTimeout(() => { loadingFill.style.width = '70%'; }, 50);

            try {
                // This will now pop up the window asking you to "Allow" again
                const result = await signInWithPopup(auth, provider);
                const credential = GoogleAuthProvider.credentialFromResult(result);
                
                // Save the NEW token which now has Task permissions
                localStorage.setItem('googleCalendarToken', credential.accessToken);

            } catch (error) {
                console.error("Login Error:", error);
                loadingFill.style.width = '0%';
                loadingBar.style.display = 'none';
                loginBtn.style.display = 'flex';
                alert("Login failed: " + error.message);
            }
        });
    }

    if (guestBtn) {
        guestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('isOrbitGuest', 'true');
            localStorage.removeItem('googleCalendarToken');
            window.location.href = '/home';
        });
    }
});