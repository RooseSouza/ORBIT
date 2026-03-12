import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, app } from "/static/js/firebase-config.js";


const db = getFirestore(app);

// --- TOGGLE BOOKMARK ---
export async function toggleBookmark(eventData) {
    const user = auth.currentUser;
    const eventId = eventData.id;

    if (user) {
        // FIRESTORE (Logged In)
        const userRef = doc(db, "users", user.uid);
        
        // Check if exists, if not create
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            await setDoc(userRef, { bookmarks: [] });
        }

        const currentBookmarks = docSnap.exists() ? (docSnap.data().bookmarks || []) : [];
        const exists = currentBookmarks.some(b => b.id === eventId);

        if (exists) {
            // Remove
            // Firestore arrayRemove only works with exact object match, which is tricky.
            // Better to filter and update.
            const newBookmarks = currentBookmarks.filter(b => b.id !== eventId);
            await updateDoc(userRef, { bookmarks: newBookmarks });
            return false; // Removed
        } else {
            // Add
            await updateDoc(userRef, { bookmarks: arrayUnion(eventData) });
            return true; // Added
        }

    } else {
        // LOCAL STORAGE (Guest)
        let bookmarks = JSON.parse(localStorage.getItem("orbitGuestBookmarks") || "[]");
        const exists = bookmarks.some(b => b.id === eventId);

        if (exists) {
            bookmarks = bookmarks.filter(b => b.id !== eventId);
            localStorage.setItem("orbitGuestBookmarks", JSON.stringify(bookmarks));
            return false;
        } else {
            bookmarks.push(eventData);
            localStorage.setItem("orbitGuestBookmarks", JSON.stringify(bookmarks));
            return true;
        }
    }
}

// --- GET ALL BOOKMARKS ---
export async function getBookmarks() {
    const user = auth.currentUser;
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            // Filter out past events
            const all = docSnap.data().bookmarks || [];
            const valid = all.filter(e => new Date(e.sortDate) >= new Date());
            
            // If we filtered some out, update DB to clean up
            if (all.length !== valid.length) {
                updateDoc(doc(db, "users", user.uid), { bookmarks: valid });
            }
            return valid;
        }
        return [];
    } else {
        let bookmarks = JSON.parse(localStorage.getItem("orbitGuestBookmarks") || "[]");
        // Filter past
        const valid = bookmarks.filter(e => new Date(e.sortDate) >= new Date());
        localStorage.setItem("orbitGuestBookmarks", JSON.stringify(valid));
        return valid;
    }
}

// --- CHECK IF BOOKMARKED ---
export async function isBookmarked(eventId) {
    const list = await getBookmarks();
    return list.some(b => b.id === eventId);
}

// --- UPDATE REMINDER TIME FOR A BOOKMARK ---
export async function updateBookmarkReminder(eventId, reminderMinutes) {
    const user = auth.currentUser;
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return;
        const updated = (docSnap.data().bookmarks || []).map(b =>
            b.id === eventId ? { ...b, reminderMinutes } : b
        );
        await updateDoc(userRef, { bookmarks: updated });
    } else {
        let bookmarks = JSON.parse(localStorage.getItem("orbitGuestBookmarks") || "[]");
        bookmarks = bookmarks.map(b => b.id === eventId ? { ...b, reminderMinutes } : b);
        localStorage.setItem("orbitGuestBookmarks", JSON.stringify(bookmarks));
    }
}