import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, provider, app } from "/static/js/firebase-config.js";
import { toggleBookmark, getBookmarks, isBookmarked } from "/static/js/bookmarks-logic.js";

// --- DATA STORES ---
window.globalEventsStore = [];      
window.currentFilteredEvents = [];  

// --- FILTER STATE ---
let currentFilters = {
    search: "",
    source: "all", time: "all", category: "all", categoryKeywords: [], 
    showTasks: true, startDate: null, endDate: null, status: "all", keywords: []
};

document.addEventListener('DOMContentLoaded', () => {
    
    const db = getFirestore(app);

    // UI Refs
    const preloader = document.getElementById('app-preloader');
    const navProfile = document.querySelector('.nav-profile');
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const navIcon = document.querySelector('.nav-icon');
    const sideMenu = document.getElementById('side-menu');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const eventsContainer = document.getElementById('dynamic-events-container');

    // Filter Refs
    const searchInput = document.getElementById('searchInput');
    const categoryChips = document.getElementById('categoryChips');
    const openFilterModalBtn = document.getElementById('openFilterModalBtn');
    const filterModalOverlay = document.getElementById('filter-modal-overlay');
    const closeFilterBtn = document.getElementById('close-filter-btn');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    const filterShowTasks = document.getElementById('filter-show-tasks');
    const filterKeywords = document.getElementById('filter-keywords');

    // Modal Refs
    const modalOverlay = document.getElementById('event-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn-inner');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalDesc = document.getElementById('modal-desc');
    
    const dayModalOverlay = document.getElementById('day-view-modal');
    const closeDayBtn = document.getElementById('close-day-btn');
    const dayModalTitle = document.getElementById('day-modal-title');
    const dayEventsList = document.getElementById('day-events-list');

    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMins = document.getElementById('cd-minutes');
    const elSecs = document.getElementById('cd-seconds');
    let countdownInterval = null;

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


    // ==========================================
    // 1. AUTH CHECK & PAGE ROUTING
    // ==========================================
    onAuthStateChanged(auth, (user) => {
        const isGuest = localStorage.getItem('isOrbitGuest') === 'true';
        if (!user && !isGuest) {
            window.location.href = '/';
        } else {
            if (user && user.photoURL) {
                navProfile.style.backgroundImage = `url('${user.photoURL}')`;
                navProfile.style.border = "2px solid white";
            }
            
            if (window.location.pathname === '/bookmarks') {
                const bmContainer = document.getElementById('dynamic-bookmarks-container');
                if (bmContainer) loadBookmarksPage(bmContainer);
            } else {
                if (eventsContainer) {
                    if (user) fetchGoogleData();
                    else fetchFirestoreOnly();
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
        if (!token) { fetchFirestoreOnly(); return; }
        
        eventsContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;"><i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...</div>';
        const now = new Date().toISOString();

        try {
            const [primaryEvents, birthdayEvents, tasks, publicEvents] = await Promise.all([
                fetchCalendarEvents(token, 'primary', now, 'green'),
                fetchCalendarEvents(token, 'addressbook#contacts@group.v.calendar.google.com', now, 'green'),
                fetchAllTaskLists(token, 'green'),
                fetchFirestoreEvents('blue') 
            ]);

            const rawItems = [...primaryEvents, ...birthdayEvents, ...tasks, ...publicEvents];
            
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
            uniqueItems.sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));

            window.globalEventsStore = uniqueItems;
            applyFilters();

        } catch (error) {
            console.error("Error:", error);
            eventsContainer.innerHTML = '<div style="padding:20px; text-align:center;">Error loading data.</div>';
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
        
        if (bms.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color:#888;">No bookmarks yet.</div>';
        } else {
            renderMixedItems(bms, container);
        }
    }

    // --- API Helpers ---
    async function fetchCalendarEvents(token, calendarId, timeMin, colorCategory) {
        try {
            const encodedId = encodeURIComponent(calendarId);
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?timeMin=${timeMin}&orderBy=startTime&singleEvents=true&maxResults=50`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) return [];
            const data = await response.json();
            return data.items.map(item => ({ type: 'Event', id: item.id, title: item.summary || "Untitled", description: item.description || "No description provided.", sortDate: item.start.dateTime || item.start.date, isAllDay: !item.start.dateTime, color: colorCategory }));
        } catch (e) { return []; }
    }
    async function fetchAllTaskLists(token, colorCategory) {
        try {
            const listResponse = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers: { 'Authorization': `Bearer ${token}` } });
            if(!listResponse.ok) return [];
            const listData = await listResponse.json();
            if(!listData.items) return [];
            const promises = listData.items.map(list => fetchTasksFromList(token, list.id, colorCategory));
            const results = await Promise.all(promises);
            return results.flat();
        } catch (e) { return []; }
    }
    async function fetchTasksFromList(token, listId, colorCategory) {
        try {
            const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=false&maxResults=20`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) return [];
            const data = await response.json();
            if (!data.items) return [];
            return data.items.map(item => ({ type: 'Task', id: item.id, title: item.title || "Untitled", description: item.notes || "No notes.", sortDate: item.due || new Date().toISOString(), isAllDay: true, color: colorCategory }));
        } catch (e) { return []; }
    }
    async function fetchFirestoreEvents(colorCategory) {
        try {
            const querySnapshot = await getDocs(collection(db, "public_events"));
            const events = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (new Date(data.date) >= new Date()) {
                    events.push({ type: 'Public', id: doc.id, title: data.title, description: data.description || "Public Event", sortDate: data.date, isAllDay: false, color: colorCategory, locType: data.locationType || 'text', locValue: data.locationValue || '' });
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
        const now = new Date(); now.setHours(0,0,0,0); 

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
                const matchesKeyword = currentFilters.keywords.some(key => lowerTitle.includes(key));
                if (!matchesKeyword) return false;
            }
            if (!currentFilters.showTasks && item.type === 'Task') return false;
            if (currentFilters.time !== 'all') {
                const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                const oneMonth = new Date(now); oneMonth.setMonth(now.getMonth() + 1);
                const oneYear = new Date(now); oneYear.setFullYear(now.getFullYear() + 1);
                if (currentFilters.time === 'week' && itemDate > oneWeek) return false;
                if (currentFilters.time === 'month' && itemDate > oneMonth) return false;
                if (currentFilters.time === 'year' && itemDate > oneYear) return false;
            }
            return true;
        });

        window.currentFilteredEvents = filtered;
        renderMixedItems(filtered, eventsContainer);

        if (document.getElementById('calendarGrid')) {
            renderCalendar(currentMonth, currentYear);
        }
    }

    // --- FILTER UI ---
    if(searchInput) { searchInput.addEventListener('input', (e) => { currentFilters.search = e.target.value.toLowerCase(); applyFilters(); }); }
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterType = item.dataset.filterType; 
            if (filterType === 'source') currentFilters.source = item.dataset.value;
            if (filterType === 'time') currentFilters.time = item.dataset.value;
            const menu = item.parentElement;
            menu.previousElementSibling.querySelector('span').innerText = item.innerText;
            menu.previousElementSibling.classList.remove('active'); menu.classList.remove('show');
            applyFilters();
        });
    });
    if(categoryChips) {
        categoryChips.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if(!btn || btn.classList.contains('filter-btn')) return;
            categoryChips.querySelectorAll('.chip:not(.filter-btn)').forEach(c => c.classList.remove('active')); btn.classList.add('active');
            currentFilters.category = btn.dataset.cat;
            currentFilters.categoryKeywords = btn.dataset.keywords ? btn.dataset.keywords.split(',') : [];
            filterShowTasks.checked = true;
            filterKeywords.value = "";
            currentFilters.showTasks = true;
            currentFilters.keywords = [];
            openFilterModalBtn.classList.remove('active');
            applyFilters();
        });
    }
    if(openFilterModalBtn) openFilterModalBtn.addEventListener('click', () => { document.getElementById('filter-modal-overlay').classList.add('show'); });
    if(closeFilterBtn) closeFilterBtn.addEventListener('click', () => { document.getElementById('filter-modal-overlay').classList.remove('show'); });
    if(applyFiltersBtn) applyFiltersBtn.addEventListener('click', () => {
        currentFilters.showTasks = filterShowTasks.checked;
        currentFilters.keywords = filterKeywords.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        if (!currentFilters.showTasks || currentFilters.keywords.length > 0) {
            categoryChips.querySelectorAll('.chip:not(.filter-btn)').forEach(c => c.classList.remove('active'));
            openFilterModalBtn.classList.add('active');
        } else {
            openFilterModalBtn.classList.remove('active');
            categoryChips.querySelector('[data-cat="all"]').classList.add('active');
        }
        document.getElementById('filter-modal-overlay').classList.remove('show'); applyFilters();
    });
    if(resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => {
        filterShowTasks.checked = true; filterKeywords.value = "";
        currentFilters.showTasks = true; currentFilters.keywords = [];
        openFilterModalBtn.classList.remove('active');
        categoryChips.querySelector('[data-cat="all"]').classList.add('active');
        document.getElementById('filter-modal-overlay').classList.remove('show'); applyFilters();
    });


    // ==========================================
    // 4. RENDERING & REMINDERS
    // ==========================================
    async function renderMixedItems(items, targetContainer) {
        if (!targetContainer) return;
        
        if (!items || items.length === 0) {
            targetContainer.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">No events found.</div>';
            return;
        }
        
        const bookmarkedEvents = await getBookmarks();
        const bookmarkedIds = new Set(bookmarkedEvents.map(b => b.id));

        let html = '';
        items.forEach(item => {
            const startDate = new Date(item.sortDate);
            const day = String(startDate.getDate()).padStart(2, '0');
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const year = startDate.getFullYear();
            const formattedDate = `${day}/${month}/${year}`;
            let formattedTime = item.isAllDay ? "" : " at " + startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const now = new Date();
            const diffMs = startDate - now;
            let days = 0, hours = 0;
            if (diffMs > 0) {
                days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            }
            const daysStr = days.toString().padStart(2, '0');
            const hoursStr = hours.toString().padStart(2, '0');
            const shortDesc = item.description.length > 50 ? item.description.substring(0, 50) + "..." : item.description;
            
            let iconHTML = '';
            if (item.type === 'Task') iconHTML = '<i class="fa-solid fa-square-check" style="color:#666; margin-right:6px;"></i> ';
            if (item.type === 'Public') iconHTML = '<i class="fa-solid fa-earth-americas" style="color:#569aff; margin-right:6px;"></i> ';
            const borderClass = item.color === 'blue' ? 'card-blue' : 'card-green';
            
            const safeTitle = encodeURIComponent(item.title);
            const safeDesc = encodeURIComponent(item.description);
            const safeDateStr = encodeURIComponent(formattedDate + formattedTime);
            const safeLocType = encodeURIComponent(item.locType || 'text');
            const safeLocValue = encodeURIComponent(item.locValue || '');

            const activeClass = bookmarkedIds.has(item.id) ? 'active' : '';
            // Change Icon to Bookmark (fa-bookmark)
            const iconClass = bookmarkedIds.has(item.id) ? 'fa-solid' : 'fa-regular';
            const itemJson = btoa(unescape(encodeURIComponent(JSON.stringify(item))));

            html += `
                <div class="event-card ${borderClass}">
                    <!-- BOOKMARK BUTTON -->
                    <button class="bookmark-btn ${activeClass}" data-event="${itemJson}" onclick="handleBookmarkClick(this, event)">
                        <i class="${iconClass} fa-bookmark"></i>
                    </button>

                    <!-- CLICKABLE AREA FOR MODAL -->
                    <div class="clickable-area" 
                         data-event="${itemJson}"
                         onclick="handleCardClick(this)"
                         style="cursor:pointer;">
                        
                        <div class="event-info">
                            <h3>${iconHTML}${item.title}</h3>
                            <p style="font-size: 13px; color: #666; margin-bottom: 4px;">${formattedDate}${formattedTime}</p>
                            <p>${shortDesc}</p>
                        </div>
                        <div class="countdown-box">
                            <div class="time-unit"><span class="time-num">${daysStr}</span><span class="time-label">DAYS</span></div>
                            <div class="divider">|</div>
                            <div class="time-unit"><span class="time-num">${hoursStr}</span><span class="time-label">HRS</span></div>
                        </div>
                    </div>
                </div>`;
        });
        targetContainer.innerHTML = html;
        
        checkReminders(bookmarkedEvents);
    }

    // --- CLICK HANDLERS ---
    window.handleBookmarkClick = async function(btn, e) {
        e.stopPropagation(); 
        const item = JSON.parse(decodeURIComponent(escape(atob(btn.dataset.event))));
        const isAdded = await toggleBookmark(item);
        const icon = btn.querySelector('i');
        if (isAdded) {
            btn.classList.add('active'); icon.classList.remove('fa-regular'); icon.classList.add('fa-solid');
        } else {
            btn.classList.remove('active'); icon.classList.add('fa-regular'); icon.classList.remove('fa-solid');
            if (window.location.pathname === '/bookmarks') btn.closest('.event-card').remove();
        }
    };

    window.handleCardClick = function(div) {
        const item = JSON.parse(decodeURIComponent(escape(atob(div.dataset.event))));
        const dt = new Date(item.sortDate);
        const day = String(dt.getDate()).padStart(2, '0');
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const year = dt.getFullYear();
        const dateStr = `${day}/${month}/${year}` + (item.isAllDay ? "" : " at " + dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));

        openModal(item.title, item.description, dateStr, item.sortDate, item.locType, item.locValue);
    };

    function checkReminders(bookmarkedEvents) {
        const user = auth.currentUser;
        if (!user || !user.email) return;
        const sentReminders = JSON.parse(localStorage.getItem("sentReminders") || "[]");
        bookmarkedEvents.forEach(item => {
            const now = new Date();
            const start = new Date(item.sortDate);
            const diffMs = start - now;
            const hoursLeft = diffMs / (1000 * 60 * 60);
            
            if (hoursLeft > 24 && hoursLeft < 26) {
                if (!sentReminders.includes(item.id)) {
                    fetch('/send-reminder', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ email: user.email, title: item.title, days: 1, hours: 1 })
                    });
                    sentReminders.push(item.id);
                    localStorage.setItem("sentReminders", JSON.stringify(sentReminders));
                }
            }
        });
    }

    // --- MODAL LOGIC ---
    window.openModal = function(title, desc, dateStr, rawIsoDate, locType, locValue) {
        if(!modalOverlay) return;
        modalTitle.innerText = decodeURIComponent(title);
        modalDesc.innerText = decodeURIComponent(desc) || "No description.";
        modalDate.innerText = decodeURIComponent(dateStr);
        const locContainer = document.getElementById('modal-location-container');
        if (locContainer) {
            locContainer.innerHTML = ""; 
            const dLocValue = decodeURIComponent(locValue);
            const dLocType = decodeURIComponent(locType);
            if (dLocType === 'map' && dLocValue && dLocValue !== 'undefined') {
                locContainer.innerHTML = `<iframe src="${dLocValue}" width="100%" height="250" style="border:0; border-radius:12px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
            } else if (dLocValue && dLocValue !== 'undefined' && dLocValue !== "") {
                locContainer.innerHTML = `<div style="background:#f5f5f5; padding:15px; border-radius:12px; font-size:14px; display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-location-dot" style="color:#569aff; font-size:18px;"></i><span>${dLocValue}</span></div>`;
            }
        }
        modalOverlay.classList.add('show');
        document.body.classList.add('modal-open');
        startLiveCountdown(rawIsoDate);
    }

    function startLiveCountdown(targetIsoDate) {
        if(countdownInterval) clearInterval(countdownInterval);
        const targetDate = new Date(targetIsoDate).getTime();
        const update = () => { const now = new Date().getTime(); const distance = targetDate - now; if (distance < 0) { elDays.innerText = "00"; elHours.innerText = "00"; elMins.innerText = "00"; elSecs.innerText = "00"; clearInterval(countdownInterval); return; } const d = Math.floor(distance / (1000 * 60 * 60 * 24)); const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const s = Math.floor((distance % (1000 * 60)) / 1000); elDays.innerText = String(d).padStart(2, '0'); elHours.innerText = String(h).padStart(2, '0'); elMins.innerText = String(m).padStart(2, '0'); elSecs.innerText = String(s).padStart(2, '0'); }; update(); countdownInterval = setInterval(update, 1000);
    }
    function closeModal() { if(modalOverlay) modalOverlay.classList.remove('show'); document.body.classList.remove('modal-open'); if(countdownInterval) clearInterval(countdownInterval); }
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal); if(modalOverlay) modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(); });

    function openDayModal(eventsForDay, dateString) {
        if(!dayModalOverlay) return;
        dayModalTitle.innerText = dateString; dayEventsList.innerHTML = ""; 
        if (eventsForDay.length === 0) { dayEventsList.innerHTML = `<div style="text-align:center; padding: 20px; color:#888;">No events for this day.</div>`; } else {
            eventsForDay.forEach(item => {
                const icon = item.type === 'Task' ? 'Task' : (item.type === 'Public' ? 'Public' : 'Event');
                const dt = new Date(item.sortDate); const timeStr = item.isAllDay ? "All Day" : dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); const safeDateStr = `${dateString} at ${timeStr}`; const colorBorder = item.color === 'blue' ? 'border-blue' : 'border-green';
                const div = document.createElement('div'); div.className = `day-event-item ${colorBorder}`; div.innerHTML = `<h4>${item.title}</h4><p>${timeStr} • ${icon}</p>`;
                div.addEventListener('click', () => { closeDayModal(); setTimeout(() => { openModal(encodeURIComponent(item.title), encodeURIComponent(item.description), encodeURIComponent(safeDateStr), item.sortDate, encodeURIComponent(item.locType), encodeURIComponent(item.locValue)); }, 300); });
                dayEventsList.appendChild(div);
            });
        }
        dayModalOverlay.classList.add('show'); document.body.classList.add('modal-open');
    }
    function closeDayModal() { if(dayModalOverlay) dayModalOverlay.classList.remove('show'); document.body.classList.remove('modal-open'); }
    if(closeDayBtn) closeDayBtn.addEventListener('click', closeDayModal); if(dayModalOverlay) dayModalOverlay.addEventListener('click', (e) => { if(e.target === dayModalOverlay) closeDayModal(); });

    // ==========================================
    // 5. CALENDAR RENDER LOGIC
    // ==========================================
    function renderCalendar(month, year) {
        const calendarGrid = document.getElementById('calendarGrid');
        if(!calendarGrid) return;
        
        calendarGrid.innerHTML = "";
        const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const daysInPrevMonth = new Date(year, month, 0).getDate();
        const today = new Date(); const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
        
        for (let i = firstDay; i > 0; i--) { const dayDiv = document.createElement('div'); dayDiv.classList.add('cal-day', 'other-month'); dayDiv.innerHTML = `<span class="day-number">${daysInPrevMonth - i + 1}</span>`; calendarGrid.appendChild(dayDiv); }
        for (let i = 1; i <= daysInMonth; i++) { 
            const dayDiv = document.createElement('div'); dayDiv.classList.add('cal-day'); 
            if (isCurrentMonth && i === today.getDate()) dayDiv.classList.add('today'); 
            dayDiv.innerHTML = `<span class="day-number">${i}</span>`;
            
            const dayEvents = window.currentFilteredEvents.filter(e => { const eDate = new Date(e.sortDate); return eDate.getDate() === i && eDate.getMonth() === month && eDate.getFullYear() === year; });
            
            if (dayEvents.length > 0) {
                const lineContainer = document.createElement('div'); lineContainer.className = "cal-event-container";
                dayEvents.slice(0, 3).forEach(e => { const line = document.createElement('div'); line.className = `cal-line ${e.color}`; lineContainer.appendChild(line); });
                if (dayEvents.length > 3) { const more = document.createElement('span'); more.style.fontSize = "10px"; more.style.color = "#888"; more.style.paddingLeft = "4px"; more.innerText = `+${dayEvents.length - 3}`; lineContainer.appendChild(more); }
                dayDiv.appendChild(lineContainer);
            }
            dayDiv.onclick = () => { openDayModal(dayEvents, `${i} ${months[month]} ${year}`); };
            calendarGrid.appendChild(dayDiv); 
        }
        const totalCells = firstDay + daysInMonth; const nextMonthDays = 42 - totalCells;
        for (let i = 1; i <= nextMonthDays; i++) { const dayDiv = document.createElement('div'); dayDiv.classList.add('cal-day', 'other-month'); dayDiv.innerHTML = `<span class="day-number">${i}</span>`; calendarGrid.appendChild(dayDiv); }
    }

    const btnListView = document.getElementById('btnListView');
    if (btnListView) {
        const btnCalendarView = document.getElementById('btnCalendarView');
        const listViewContent = document.getElementById('listViewContent');
        const calendarViewContent = document.getElementById('calendarViewContent');
        const timePeriodDropdown = document.getElementById('timePeriodDropdown');
        const calMonthSelect = document.getElementById('calMonthSelect');
        const calYearSelect = document.getElementById('calYearSelect');
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        const goToTodayBtn = document.getElementById('goToToday');

        function switchView(view) {
            if (view === 'list') {
                btnListView.classList.add('active'); btnCalendarView.classList.remove('active');
                calendarViewContent.style.opacity = '0';
                setTimeout(() => { calendarViewContent.classList.add('view-hidden'); listViewContent.classList.remove('view-hidden'); void listViewContent.offsetWidth; listViewContent.style.opacity = '1'; }, 200);
                if(timePeriodDropdown) timePeriodDropdown.style.display = 'inline-block';
            } else {
                btnCalendarView.classList.add('active'); btnListView.classList.remove('active');
                listViewContent.style.opacity = '0';
                setTimeout(() => { listViewContent.classList.add('view-hidden'); calendarViewContent.classList.remove('view-hidden'); void calendarViewContent.offsetWidth; calendarViewContent.style.opacity = '1'; renderCalendar(currentMonth, currentYear); }, 200);
                if(timePeriodDropdown) timePeriodDropdown.style.display = 'none';
            }
        }
        btnListView.addEventListener('click', () => switchView('list'));
        btnCalendarView.addEventListener('click', () => switchView('calendar'));

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

    if(logoutBtn) logoutBtn.addEventListener('click', (e) => { e.stopPropagation(); localStorage.removeItem('isOrbitGuest'); localStorage.removeItem('googleCalendarToken'); signOut(auth).then(() => { window.location.href = '/'; }); });
    if(profileBtn) profileBtn.addEventListener('click', (e) => { e.stopPropagation(); profileMenu.classList.toggle('show'); });
    if(navIcon) navIcon.addEventListener('click', (e) => { e.stopPropagation(); sideMenu.classList.add('show'); sideMenuOverlay.classList.add('show'); });
    const closeSideMenuFn = () => { sideMenu.classList.remove('show'); sideMenuOverlay.classList.remove('show'); }
    if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeSideMenuFn); if(sideMenuOverlay) sideMenuOverlay.addEventListener('click', closeSideMenuFn);
    document.querySelectorAll('.dropdown-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); document.querySelectorAll('.dropdown-menu.show').forEach(m => { if(m !== btn.nextElementSibling) { m.classList.remove('show'); m.previousElementSibling.classList.remove('active'); }}); const menu = btn.nextElementSibling; btn.classList.toggle('active'); menu.classList.toggle('show'); }); });
    document.addEventListener('click', () => { if(profileMenu) profileMenu.classList.remove('show'); document.querySelectorAll('.dropdown-menu').forEach(m => { m.classList.remove('show'); m.previousElementSibling.classList.remove('active'); }); });
});