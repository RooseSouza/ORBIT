import { signOut, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, provider, app } from "/static/js/firebase-config.js";
import { toggleBookmark, getBookmarks, isBookmarked, updateBookmarkReminder } from "/static/js/bookmarks-logic.js";

// --- DATA STORES ---
window.globalEventsStore = [];      
window.currentFilteredEvents = [];  
window.bookmarksStore = [];
window.eventDataByKey = new Map();

// --- FILTER STATE ---
let currentFilters = {
    search: "",
    source: "all", time: "all", category: "all", categoryKeywords: [],
    status: "all",
    showTasks: true, keywords: [], startDate: null, endDate: null,
    eventType: "all", locationType: "all", sortBy: "soonest"
};

let isGuestSession = localStorage.getItem('isOrbitGuest') === 'true';
let isLogoutTransition = false;
let canUseSourceSelector = false;

function isGoogleUser(user) {
    if (!user || !Array.isArray(user.providerData)) return false;
    return user.providerData.some((provider) => provider && provider.providerId === 'google.com');
}

document.addEventListener('DOMContentLoaded', () => {
    
    const db = getFirestore(app);

    // Dark mode: apply from localStorage immediately
    if (localStorage.getItem('orbitTheme') === 'dark') {
        document.documentElement.classList.add('dark');
    }

    // UI Refs
    const preloader = document.getElementById('app-preloader');
    const navProfile = document.querySelector('.nav-profile');
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    const profileEmailText = document.getElementById('profileEmailText');
    const logoutBtn = document.getElementById('logoutBtn');
    const navIcon = document.querySelector('.nav-icon');
    const sideMenu = document.getElementById('side-menu');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const eventsContainer = document.getElementById('dynamic-events-container');
    const homeView = document.getElementById('home-view');
    const mobileFiltersToggle = document.getElementById('mobileFiltersToggle');
    const mobileFiltersClose = document.getElementById('mobileFiltersClose');
    const mobileFilterSidebar = document.getElementById('mobileFilterSidebar');
    const filterSidebarOverlay = document.getElementById('filterSidebarOverlay');

    // Modals & Filters (Refs)
    const searchInput = document.getElementById('searchInput');
    const bookmarkSearchInput = document.getElementById('bookmarkSearch');
    const categoryChips = document.getElementById('categoryChips');
    const openFilterModalBtn = document.getElementById('openFilterModalBtn');
    const filterModalOverlay = document.getElementById('filter-modal-overlay');
    const closeFilterBtn = document.getElementById('close-filter-btn');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const filterShowTasks = document.getElementById('filter-show-tasks');
    const filterKeywords = document.getElementById('filter-keywords');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    const filterEventType = document.getElementById('filter-event-type');
    const filterLocationType = document.getElementById('filter-location-type');
    const filterSortBy = document.getElementById('filter-sort-by');
    const modalOverlay = document.getElementById('event-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn-inner');
    const modalBookmarkBtn = document.getElementById('modal-bookmark-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalMetaSeparator = document.getElementById('modal-meta-separator');
    const modalDesc = document.getElementById('modal-desc');
    const modalCountdownWrapper = document.querySelector('.modal-countdown-wrapper');
    const modalCountdownPrimary = document.getElementById('modal-countdown-primary');
    const modalCountdownSecondary = document.getElementById('modal-countdown-secondary');
    const calendarSplitLayout = document.getElementById('calendarSplitLayout');
    const calendarDayPanel = document.getElementById('calendar-day-panel');
    const calendarDayPanelTitle = document.getElementById('calendar-day-panel-title');
    const calendarDayEventsList = document.getElementById('calendar-day-events-list');
    const calendarDayPanelCloseBtn = document.getElementById('calendar-day-panel-close');
    const dayModalOverlay = document.getElementById('day-view-modal');
    const closeDayBtn = document.getElementById('close-day-btn');
    const dayModalTitle = document.getElementById('day-modal-title');
    const dayEventsList = document.getElementById('day-events-list');
    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMins = document.getElementById('cd-minutes');
    const elSecs = document.getElementById('cd-seconds');
    let countdownInterval = null;
    let selectedCalendarDayCell = null;
    let currentModalEvent = null;

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const MOBILE_FILTER_BREAKPOINT = 1024;

    function isMobileFiltersViewport() {
        return window.matchMedia(`(max-width: ${MOBILE_FILTER_BREAKPOINT}px)`).matches;
    }

    function setMobileFiltersState(isOpen) {
        if (!homeView) return;
        const shouldOpen = Boolean(isOpen && isMobileFiltersViewport());
        homeView.classList.toggle('mobile-filters-open', shouldOpen);
        if (mobileFiltersToggle) {
            mobileFiltersToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        }
    }

    function closeMobileFilters() {
        setMobileFiltersState(false);
    }

    function toggleMobileFilters() {
        if (!homeView) return;
        setMobileFiltersState(!homeView.classList.contains('mobile-filters-open'));
    }

    // --- LOAD CUSTOM CATEGORIES ---
    function loadCustomCategories() {
        const saved = localStorage.getItem('orbitCustomCategories');
        if (saved) {
            try {
                const customs = JSON.parse(saved);
                customs.forEach(cat => {
                    addCustomCategoryChip(cat.name, cat.keywords);
                });
            } catch (e) { console.error('Failed to load custom categories:', e); }
        }
    }

    function addCustomCategoryChip(name, keywords) {
        if (!categoryChips) return;
        const exists = categoryChips.querySelector(`[data-cat="${name}"]`);
        if (exists) return; // Don't add duplicates
        
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.dataset.cat = name;
        btn.dataset.keywords = keywords;
        btn.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        categoryChips.appendChild(btn);
        
        // Add listener to new chip
        btn.addEventListener('click', (e) => {
            if (e.target.closest('button') !== btn) return;
            categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.category = name;
            currentFilters.categoryKeywords = keywords.split(',');
            applyFilters();
        });
    }

    function saveCustomCategories() {
        const customs = [];
        if (categoryChips) {
            categoryChips.querySelectorAll('.chip').forEach(chip => {
                const cat = chip.dataset.cat;
                // Skip 'all', and predefined categories
                if (cat && !['all', 'sports', 'music', 'festivals'].includes(cat)) {
                    customs.push({ name: cat, keywords: chip.dataset.keywords });
                }
            });
        }
        localStorage.setItem('orbitCustomCategories', JSON.stringify(customs));
    }

    // Load custom categories on init
    loadCustomCategories();

    function applyGuestModeUI() {
        const guestCardId = 'guest-access-card';
        const existingCard = document.getElementById(guestCardId);
        const homeView = document.getElementById('home-view');

        if (isGuestSession) {
            if (navIcon) navIcon.style.display = 'none';
            if (sideMenu) sideMenu.style.display = 'none';
            if (sideMenuOverlay) sideMenuOverlay.style.display = 'none';

            // Guests should not access bookmarks-only view.
            if (window.location.pathname === '/bookmarks') {
                window.location.href = '/home';
                return;
            }

            if (!existingCard && homeView) {
                const guestCard = document.createElement('div');
                guestCard.id = guestCardId;
                guestCard.className = 'guest-access-card';
                guestCard.innerHTML = `
                    <div class="guest-access-title"><i class="fa-regular fa-user"></i> You are using Guest Mode</div>
                    <div class="guest-access-text">Log in with your account for full access, including bookmarks and personalized menus.</div>
                    <div class="guest-access-actions">
                        <button class="guest-access-link" id="guestUpgradeBtn" type="button">Log in to unlock full access</button>
                        <span class="guest-access-or">or</span>
                        <button class="guest-access-link secondary" id="guestBackToLoginBtn" type="button">Go Back to Login Screen</button>
                    </div>
                `;
                homeView.insertBefore(guestCard, homeView.firstChild);

                const guestUpgradeBtn = document.getElementById('guestUpgradeBtn');
                const guestBackToLoginBtn = document.getElementById('guestBackToLoginBtn');
                if (guestUpgradeBtn) {
                    guestUpgradeBtn.addEventListener('click', async () => {
                        try {
                            provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
                            provider.addScope('https://www.googleapis.com/auth/tasks.readonly');
                            provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' });

                            localStorage.removeItem('isOrbitGuest');
                            const result = await signInWithPopup(auth, provider);
                            const credential = GoogleAuthProvider.credentialFromResult(result);
                            if (credential && credential.accessToken) {
                                localStorage.setItem('googleCalendarToken', credential.accessToken);
                            }
                            window.location.href = '/home';
                        } catch (e) {
                            console.error('Guest upgrade login failed:', e);
                            alert('Login failed. Please try again.');
                        }
                    });
                }
                if (guestBackToLoginBtn) {
                    guestBackToLoginBtn.addEventListener('click', () => {
                        localStorage.removeItem('isOrbitGuest');
                        localStorage.removeItem('googleCalendarToken');
                        window.location.href = '/';
                    });
                }
            }
        } else {
            if (navIcon) navIcon.style.display = '';
            if (sideMenu) sideMenu.style.display = '';
            if (sideMenuOverlay) sideMenuOverlay.style.display = '';
            if (existingCard) existingCard.remove();
        }
    }

    function applyAuthScopedVisibility(user) {
        const sourceFilterBtn = document.getElementById('sourceFilterBtn');
        const calSourceSelect = document.getElementById('calSourceSelect');
        const listViewLegend = document.getElementById('listViewLegend');
        const calendarViewLegend = document.getElementById('calendarViewLegend');
        const themeTopToggle = document.getElementById('themeTopToggle');
        const showSourceSelector = !!user && isGoogleUser(user) && !isGuestSession;

        canUseSourceSelector = showSourceSelector;

        if (sourceFilterBtn) {
            const sourceFilterSection = sourceFilterBtn.closest('.filter-section');
            if (sourceFilterSection) {
                sourceFilterSection.style.display = showSourceSelector ? '' : 'none';
            }
        }

        if (calSourceSelect) {
            calSourceSelect.style.display = showSourceSelector ? '' : 'none';
        }

        if (listViewLegend) {
            listViewLegend.style.display = showSourceSelector ? '' : 'none';
        }

        if (calendarViewLegend) {
            calendarViewLegend.style.display = showSourceSelector ? '' : 'none';
        }

        if (!showSourceSelector) {
            currentFilters.source = 'all';
        }

        if (profileEmailText) {
            profileEmailText.textContent = user && user.email ? user.email : 'Guest Mode';
        }

        if (themeTopToggle) {
            const topThemeWrap = themeTopToggle.parentElement;
            if (topThemeWrap) {
                topThemeWrap.style.display = isGuestSession ? 'flex' : 'none';
            } else {
                themeTopToggle.style.display = isGuestSession ? 'inline-flex' : 'none';
            }
        }

        document.body.classList.toggle('logo-centered-mode', !isGuestSession);

        if (isGuestSession) {
            if (profileMenu) {
                profileMenu.classList.remove('show');
                profileMenu.style.display = 'none';
            }
            if (profileBtn) {
                profileBtn.style.cursor = 'default';
                profileBtn.setAttribute('aria-disabled', 'true');
            }
        } else {
            if (profileMenu) profileMenu.style.display = '';
            if (profileBtn) {
                profileBtn.style.cursor = '';
                profileBtn.removeAttribute('aria-disabled');
            }
        }
    }


    // ==========================================
    // 1. AUTH CHECK & PAGE ROUTING
    // ==========================================
    onAuthStateChanged(auth, (user) => {
        if (isLogoutTransition) {
            return;
        }

        const isGuest = localStorage.getItem('isOrbitGuest') === 'true';
        isGuestSession = !user && isGuest;
        if (!user && !isGuest) {
            window.location.href = '/';
        } else {
            applyGuestModeUI();
            applyAuthScopedVisibility(user);

            if (user && user.photoURL) {
                navProfile.style.backgroundImage = `url('${user.photoURL}')`;
                navProfile.style.border = "2px solid white";
            }
            
            if (window.location.pathname === '/bookmarks') {
                const bmContainer = document.getElementById('dynamic-bookmarks-container');
                if (bmContainer) loadBookmarksPage(bmContainer);
            } else {
                if (eventsContainer) {
                    if (user && isGoogleUser(user)) {
                        fetchGoogleData();
                    } else {
                        fetchFirestoreOnly();
                    }
                }
            }
            if(preloader) preloader.classList.add('hide');
        }
    });

    // ==========================================
    // 2. DATA FETCHING
    // ==========================================
    async function fetchGoogleData() {
        const token = localStorage.getItem('googleCalendarToken');
        
        // If no token (but logged in), prompt re-sync
        if (!token) {
            handleExpiredToken();
            return;
        }
        
        eventsContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;"><i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...</div>';
        const now = new Date().toISOString();

        try {
            // We use Promise.allSettled so if Google fails, Public events still load
            const results = await Promise.allSettled([
                fetchCalendarEvents(token, 'primary', now, 'green'),
                fetchCalendarEvents(token, 'addressbook#contacts@group.v.calendar.google.com', now, 'green'),
                fetchAllTaskLists(token, 'green'),
                fetchFirestoreEvents('blue') 
            ]);

            // Check if any Google request failed with "TOKEN_EXPIRED"
            const tokenExpired = results.some(r => r.status === 'rejected' && r.reason.message === 'TOKEN_EXPIRED');
            
            if (tokenExpired) {
                handleExpiredToken();
                return;
            }

            // Extract successful data
            const primaryEvents = results[0].status === 'fulfilled' ? results[0].value : [];
            const birthdayEvents = results[1].status === 'fulfilled' ? results[1].value : [];
            const tasks = results[2].status === 'fulfilled' ? results[2].value : [];
            const publicEvents = results[3].status === 'fulfilled' ? results[3].value : [];

            const rawItems = [...primaryEvents, ...birthdayEvents, ...tasks, ...publicEvents];
            
            // Deduplicate
            const idMap = new Map();
            rawItems.forEach((item) => { if (!idMap.has(item.id)) idMap.set(item.id, item); });
            const step1Items = Array.from(idMap.values());

            const finalMap = new Map();
            step1Items.forEach(item => {
                const signature = `${item.title}|${item.sortDate}`;
                if (finalMap.has(signature)) {
                    const existing = finalMap.get(signature);
                    const existingHasDesc = existing.description && existing.description !== "No description provided.";
                    const newHasDesc = item.description && item.description !== "No description provided.";
                    if (!existingHasDesc && newHasDesc) finalMap.set(signature, item);
                } else {
                    finalMap.set(signature, item);
                }
            });
            const uniqueItems = Array.from(finalMap.values());

            // Initial Sort
            uniqueItems.sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));

            window.globalEventsStore = uniqueItems;
            applyFilters();

        } catch (error) {
            console.error("Error:", error);
            eventsContainer.innerHTML = '<div style="padding:20px; text-align:center;">Error loading data.</div>';
        }
    }

        function handleExpiredToken() {
        localStorage.removeItem('googleCalendarToken');
        
        fetchFirestoreEvents('blue').then(publicEvents => {
            window.globalEventsStore = publicEvents;
            applyFilters();
            
            const reconnectDiv = document.createElement('div');
            // Changed background to white, added border, changed text color to black
            reconnectDiv.style.cssText = "background: #fff3cd; color: #856404; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center; border: 1px solid #ffeeba;";
            reconnectDiv.innerHTML = `
                <p style="margin:0 0 10px 0; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Google Session Expired</p>
                <button id="reSyncBtn" style="background:white; color:#000; border:1px solid #000; padding:8px 15px; border-radius:30px; cursor:pointer; font-weight:600;">Reconnect Google Account</button>
            `;
            
            if (eventsContainer) {
                eventsContainer.prepend(reconnectDiv);
                document.getElementById('reSyncBtn').addEventListener('click', reSyncGoogle);
            }
        });
    }

        async function reSyncGoogle() {
        try {
            // *** CRITICAL FIX: FORCE CONSENT SCREEN ***
            // This ensures we get a fresh Refresh Token and full permissions
            provider.setCustomParameters({
                prompt: 'consent',
                access_type: 'offline'
            });
            
            // Add scopes again just to be safe
            provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
            provider.addScope('https://www.googleapis.com/auth/tasks.readonly');

            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            
            // Save new token
            localStorage.setItem('googleCalendarToken', credential.accessToken);
            
            // Reload page to re-trigger fetch
            window.location.reload(); 
        } catch (e) {
            console.error("Sync failed:", e);
            alert("Sync failed: " + e.message);
        }
    }

    async function fetchFirestoreOnly() {
        try {
            const publicEvents = await fetchFirestoreEvents('blue');
            window.globalEventsStore = publicEvents;
            applyFilters();
        } catch(e) { console.error(e); }
    }

    async function loadBookmarksPage(container) {
        container.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading Bookmarks...</div>';
        const bms = await getBookmarks();
        bms.sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));
        window.bookmarksStore = bms;
        if (bms.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color:#888;">No bookmarks yet.</div>';
        } else {
            applyBookmarkSearch();
        }
    }

    async function applyBookmarkSearch() {
        const container = document.getElementById('dynamic-bookmarks-container');
        if (!container) return;

        const query = (bookmarkSearchInput?.value || '').trim().toLowerCase();
        const allBookmarks = window.bookmarksStore || [];

        if (!query) {
            if (allBookmarks.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding: 40px; color:#888;">No bookmarks yet.</div>';
                return;
            }
            await renderMixedItems(allBookmarks, container);
            return;
        }

        const filtered = allBookmarks.filter(item => {
            const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
            return text.includes(query);
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color:#888;">No bookmarks match your search.</div>';
            return;
        }

        await renderMixedItems(filtered, container);
    }

    // --- API Helpers (Updated to throw 401) ---
    async function fetchCalendarEvents(token, calendarId, timeMin, colorCategory) {
        try {
            const encodedId = encodeURIComponent(calendarId);
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?timeMin=${timeMin}&orderBy=startTime&singleEvents=true&maxResults=50`, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (response.status === 401) throw new Error("TOKEN_EXPIRED");
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.items.map(item => ({
                type: 'Event',
                id: item.id,
                title: item.summary || "Untitled",
                description: item.description || "No description provided.",
                sortDate: item.start.dateTime || item.start.date,
                endDate: item.end?.dateTime || item.end?.date || null,
                isAllDay: !item.start.dateTime,
                color: colorCategory
            }));
        } catch (e) { 
            if (e.message === "TOKEN_EXPIRED") throw e; // Bubble up
            return []; 
        }
    }

    async function fetchAllTaskLists(token, colorCategory) {
        try {
            const listResponse = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (listResponse.status === 401) throw new Error("TOKEN_EXPIRED");
            if (!listResponse.ok) return [];
            
            const listData = await listResponse.json();
            if(!listData.items) return [];
            
            const promises = listData.items.map(list => fetchTasksFromList(token, list.id, colorCategory));
            // We use Promise.all here because if one list fails with 401, all will likely fail
            const results = await Promise.all(promises);
            return results.flat();
        } catch (e) { 
            if (e.message === "TOKEN_EXPIRED") throw e;
            return []; 
        }
    }

    async function fetchTasksFromList(token, listId, colorCategory) {
        try {
            const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=false&maxResults=20`, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (response.status === 401) throw new Error("TOKEN_EXPIRED");
            if (!response.ok) return [];
            
            const data = await response.json();
            if (!data.items) return [];
            
            return data.items.map(item => ({ type: 'Task', id: item.id, title: item.title || "Untitled", description: item.notes || "No notes.", sortDate: item.due || new Date().toISOString(), endDate: null, isAllDay: true, color: colorCategory }));
        } catch (e) { 
            if (e.message === "TOKEN_EXPIRED") throw e;
            return []; 
        }
    }

    async function fetchFirestoreEvents(colorCategory) {
        try {
            const querySnapshot = await getDocs(collection(db, "public_events"));
            const events = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const startDate = new Date(data.date);
                const endDate = data.endDate ? new Date(data.endDate) : null;
                const effectiveEnd = endDate && !Number.isNaN(endDate.getTime())
                    ? endDate
                    : new Date(startDate.getTime() + 60 * 60 * 1000);
                if (effectiveEnd >= new Date()) {
                    events.push({
                        type: 'Public',
                        id: doc.id,
                        title: data.title,
                        description: data.description || "Public Event",
                        sortDate: data.date,
                        endDate: data.endDate || null,
                        isAllDay: false,
                        color: colorCategory,
                        locType: data.locationType || 'text',
                        locValue: data.locationValue || '',
                        ticketUrl: data.ticketUrl || '',
                        images: Array.isArray(data.images) ? data.images : []
                    });
                }
            });
            return events;
        } catch (e) { return []; }
    }


    // ==========================================
    // 3. FILTERING ENGINE
    // ==========================================
    function applyFilters() {
        if(!window.globalEventsStore) return;
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const filtered = window.globalEventsStore.filter(item => {
            const itemDate = new Date(item.sortDate);
            const lowerTitle = (item.title + " " + item.description).toLowerCase();

            if (currentFilters.search && !lowerTitle.includes(currentFilters.search)) return false;
            if (currentFilters.source === 'my' && item.type === 'Public') return false;
            if (currentFilters.source === 'public' && item.type !== 'Public') return false;
            if (currentFilters.category !== 'all') {
                const keywords = currentFilters.categoryKeywords;
                const matchesKeyword = keywords.some(key => lowerTitle.includes(key));
                if (!matchesKeyword) return false;
            }
            if (currentFilters.keywords.length > 0) {
                const matchesAllKeywords = currentFilters.keywords.every(key => lowerTitle.includes(key));
                if (!matchesAllKeywords) return false;
            }
            if (!currentFilters.showTasks && item.type === 'Task') return false;
            if (currentFilters.eventType === 'event' && item.type !== 'Event') return false;
            if (currentFilters.eventType === 'task' && item.type !== 'Task') return false;
            if (currentFilters.eventType === 'public' && item.type !== 'Public') return false;
            if (currentFilters.locationType !== 'all') {
                const locType = item.locType || 'text';
                if (locType !== currentFilters.locationType) return false;
            }
            if (currentFilters.time !== 'all') {
                const oneWeek = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
                const oneMonth = new Date(todayStart); oneMonth.setMonth(todayStart.getMonth() + 1);
                const oneYear = new Date(todayStart); oneYear.setFullYear(todayStart.getFullYear() + 1);
                if (currentFilters.time === 'week' && itemDate > oneWeek) return false;
                if (currentFilters.time === 'month' && itemDate > oneMonth) return false;
                if (currentFilters.time === 'year' && itemDate > oneYear) return false;
            }
            if (currentFilters.status !== 'all') {
                if (currentFilters.status === 'live' && !isEventLive(item)) return false;
                if (currentFilters.status === 'upcoming' && getEventStartDate(item) <= now) return false;
            }
            if (currentFilters.startDate) {
                const start = new Date(currentFilters.startDate);
                if (itemDate < start) return false;
            }
            if (currentFilters.endDate) {
                const end = new Date(currentFilters.endDate);
                end.setHours(23, 59, 59);
                if (itemDate > end) return false;
            }
            return true;
        });

        if (currentFilters.sortBy === 'latest') {
            filtered.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
        } else if (currentFilters.sortBy === 'name_asc') {
            filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else if (currentFilters.sortBy === 'name_desc') {
            filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        } else {
            filtered.sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));
        }

        window.currentFilteredEvents = filtered;
        renderMixedItems(filtered, eventsContainer);

        if (document.getElementById('calendarGrid')) {
            renderCalendar(currentMonth, currentYear);
        }
    }

    // --- FILTER LISTENERS ---
    function syncSourceFilterUI() {
        const sourceFilterBtn = document.getElementById('sourceFilterBtn');
        const calSourceSelect = document.getElementById('calSourceSelect');
        const sourceLabelByValue = {
            all: 'All Events',
            my: 'My Events',
            public: 'Public Events'
        };

        if (sourceFilterBtn) {
            const label = sourceFilterBtn.querySelector('span');
            if (label) label.innerText = sourceLabelByValue[currentFilters.source] || 'All Events';
            sourceFilterBtn.classList.toggle('active', canUseSourceSelector && currentFilters.source !== 'all');
        }

        if (calSourceSelect) {
            calSourceSelect.value = currentFilters.source || 'all';
        }
    }

    function syncLocationFilterUI() {
        const locationFilterBtn = document.getElementById('locationFilterBtn');
        const locationLabelByValue = {
            all: 'All Locations',
            text: 'Text Location',
            map: 'Google Location'
        };

        if (locationFilterBtn) {
            const label = locationFilterBtn.querySelector('span');
            if (label) label.innerText = locationLabelByValue[currentFilters.locationType] || 'All Locations';
            locationFilterBtn.classList.toggle('active', currentFilters.locationType !== 'all');
        }

        if (filterLocationType) {
            filterLocationType.value = currentFilters.locationType || 'all';
        }
    }

    function syncSortFilterUI() {
        const sortFilterBtn = document.getElementById('sortFilterBtn');
        const sortLabelByValue = {
            soonest: 'Soonest First',
            latest: 'Latest First',
            name_asc: 'A-Z',
            name_desc: 'Z-A'
        };

        if (sortFilterBtn) {
            const label = sortFilterBtn.querySelector('span');
            if (label) label.innerText = sortLabelByValue[currentFilters.sortBy] || 'Soonest First';
            sortFilterBtn.classList.toggle('active', currentFilters.sortBy !== 'soonest');
        }

        if (filterSortBy) {
            filterSortBy.value = currentFilters.sortBy || 'soonest';
        }
    }

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentFilters.search = e.target.value.toLowerCase();

            // If user is on calendar view, switch back to list view for search results.
            const listBtn = document.getElementById('btnListView');
            const calendarBtn = document.getElementById('btnCalendarView');
            if (listBtn && calendarBtn && calendarBtn.classList.contains('active')) {
                listBtn.click();
            }

            applyFilters();
        });
    }

    if (mobileFiltersToggle) {
        mobileFiltersToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileFilters();
        });
    }

    if (mobileFiltersClose) {
        mobileFiltersClose.addEventListener('click', () => {
            closeMobileFilters();
        });
    }

    if (filterSidebarOverlay) {
        filterSidebarOverlay.addEventListener('click', () => {
            closeMobileFilters();
        });
    }

    window.addEventListener('resize', () => {
        if (!isMobileFiltersViewport()) {
            closeMobileFilters();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileFilters();
        }
    });
    if (bookmarkSearchInput) {
        bookmarkSearchInput.addEventListener('input', () => {
            applyBookmarkSearch();
        });
    }
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterType = item.dataset.filterType; 
            if (filterType === 'source') {
                if (!canUseSourceSelector) return;
                currentFilters.source = item.dataset.value;
            }
            if (filterType === 'time') currentFilters.time = item.dataset.value;
            if (filterType === 'status') currentFilters.status = item.dataset.value;
            if (filterType === 'location') currentFilters.locationType = item.dataset.value;
            if (filterType === 'sort') currentFilters.sortBy = item.dataset.value;
            const menu = item.parentElement;
            menu.previousElementSibling.querySelector('span').innerText = item.innerText;
            menu.previousElementSibling.classList.remove('active'); menu.classList.remove('show');
            if (filterType === 'source') syncSourceFilterUI();
            if (filterType === 'location') syncLocationFilterUI();
            if (filterType === 'sort') syncSortFilterUI();
            applyFilters();
        });
    });
    if(categoryChips) {
        categoryChips.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if(!btn || btn.classList.contains('filter-btn')) return;
            categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); btn.classList.add('active');
            currentFilters.category = btn.dataset.cat;
            currentFilters.categoryKeywords = btn.dataset.keywords ? btn.dataset.keywords.split(',') : [];
            if (filterKeywords) filterKeywords.value = "";
            if (filterStartDate) filterStartDate.value = "";
            if (filterEndDate) filterEndDate.value = "";
            if (filterEventType) filterEventType.value = "all";
            if (filterLocationType) filterLocationType.value = "all";
            if (filterSortBy) filterSortBy.value = "soonest";
            if (openFilterModalBtn) openFilterModalBtn.classList.remove('active');
            currentFilters.keywords = [];
            currentFilters.startDate = null;
            currentFilters.endDate = null;
            currentFilters.eventType = "all";
            currentFilters.locationType = "all";
            currentFilters.sortBy = "soonest";
            syncLocationFilterUI();
            syncSortFilterUI();
            applyFilters();
        });
    }

    // --- CUSTOM KEYWORD INPUT ---
    const customKeywordInput = document.getElementById('customKeywordInput');
    const addCustomKeywordBtn = document.getElementById('addCustomKeywordBtn');
    if (addCustomKeywordBtn) {
        addCustomKeywordBtn.addEventListener('click', () => {
            const input = customKeywordInput?.value.trim().toLowerCase();
            if (!input) return;
            
            // Check if already exists
            if (categoryChips?.querySelector(`[data-cat="${input}"]`)) {
                alert('Category already exists!');
                return;
            }
            
            addCustomCategoryChip(input, input); // Use the keyword itself as both name and keyword
            customKeywordInput.value = '';
            saveCustomCategories();
        });
        
        // Allow Enter key to add
        customKeywordInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addCustomKeywordBtn.click();
        });
    }
    if(openFilterModalBtn) openFilterModalBtn.addEventListener('click', () => { document.getElementById('filter-modal-overlay').classList.add('show'); });
    if(closeFilterBtn) closeFilterBtn.addEventListener('click', () => { document.getElementById('filter-modal-overlay').classList.remove('show'); });
    if(applyFiltersBtn) applyFiltersBtn.addEventListener('click', () => {
        currentFilters.showTasks = filterShowTasks ? filterShowTasks.checked : true;
        currentFilters.keywords = filterKeywords ? filterKeywords.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : [];
        currentFilters.startDate = filterStartDate && filterStartDate.value ? filterStartDate.value : null;
        currentFilters.endDate = filterEndDate && filterEndDate.value ? filterEndDate.value : null;
        currentFilters.eventType = filterEventType ? filterEventType.value : 'all';
        currentFilters.locationType = filterLocationType ? filterLocationType.value : 'all';
        currentFilters.sortBy = filterSortBy ? filterSortBy.value : 'soonest';
        syncLocationFilterUI();
        syncSortFilterUI();

        const hasCustom =
            currentFilters.keywords.length > 0 ||
            !!currentFilters.startDate ||
            !!currentFilters.endDate ||
            currentFilters.eventType !== 'all' ||
            currentFilters.locationType !== 'all' ||
            currentFilters.sortBy !== 'soonest' ||
            !currentFilters.showTasks;

        if (openFilterModalBtn) openFilterModalBtn.classList.toggle('active', hasCustom);

        if (hasCustom) {
            // When custom filters are active, clear quick filter button states.
            currentFilters.source = 'all';
            currentFilters.time = 'all';
            currentFilters.status = 'all';
            currentFilters.category = 'all';
            currentFilters.categoryKeywords = [];

            if (categoryChips) {
                categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            }

            const timeFilterBtn = document.getElementById('timeFilterBtn');
            const statusFilterBtn = document.getElementById('statusFilterBtn');
            syncSourceFilterUI();
            if (timeFilterBtn) {
                const label = timeFilterBtn.querySelector('span');
                if (label) label.innerText = 'Any Time';
                timeFilterBtn.classList.remove('active');
            }
            if (statusFilterBtn) {
                const label = statusFilterBtn.querySelector('span');
                if (label) label.innerText = 'All Status';
                statusFilterBtn.classList.remove('active');
            }
        }

        document.getElementById('filter-modal-overlay').classList.remove('show'); applyFilters();
    });
    if(resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => {
        if (filterShowTasks) filterShowTasks.checked = true;
        if (filterKeywords) filterKeywords.value = "";
        if (filterStartDate) filterStartDate.value = "";
        if (filterEndDate) filterEndDate.value = "";
        if (filterEventType) filterEventType.value = "all";
        if (filterLocationType) filterLocationType.value = "all";
        if (filterSortBy) filterSortBy.value = "soonest";

        currentFilters.showTasks = true;
        currentFilters.keywords = [];
        currentFilters.startDate = null;
        currentFilters.endDate = null;
        currentFilters.eventType = 'all';
        currentFilters.locationType = 'all';
        currentFilters.sortBy = 'soonest';
        syncLocationFilterUI();
        syncSortFilterUI();

        if (categoryChips) {
            categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            const allBtn = categoryChips.querySelector('[data-cat="all"]');
            if (allBtn) allBtn.classList.add('active');
        }
        currentFilters.category = 'all';
        currentFilters.categoryKeywords = [];
        currentFilters.status = 'all';
        const statusFilterBtn = document.getElementById('statusFilterBtn');
        if (statusFilterBtn) {
            const label = statusFilterBtn.querySelector('span');
            if (label) label.innerText = 'All Status';
            statusFilterBtn.classList.remove('active');
        }
        if (openFilterModalBtn) openFilterModalBtn.classList.remove('active');
        document.getElementById('filter-modal-overlay').classList.remove('show'); applyFilters();
    });


    // ==========================================
    // 4. RENDERING & REMINDERS
    // ==========================================
    function safeDecode(value) {
        const raw = String(value ?? '');
        try {
            return decodeURIComponent(raw);
        } catch (_) {
            return raw;
        }
    }

    function normalizeImageUrls(rawImages, allowDataUrl = true) {
        const list = Array.isArray(rawImages) ? rawImages : [];
        const normalized = [];
        const seen = new Set();

        list.forEach((value) => {
            const url = String(value || '').trim();
            if (!url) return;
            const isHttp = /^https?:\/\//i.test(url);
            const isDataImage = /^data:image\//i.test(url);
            if (!isHttp && !(allowDataUrl && isDataImage)) return;
            if (seen.has(url)) return;
            seen.add(url);
            normalized.push(url);
        });

        return normalized.slice(0, 8);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    function getEventStartDate(item) {
        return new Date(item?.sortDate || item?.date || Date.now());
    }

    function getEventEndDate(item) {
        if (item?.endDate) {
            const parsedEnd = new Date(item.endDate);
            if (!Number.isNaN(parsedEnd.getTime())) return parsedEnd;
        }
        const start = getEventStartDate(item);
        return new Date(start.getTime() + 60 * 60 * 1000);
    }

    function isEventLive(item) {
        const now = Date.now();
        const start = getEventStartDate(item).getTime();
        const end = getEventEndDate(item).getTime();
        return now >= start && now < end;
    }

    function buildMapEmbedSrc(rawValue) {
        const raw = String(rawValue || '').trim();
        if (!/^https?:\/\//i.test(raw)) return '';

        const iframeSrcMatch = raw.match(/src=["']([^"']+)["']/i);
        const srcCandidate = iframeSrcMatch ? iframeSrcMatch[1] : raw;

        try {
            const parsed = new URL(srcCandidate);
            const host = parsed.hostname.toLowerCase();
            const isGoogleMapsHost = host.includes('google.') && (host.includes('maps') || parsed.pathname.includes('/maps'));
            if (!isGoogleMapsHost) return srcCandidate;

            const existingQ = parsed.searchParams.get('q') || parsed.searchParams.get('query') || '';
            if (existingQ) {
                return `https://www.google.com/maps?q=${encodeURIComponent(existingQ)}&output=embed`;
            }

            const placeMatch = decodeURIComponent(parsed.pathname).match(/\/place\/([^/]+)/i);
            if (placeMatch && placeMatch[1]) {
                return `https://www.google.com/maps?q=${encodeURIComponent(placeMatch[1])}&output=embed`;
            }

            const coordMatch = decodeURIComponent(parsed.pathname).match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
            if (coordMatch) {
                return `https://www.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&output=embed`;
            }

            if (parsed.pathname.includes('/maps/embed')) {
                return srcCandidate;
            }

            parsed.searchParams.set('output', 'embed');
            return parsed.toString();
        } catch (_) {
            return srcCandidate;
        }
    }

    async function renderMixedItems(items, targetContainer) {
        if (!targetContainer) return;
        
        if (!items || items.length === 0) {
            // Keep the reconnect button if it exists
            const hasReconnect = targetContainer.querySelector('#reSyncBtn');
            targetContainer.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">No events found.</div>';
            if(hasReconnect) targetContainer.prepend(hasReconnect.parentElement);
            return;
        }
        
        const bookmarkedEvents = isGuestSession ? [] : await getBookmarks();
        const bookmarkedIds = new Set(bookmarkedEvents.map(b => b.id));
        window.eventDataByKey = new Map();

        let html = '';
        items.forEach((item, idx) => {
            const startDate = getEventStartDate(item);
            const endDate = getEventEndDate(item);
            const day = String(startDate.getDate()).padStart(2, '0');
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const year = startDate.getFullYear();
            const formattedDate = `${day}/${month}/${year}`;
            let formattedTime = item.isAllDay ? "" : " at " + startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const now = new Date();
            const diffMs = startDate - now;
            const isLive = isEventLive(item);
            let days = 0, hours = 0;
            if (diffMs > 0) {
                days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            }
            const daysStr = days.toString().padStart(2, '0');
            const hoursStr = hours.toString().padStart(2, '0');
            const shortDesc = item.description.length > 50 ? item.description.substring(0, 50) + "..." : item.description;
            const imageUrls = normalizeImageUrls(item.images || [], true);
            const thumbUrl = imageUrls[0] || '';
            
            let iconHTML = '';
            if (item.type === 'Task') iconHTML = '<i class="fa-solid fa-square-check" style="color:#666; margin-right:6px;"></i> ';
            if (item.type === 'Public') iconHTML = '<i class="fa-solid fa-earth-americas" style="color:#569aff; margin-right:6px;"></i> ';
            const borderClass = item.color === 'blue' ? 'card-blue' : 'card-green';

            const activeClass = bookmarkedIds.has(item.id) ? 'active' : '';
            const iconClass = bookmarkedIds.has(item.id) ? 'fa-solid' : 'fa-regular';
            const itemKey = `${item.type || 'item'}-${item.id || idx}-${idx}`;
            window.eventDataByKey.set(itemKey, item);

            const bookmarkButtonHtml = isGuestSession
                ? ''
                : `<button class="bookmark-btn ${activeClass}" data-event-key="${itemKey}" onclick="handleBookmarkClick(this, event)">
                        <i class="${iconClass} fa-bookmark"></i>
                   </button>`;

            const thumbHtml = thumbUrl
                ? `<div class="event-thumb"><img src="${thumbUrl}" alt="${escapeHtml(item.title || 'Event image')}"></div>`
                : '';

            const countdownHtml = isLive
                ? `<div class="live-pill"><span class="live-dot"></span><span>LIVE</span></div>`
                : `<div class="time-unit"><span class="time-num">${daysStr}</span><span class="time-label">DAYS</span></div>
                   <div class="divider">|</div>
                   <div class="time-unit"><span class="time-num">${hoursStr}</span><span class="time-label">HRS</span></div>`;

            html += `
                <div class="event-card ${borderClass}">
                    ${bookmarkButtonHtml}
                    ${thumbHtml}
                    <div class="clickable-area" 
                         data-event-key="${itemKey}"
                         onclick="handleCardClick(this)"
                         style="cursor:pointer;">
                        <div class="event-info">
                            <h3>${iconHTML}${item.title}</h3>
                            <p style="font-size: 13px; color: #666; margin-bottom: 4px;">${formattedDate}${formattedTime}</p>
                            <p>${shortDesc}</p>
                        </div>
                        <div class="countdown-box">
                            ${countdownHtml}
                        </div>
                    </div>
                </div>`;
        });
        
        // Preserve Reconnect Button if it exists
        const hasReconnect = targetContainer.querySelector('#reSyncBtn');
        targetContainer.innerHTML = html;
        if(hasReconnect) targetContainer.prepend(hasReconnect.parentElement);
        
        checkReminders(bookmarkedEvents);
    }

    // --- CLICK HANDLERS ---
    window.handleBookmarkClick = async function(btn, e) {
        if (isGuestSession) return;
        e.stopPropagation(); 
        const itemKey = btn.dataset.eventKey;
        const item = window.eventDataByKey.get(itemKey);
        if (!item) return;
        const isAdded = await toggleBookmark(item);
        const icon = btn.querySelector('i');
        if (isAdded) {
            btn.classList.add('active'); icon.classList.remove('fa-regular'); icon.classList.add('fa-solid');
        } else {
            btn.classList.remove('active'); icon.classList.add('fa-regular'); icon.classList.remove('fa-solid');
            if (window.location.pathname === '/bookmarks') btn.closest('.event-card').remove();
        }
        showReminderPicker(item, isAdded);
    };

    window.handleCardClick = function(div) {
        const itemKey = div.dataset.eventKey;
        const item = window.eventDataByKey.get(itemKey);
        if (!item) return;
        const dt = new Date(item.sortDate);
        const day = String(dt.getDate()).padStart(2, '0');
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const year = dt.getFullYear();
        const dateStr = `${day}/${month}/${year}` + (item.isAllDay ? "" : " at " + dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));

        openModal(
            item.title,
            item.description,
            dateStr,
            item.sortDate,
            encodeURIComponent(item.endDate || ''),
            item.locType,
            item.locValue,
            item.type,
            JSON.stringify(item.images || []),
            encodeURIComponent(item.ticketUrl || ''),
            encodeURIComponent(item.id || '')
        );
    };

    function checkReminders(bookmarkedEvents) {
        const user = auth.currentUser;
        if (!user || !user.email) return;
        const sent24h = JSON.parse(localStorage.getItem("sentReminders") || "[]");
        const sentCustom = JSON.parse(localStorage.getItem("sentReminders_custom") || "{}");

        const computeRemainingParts = (diffMs) => {
            const totalMinutes = Math.max(0, Math.ceil(diffMs / (1000 * 60)));
            const days = Math.floor(totalMinutes / (60 * 24));
            const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
            const minutes = totalMinutes % 60;
            return { days, hours, minutes };
        };

        bookmarkedEvents.forEach(item => {
            const now = new Date();
            const start = new Date(item.sortDate);
            const diffMs = start - now;
            const hoursLeft = diffMs / (1000 * 60 * 60);
            const remaining = computeRemainingParts(diffMs);

            // Always: 24-hour email reminder
            if (hoursLeft > 23 && hoursLeft < 25 && !sent24h.includes(item.id)) {
                fetch('/send-reminder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        title: item.title,
                        days: 1,
                        hours: 0,
                        remainingDays: remaining.days,
                        remainingHours: remaining.hours,
                        remainingMinutes: remaining.minutes
                    })
                });
                sent24h.push(item.id);
                localStorage.setItem("sentReminders", JSON.stringify(sent24h));
            }

            // Custom reminder (default 60 min; 0 = opted out)
            const reminderMinutes = (item.reminderMinutes != null) ? item.reminderMinutes : 60;
            if (reminderMinutes === 0) return;
            const reminderHours = reminderMinutes / 60;
            const remKey = `${item.id}_${reminderMinutes}`;
            const customWindowHours = 5 / 60;
            if (hoursLeft <= reminderHours && hoursLeft >= Math.max(0, reminderHours - customWindowHours) && !sentCustom[remKey]) {
                const remDays = Math.floor(reminderMinutes / (60 * 24));
                const remHoursVal = Math.floor((reminderMinutes % (60 * 24)) / 60);
                fetch('/send-reminder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        title: item.title,
                        days: remDays,
                        hours: remHoursVal,
                        remainingDays: remaining.days,
                        remainingHours: remaining.hours,
                        remainingMinutes: remaining.minutes
                    })
                });
                sentCustom[remKey] = true;
                localStorage.setItem("sentReminders_custom", JSON.stringify(sentCustom));
            }
        });
    }

    function renderModalCarousel(imageUrls) {
        const container = document.getElementById('modal-image-container');
        if (!container) return;

        container.innerHTML = '';
        if (!imageUrls.length) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        let currentIndex = 0;
        const wrapper = document.createElement('div');
        wrapper.className = 'modal-image-carousel';

        const img = document.createElement('img');
        img.className = 'modal-carousel-image';
        img.alt = 'Event image';
        wrapper.appendChild(img);

        const prevBtn = document.createElement('button');
        prevBtn.className = 'modal-carousel-btn prev';
        prevBtn.type = 'button';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'modal-carousel-btn next';
        nextBtn.type = 'button';
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

        const footer = document.createElement('div');
        footer.className = 'modal-carousel-footer';
        const counter = document.createElement('span');
        counter.className = 'modal-carousel-counter';
        footer.appendChild(counter);

        const dots = document.createElement('div');
        dots.className = 'modal-carousel-dots';
        imageUrls.forEach((_, idx) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'modal-carousel-dot';
            dot.addEventListener('click', () => {
                currentIndex = idx;
                renderCurrent();
            });
            dots.appendChild(dot);
        });
        footer.appendChild(dots);

        const renderCurrent = () => {
            img.src = imageUrls[currentIndex];
            counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
            dots.querySelectorAll('.modal-carousel-dot').forEach((dot, idx) => {
                dot.classList.toggle('active', idx === currentIndex);
            });
            const showControls = imageUrls.length > 1;
            prevBtn.style.display = showControls ? 'inline-flex' : 'none';
            nextBtn.style.display = showControls ? 'inline-flex' : 'none';
        };

        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + imageUrls.length) % imageUrls.length;
            renderCurrent();
        });

        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % imageUrls.length;
            renderCurrent();
        });

        wrapper.appendChild(prevBtn);
        wrapper.appendChild(nextBtn);
        container.appendChild(wrapper);
        container.appendChild(footer);
        renderCurrent();
    }

    // --- MODAL LOGIC ---
    window.openModal = async function(title, desc, dateStr, rawIsoDate, endIsoPayload, locType, locValue, itemType, imagesPayload, ticketUrlPayload, itemIdPayload) {
        if(!modalOverlay) return;
        const dTitle = safeDecode(title);
        const dDesc = safeDecode(desc);
        const dDate = safeDecode(dateStr);
        const dLocValue = safeDecode(locValue);
        const dEndIso = safeDecode(endIsoPayload || '');
        const dLocType = safeDecode(locType);
        const dTicketUrl = safeDecode(ticketUrlPayload || '');
        const dItemId = safeDecode(itemIdPayload || '');
        const safeTicketUrl = /^https?:\/\//i.test(dTicketUrl) ? dTicketUrl : '';

        let decodedImages = [];
        try {
            decodedImages = JSON.parse(safeDecode(imagesPayload || '[]'));
        } catch (_) {
            decodedImages = [];
        }
        const imageUrls = normalizeImageUrls(decodedImages, true);
        const hasDescription = Boolean(dDesc && dDesc.trim());

        modalTitle.innerText = dTitle;
        modalDate.innerText = dDate;
        if (modalDesc) {
            modalDesc.innerText = dDesc || '';
            modalDesc.style.display = hasDescription ? 'inline' : 'none';
        }
        if (modalMetaSeparator) {
            modalMetaSeparator.style.display = hasDescription ? 'inline' : 'none';
        }
        renderModalCarousel(imageUrls);

        const locContainer = document.getElementById('modal-location-container');
        if (locContainer) {
            locContainer.innerHTML = "";
            const safeMapSrc = buildMapEmbedSrc(dLocValue);
            if (dLocType === 'map' && safeMapSrc && dLocValue !== 'undefined') {
                locContainer.innerHTML = `<iframe src="${safeMapSrc}" width="100%" height="340" style="border:0; border-radius:12px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
                locContainer.style.display = 'block';
            } else if (dLocValue && dLocValue !== 'undefined' && dLocValue !== "") {
                locContainer.innerHTML = `<div class="modal-location-card"><i class="fa-solid fa-location-dot"></i><span>${escapeHtml(dLocValue)}</span></div>`;
                locContainer.style.display = 'block';
            } else {
                locContainer.style.display = 'none';
            }
        }
        const gcalBtn = document.getElementById('add-to-gcal-btn');
        const gcalContainer = document.getElementById('modal-gcal-container');
        const ticketContainer = document.getElementById('modal-ticket-container');
        const isGoogleCalendarEvent = itemType === 'Event' || itemType === 'Task';

        if (ticketContainer) {
            ticketContainer.innerHTML = safeTicketUrl
                ? `<a href="${safeTicketUrl}" target="_blank" rel="noopener noreferrer" class="gcal-add-btn" style="background:#fff7ed;color:#9a3412;border:1px solid #fdba74;"><i class="fa-solid fa-ticket" style="margin-right:8px;"></i>Book Tickets</a>`
                : '';
            ticketContainer.style.display = safeTicketUrl ? 'block' : 'none';
        }

        if (gcalBtn) {
            gcalBtn.style.display = isGoogleCalendarEvent ? 'none' : 'inline-flex';
        }

        if (gcalContainer) {
            gcalContainer.style.display = isGoogleCalendarEvent ? 'none' : 'block';
        }

        if (gcalBtn && rawIsoDate && !isGoogleCalendarEvent) {
            const startDt = new Date(rawIsoDate);
            const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
            const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            gcalBtn.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(dTitle)}&dates=${fmt(startDt)}/${fmt(endDt)}&details=${encodeURIComponent(dDesc)}&location=${encodeURIComponent(dLocValue)}`;
        }

        if (modalBookmarkBtn) {
            if (isGuestSession || !dItemId) {
                modalBookmarkBtn.style.display = 'none';
                currentModalEvent = null;
            } else {
                const matchedItem = window.currentFilteredEvents.find((e) => e.id === dItemId)
                    || window.globalEventsStore.find((e) => e.id === dItemId)
                    || { id: dItemId, title: dTitle, description: dDesc, sortDate: rawIsoDate, endDate: dEndIso || null, locType: dLocType, locValue: dLocValue, type: itemType, images: imageUrls, ticketUrl: dTicketUrl };

                currentModalEvent = matchedItem;
                modalBookmarkBtn.style.display = 'inline-flex';

                const modalIcon = modalBookmarkBtn.querySelector('i');
                const bookmarked = await isBookmarked(dItemId);
                modalBookmarkBtn.classList.toggle('active', bookmarked);
                if (modalIcon) {
                    modalIcon.classList.toggle('fa-solid', bookmarked);
                    modalIcon.classList.toggle('fa-regular', !bookmarked);
                }
            }
        }

        modalOverlay.classList.add('show');
        document.body.classList.add('modal-open');
        startLiveCountdown(rawIsoDate, dEndIso || null);
    }

    function startLiveCountdown(targetIsoDate, endIsoDate = null) {
        if(countdownInterval) clearInterval(countdownInterval);
        const startTarget = new Date(targetIsoDate).getTime();
        const fallbackEnd = new Date(startTarget + 60 * 60 * 1000).getTime();
        const parsedEnd = endIsoDate ? new Date(endIsoDate).getTime() : fallbackEnd;
        const endTarget = Number.isFinite(parsedEnd) ? parsedEnd : fallbackEnd;

        const update = () => {
            const now = new Date().getTime();
            const isLiveNow = now >= startTarget && now < endTarget;
            const distance = (isLiveNow ? endTarget : startTarget) - now;

            if (modalCountdownPrimary) {
                modalCountdownPrimary.innerText = isLiveNow ? 'Event is LIVE' : 'Event Starts In:';
                modalCountdownPrimary.classList.toggle('live-text', isLiveNow);
            }
            if (modalCountdownSecondary) {
                modalCountdownSecondary.style.display = isLiveNow ? 'block' : 'none';
            }
            if (modalCountdownWrapper) {
                modalCountdownWrapper.classList.toggle('is-live', isLiveNow);
            }

            if (distance < 0) {
                elDays.innerText = "00";
                elHours.innerText = "00";
                elMins.innerText = "00";
                elSecs.innerText = "00";
                if (modalCountdownPrimary) {
                    modalCountdownPrimary.innerText = 'Event Ended';
                    modalCountdownPrimary.classList.remove('live-text');
                }
                if (modalCountdownSecondary) {
                    modalCountdownSecondary.style.display = 'none';
                }
                if (modalCountdownWrapper) {
                    modalCountdownWrapper.classList.remove('is-live');
                }
                clearInterval(countdownInterval);
                return;
            }

            const d = Math.floor(distance / (1000 * 60 * 60 * 24));
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);
            elDays.innerText = String(d).padStart(2, '0');
            elHours.innerText = String(h).padStart(2, '0');
            elMins.innerText = String(m).padStart(2, '0');
            elSecs.innerText = String(s).padStart(2, '0');
        };

        update();
        countdownInterval = setInterval(update, 1000);
    }
    function closeModal() { if(modalOverlay) modalOverlay.classList.remove('show'); document.body.classList.remove('modal-open'); if(countdownInterval) clearInterval(countdownInterval); currentModalEvent = null; }
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal); if(modalOverlay) modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(); });

    if (modalBookmarkBtn) {
        modalBookmarkBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (isGuestSession || !currentModalEvent) return;

            const isAdded = await toggleBookmark(currentModalEvent);
            const icon = modalBookmarkBtn.querySelector('i');
            modalBookmarkBtn.classList.toggle('active', isAdded);
            if (icon) {
                icon.classList.toggle('fa-solid', isAdded);
                icon.classList.toggle('fa-regular', !isAdded);
            }

            showReminderPicker(currentModalEvent, isAdded);
        });
    }

    // Day View Modal Logic
    function openDayModal(eventsForDay, dateString) {
        if(!dayModalOverlay) return;
        dayModalTitle.innerText = dateString; dayEventsList.innerHTML = ""; 
        if (eventsForDay.length === 0) { dayEventsList.innerHTML = `<div style="text-align:center; padding: 20px; color:#888;">No events for this day.</div>`; } else {
            eventsForDay.forEach(item => {
                const icon = item.type === 'Task' ? 'Task' : (item.type === 'Public' ? 'Public' : 'Event');
                const dt = new Date(item.sortDate); const timeStr = item.isAllDay ? "All Day" : dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); const safeDateStr = `${dateString} at ${timeStr}`; const colorBorder = item.color === 'blue' ? 'border-blue' : 'border-green';
                const div = document.createElement('div'); div.className = `day-event-item ${colorBorder}`; div.innerHTML = `<h4>${item.title}</h4><p>${timeStr} • ${icon}</p>`;
                div.addEventListener('click', () => { closeDayModal(); setTimeout(() => { openModal(encodeURIComponent(item.title), encodeURIComponent(item.description), encodeURIComponent(safeDateStr), item.sortDate, encodeURIComponent(item.endDate || ''), encodeURIComponent(item.locType), encodeURIComponent(item.locValue), item.type, encodeURIComponent(JSON.stringify(item.images || [])), encodeURIComponent(item.ticketUrl || ''), encodeURIComponent(item.id || '')); }, 300); });
                dayEventsList.appendChild(div);
            });
        }
        dayModalOverlay.classList.add('show'); document.body.classList.add('modal-open');
    }
    function closeDayModal() { if(dayModalOverlay) dayModalOverlay.classList.remove('show'); document.body.classList.remove('modal-open'); }
    if(closeDayBtn) closeDayBtn.addEventListener('click', closeDayModal); if(dayModalOverlay) dayModalOverlay.addEventListener('click', (e) => { if(e.target === dayModalOverlay) closeDayModal(); });

    function resetCalendarDayPanel() {
        if (!calendarDayPanelTitle || !calendarDayEventsList) return;
        calendarDayPanelTitle.innerText = 'Select a day';
        calendarDayEventsList.innerHTML = '<div class="calendar-day-empty">Click any date to view events for that day.</div>';
    }

    function openCalendarDayPanel() {
        if (calendarSplitLayout) calendarSplitLayout.classList.remove('panel-hidden');
        if (calendarDayPanel) calendarDayPanel.scrollTop = 0;
    }

    function closeCalendarDayPanel() {
        if (calendarSplitLayout) calendarSplitLayout.classList.add('panel-hidden');
        if (selectedCalendarDayCell) {
            selectedCalendarDayCell.classList.remove('selected');
            selectedCalendarDayCell = null;
        }
        resetCalendarDayPanel();
    }

    function renderCalendarDayPanel(eventsForDay, dateString) {
        if (!calendarDayPanelTitle || !calendarDayEventsList) return;

        calendarDayPanelTitle.innerText = dateString;
        calendarDayEventsList.innerHTML = '';

        if (!eventsForDay.length) {
            calendarDayEventsList.innerHTML = '<div class="calendar-day-empty">No events for this day.</div>';
            return;
        }

        eventsForDay.forEach(item => {
            const icon = item.type === 'Task' ? 'Task' : (item.type === 'Public' ? 'Public' : 'Event');
            const dt = new Date(item.sortDate);
            const timeStr = item.isAllDay ? 'All Day' : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const safeDateStr = `${dateString} at ${timeStr}`;
            const colorBorder = item.color === 'blue' ? 'border-blue' : 'border-green';
            const dayImageUrls = normalizeImageUrls(item.images || [], true);
            const dayThumbUrl = dayImageUrls[0] || '';
            const thumbHtml = dayThumbUrl
                ? `<div class="event-thumb day-event-thumb"><img src="${dayThumbUrl}" alt="${escapeHtml(item.title || 'Event image')}"></div>`
                : '';
            const div = document.createElement('div');
            div.className = `day-event-item ${colorBorder}`;
            div.innerHTML = `${thumbHtml}<div class="day-event-content"><h4>${escapeHtml(item.title || 'Untitled')}</h4><p>${timeStr} • ${icon}</p></div>`;
            div.addEventListener('click', () => {
                openModal(
                    encodeURIComponent(item.title),
                    encodeURIComponent(item.description),
                    encodeURIComponent(safeDateStr),
                    item.sortDate,
                    encodeURIComponent(item.endDate || ''),
                    encodeURIComponent(item.locType),
                    encodeURIComponent(item.locValue),
                    item.type,
                    encodeURIComponent(JSON.stringify(item.images || [])),
                    encodeURIComponent(item.ticketUrl || ''),
                    encodeURIComponent(item.id || '')
                );
            });
            calendarDayEventsList.appendChild(div);
        });
    }

    // ==========================================
    // 5. CALENDAR RENDER LOGIC
    // ==========================================
    function renderCalendar(month, year) {
        const calendarGrid = document.getElementById('calendarGrid');
        if(!calendarGrid) return;
        
        calendarGrid.innerHTML = "";
        selectedCalendarDayCell = null;
        closeCalendarDayPanel();
        const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const daysInPrevMonth = new Date(year, month, 0).getDate();
        const today = new Date(); const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
        
        for (let i = firstDay; i > 0; i--) { const dayDiv = document.createElement('div'); dayDiv.classList.add('cal-day', 'other-month'); dayDiv.innerHTML = `<span class="day-number">${daysInPrevMonth - i + 1}</span>`; calendarGrid.appendChild(dayDiv); }
        for (let i = 1; i <= daysInMonth; i++) { 
            const dayDiv = document.createElement('div'); dayDiv.classList.add('cal-day'); 
            if (isCurrentMonth && i === today.getDate()) dayDiv.classList.add('today'); 
            dayDiv.innerHTML = `<span class="day-number">${i}</span>`;
            
            // --- DRAW LINES using FILTERED DATA ---
            const dayEvents = window.currentFilteredEvents.filter(e => { const eDate = new Date(e.sortDate); return eDate.getDate() === i && eDate.getMonth() === month && eDate.getFullYear() === year; });
            
            if (dayEvents.length > 0) {
                const lineContainer = document.createElement('div'); lineContainer.className = "cal-event-container";
                dayEvents.slice(0, 2).forEach(e => {
                    const line = document.createElement('div');
                    line.className = `cal-line ${e.color}`;
                    const label = document.createElement('span');
                    label.textContent = e.title || 'Untitled';
                    line.appendChild(label);
                    if (isEventLive(e)) {
                        const liveDot = document.createElement('span');
                        liveDot.className = 'cal-line-live-dot';
                        line.appendChild(liveDot);
                    }
                    lineContainer.appendChild(line);
                });
                dayDiv.appendChild(lineContainer);

                if (dayEvents.length > 2) {
                    const moreIndicator = document.createElement('span');
                    moreIndicator.className = 'cal-more-indicator';
                    moreIndicator.innerText = `+${dayEvents.length - 2} more`;
                    dayDiv.appendChild(moreIndicator);
                }
            }
            dayDiv.onclick = () => {
                if (selectedCalendarDayCell) selectedCalendarDayCell.classList.remove('selected');
                dayDiv.classList.add('selected');
                selectedCalendarDayCell = dayDiv;
                openCalendarDayPanel();
                renderCalendarDayPanel(dayEvents, `${i} ${months[month]} ${year}`);
            };
            calendarGrid.appendChild(dayDiv); 
        }
        const totalCells = firstDay + daysInMonth;
        const visibleCells = 35;
        const nextMonthDays = Math.max(0, visibleCells - totalCells);
        for (let i = 1; i <= nextMonthDays; i++) { const dayDiv = document.createElement('div'); dayDiv.classList.add('cal-day', 'other-month'); dayDiv.innerHTML = `<span class="day-number">${i}</span>`; calendarGrid.appendChild(dayDiv); }
    }

    // UI Interactions
    const btnListView = document.getElementById('btnListView');
    if (btnListView) {
        const btnCalendarView = document.getElementById('btnCalendarView');
        const listViewContent = document.getElementById('listViewContent');
        const calendarViewContent = document.getElementById('calendarViewContent');
        const calSourceSelect = document.getElementById('calSourceSelect');
        const calMonthSelect = document.getElementById('calMonthSelect');
        const calYearSelect = document.getElementById('calYearSelect');
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        const goToTodayBtn = document.getElementById('goToToday');

        function switchView(view) {
            closeMobileFilters();
            if (view === 'list') {
                btnListView.classList.add('active'); btnCalendarView.classList.remove('active');
                calendarViewContent.style.opacity = '0';
                setTimeout(() => { calendarViewContent.classList.add('view-hidden'); listViewContent.classList.remove('view-hidden'); void listViewContent.offsetWidth; listViewContent.style.opacity = '1'; }, 200);
            } else {
                btnCalendarView.classList.add('active'); btnListView.classList.remove('active');
                listViewContent.style.opacity = '0';
                setTimeout(() => { listViewContent.classList.add('view-hidden'); calendarViewContent.classList.remove('view-hidden'); void calendarViewContent.offsetWidth; calendarViewContent.style.opacity = '1'; syncSourceFilterUI(); renderCalendar(currentMonth, currentYear); }, 200);
            }
        }
        btnListView.addEventListener('click', () => switchView('list'));
        btnCalendarView.addEventListener('click', () => switchView('calendar'));

        if (calSourceSelect) {
            calSourceSelect.value = currentFilters.source || 'all';
            calSourceSelect.addEventListener('change', (e) => {
                if (!canUseSourceSelector) return;
                currentFilters.source = e.target.value;
                syncSourceFilterUI();
                applyFilters();
            });
        }

        if(goToTodayBtn) {
            goToTodayBtn.addEventListener('click', () => {
                const now = new Date(); currentMonth = now.getMonth(); currentYear = now.getFullYear();
                if(calMonthSelect) calMonthSelect.value = currentMonth; if(calYearSelect) calYearSelect.value = currentYear;
                renderCalendar(currentMonth, currentYear);
            });
        }

        if (calMonthSelect && calYearSelect) {
            months.forEach((m, index) => { const option = document.createElement('option'); option.value = index; option.textContent = m; calMonthSelect.appendChild(option); });
            for (let i = currentYear - 5; i <= currentYear + 5; i++) { const option = document.createElement('option'); option.value = i; option.textContent = i; calYearSelect.appendChild(option); }
            calMonthSelect.value = currentMonth; calYearSelect.value = currentYear;
            calMonthSelect.addEventListener('change', (e) => { currentMonth = parseInt(e.target.value); renderCalendar(currentMonth, currentYear); });
            calYearSelect.addEventListener('change', (e) => { currentYear = parseInt(e.target.value); renderCalendar(currentMonth, currentYear); });
        }
        if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; calYearSelect.value = currentYear; } calMonthSelect.value = currentMonth; renderCalendar(currentMonth, currentYear); });
        if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; calYearSelect.value = currentYear; } calMonthSelect.value = currentMonth; renderCalendar(currentMonth, currentYear); });
    }

    syncSourceFilterUI();

    if (calendarDayPanelCloseBtn) {
        calendarDayPanelCloseBtn.addEventListener('click', closeCalendarDayPanel);
    }

    if(logoutBtn) logoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        localStorage.removeItem('isOrbitGuest');
        localStorage.removeItem('googleCalendarToken');
        isLogoutTransition = true;
        try {
            await signOut(auth);
        } catch (_) {
            // Continue with visual logout transition even if signOut throws.
        }

        document.body.classList.remove('logged-in');
        if (profileMenu) profileMenu.classList.remove('show');
        setTimeout(() => {
            window.location.href = '/';
        }, 800);
    });
    if(profileBtn) profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isGuestSession || !profileMenu || profileMenu.style.display === 'none') return;
        profileMenu.classList.toggle('show');
    });
    if(navIcon) navIcon.addEventListener('click', (e) => { e.stopPropagation(); sideMenu.classList.add('show'); sideMenuOverlay.classList.add('show'); });
    const closeSideMenuFn = () => { sideMenu.classList.remove('show'); sideMenuOverlay.classList.remove('show'); }
    if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeSideMenuFn); if(sideMenuOverlay) sideMenuOverlay.addEventListener('click', closeSideMenuFn);
    document.querySelectorAll('.dropdown-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); document.querySelectorAll('.dropdown-menu.show').forEach(m => { if(m !== btn.nextElementSibling) { m.classList.remove('show'); m.previousElementSibling.classList.remove('active'); }}); const menu = btn.nextElementSibling; btn.classList.toggle('active'); menu.classList.toggle('show'); }); });
    document.addEventListener('click', () => {
        if(profileMenu) profileMenu.classList.remove('show');
        document.querySelectorAll('.dropdown-menu').forEach(m => { m.classList.remove('show'); m.previousElementSibling.classList.remove('active'); });
        closeMobileFilters();
    });

    if (mobileFilterSidebar) {
        mobileFilterSidebar.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // --- REMINDER PICKER TOAST ---
    function showReminderPicker(item, isAdded) {
        if (!isAdded) return;
        const existing = document.getElementById('reminder-picker-toast');
        if (existing) existing.remove();
        const cur = (item.reminderMinutes != null) ? item.reminderMinutes : 60;
        const opts = [[0,'No reminder'],[15,'15 minutes before'],[30,'30 minutes before'],
            [60,'1 hour before'],[120,'2 hours before'],[360,'6 hours before'],
            [1440,'1 day before'],[2880,'2 days before']]
            .map(([v,l]) => `<option value="${v}"${cur===v?' selected':''}>${l}</option>`).join('');
        const toast = document.createElement('div');
        toast.id = 'reminder-picker-toast';
        toast.className = 'reminder-toast';
        toast.innerHTML = `
            <div class="reminder-toast-title"><i class="fa-solid fa-bell"></i> Set Reminder</div>
            <div class="reminder-toast-event" title="${item.title}">${item.title.length > 32 ? item.title.substring(0,32)+'…' : item.title}</div>
            <select id="reminder-time-select" class="reminder-select">${opts}</select>
            <div class="reminder-toast-actions">
                <button id="reminder-save-btn" class="reminder-btn-save">Save</button>
                <button id="reminder-skip-btn" class="reminder-btn-skip">Skip</button>
            </div>`;
        document.body.appendChild(toast);
        const autoClose = setTimeout(() => toast.remove(), 15000);
        requestAnimationFrame(() => toast.classList.add('show'));
        document.getElementById('reminder-skip-btn').addEventListener('click', () => { clearTimeout(autoClose); toast.remove(); });
        document.getElementById('reminder-save-btn').addEventListener('click', async () => {
            clearTimeout(autoClose);
            const minutes = parseInt(document.getElementById('reminder-time-select').value);
            item.reminderMinutes = minutes;
            await updateBookmarkReminder(item.id, minutes);
            toast.innerHTML = '<div style="padding:14px 18px;text-align:center;font-weight:600;color:#4ade80;"><i class="fa-solid fa-check"></i> Reminder saved!</div>';
            setTimeout(() => toast.remove(), 2000);
        });
    }

    // --- DARK MODE TOGGLE ---
    const darkToggle = document.getElementById('dark-mode-toggle');
    const themeTopToggle = document.getElementById('themeTopToggle');
    const syncDarkUI = () => {
        const isDark = document.documentElement.classList.contains('dark');
        const icon = document.getElementById('dark-mode-icon');
        const label = document.getElementById('dark-mode-label');
        const topIcon = document.getElementById('themeTopIcon');
        const topLabel = document.getElementById('themeTopLabel');

        if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        if (topIcon) topIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        if (topLabel) topLabel.textContent = isDark ? 'Light' : 'Dark';
    };

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('orbitTheme', isDark ? 'dark' : 'light');
        syncDarkUI();
    };

    syncDarkUI();
    if (darkToggle) darkToggle.addEventListener('click', toggleTheme);
    if (themeTopToggle) themeTopToggle.addEventListener('click', toggleTheme);

    // --- AFK KEEP-ALIVE (pings /ping every 5 min while user is idle) ---
    let lastActivity = Date.now();
    ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(ev =>
        document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
    setInterval(() => {
        if (Date.now() - lastActivity > 5 * 60 * 1000) {
            fetch('/ping', { method: 'GET', cache: 'no-store' }).catch(() => {});
        }
    }, 5 * 60 * 1000);
});