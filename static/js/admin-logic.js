import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, app } from "/static/js/firebase-config.js";

const db = getFirestore(app);

// REPLACE WITH YOUR EMAIL
const ADMIN_EMAIL = "roose1209souza@gmail.com"; 

document.addEventListener("DOMContentLoaded", () => {
    const adminPanel = document.getElementById("admin-panel");
    const authWarning = document.getElementById("auth-warning");
    const addBtn = document.getElementById("addBtn");
    const listDiv = document.getElementById("cms-list");

    // Toggle Elements
    const radios = document.getElementsByName("locType");
    const groupText = document.getElementById("group-loc-text");
    const groupMap = document.getElementById("group-loc-map");

    // 1. Auth Check
    onAuthStateChanged(auth, (user) => {
        if (user && user.email === ADMIN_EMAIL) {
            adminPanel.style.display = "block";
            loadEvents();
        } else {
            authWarning.style.display = "block";
            authWarning.innerText = "Access Denied: You must be logged in as the specific Admin.";
        }
    });

    // 2. Handle Toggle Logic
    radios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            if (e.target.value === "text") {
                groupText.style.display = "block";
                groupMap.style.display = "none";
            } else {
                groupText.style.display = "none";
                groupMap.style.display = "block";
            }
        });
    });

    // 3. Add Event
    addBtn.addEventListener("click", async () => {
        const title = document.getElementById("evtTitle").value;
        const desc = document.getElementById("evtDesc").value;
        const date = document.getElementById("evtDate").value;
        
        // Determine Location Data
        let locType = "text";
        let locValue = "";
        
        if (document.querySelector('input[name="locType"]:checked').value === "map") {
            locType = "map";
            const rawInput = document.getElementById("evtLocMap").value;
            // Helper: If user pastes full <iframe> tag, extract the src URL
            const srcMatch = rawInput.match(/src="([^"]+)"/);
            locValue = srcMatch ? srcMatch[1] : rawInput; 
        } else {
            locType = "text";
            locValue = document.getElementById("evtLocText").value;
        }

        if(!title || !date) return alert("Title and Date required");

        try {
            await addDoc(collection(db, "public_events"), {
                title: title,
                description: desc,
                date: new Date(date).toISOString(),
                type: "public",
                locationType: locType,
                locationValue: locValue
            });
            alert("Event Published!");
            location.reload();
        } catch (e) {
            console.error("Error:", e);
            alert("Error adding document");
        }
    });

    // 4. Load Events
    async function loadEvents() {
        listDiv.innerHTML = "";
        const querySnapshot = await getDocs(collection(db, "public_events"));
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement("div");
            div.className = "event-item";
            div.innerHTML = `
                <div>
                    <strong>${data.title}</strong> <span style="font-size:12px; color:blue;">(${data.locationType})</span><br>
                    <small>${new Date(data.date).toLocaleString()}</small>
                </div>
                <div class="delete-btn" data-id="${docSnap.id}">Delete</div>
            `;
            listDiv.appendChild(div);
        });

        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if(confirm("Delete this event?")) {
                    await deleteDoc(doc(db, "public_events", e.target.dataset.id));
                    loadEvents();
                }
            });
        });
    }
});