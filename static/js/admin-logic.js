import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, provider, app } from "/static/js/firebase-config.js";

const db = getFirestore(app);
let adminEventsById = new Map();

// *** IMPORTANT: REPLACE WITH YOUR EXACT GOOGLE EMAIL ***
const ADMIN_EMAIL = "roose1209souza@gmail.com";

document.addEventListener("DOMContentLoaded", () => {
  // Sections
  const adminPanel = document.getElementById("admin-panel");
  const authWarning = document.getElementById("auth-warning");
  const loginContainer = document.getElementById("admin-login-container");

  // Buttons
  const addBtn = document.getElementById("addBtn");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  const warningLogoutBtn = document.getElementById("warningLogoutBtn");
  const adminBackLink = document.getElementById("adminBackLink");
  const listDiv = document.getElementById("cms-list");
  const dateInput = document.getElementById("evtDate");

  // Event details: delegated click handling so dynamic cards always work.
  if (listDiv) {
    listDiv.addEventListener("click", (e) => {
      if (e.target.closest(".btn-delete") || e.target.closest(".event-actions")) return;
      const card = e.target.closest(".event-item");
      if (!card) return;
      const eventId = card.getAttribute("data-id");
      const eventData = adminEventsById.get(eventId);
      if (eventData) showEventDetailsModal(eventData);
    });
  }

  // Toggle Elements
  const radios = document.getElementsByName("locType");
  const groupText = document.getElementById("group-loc-text");
  const groupMap = document.getElementById("group-loc-map");

  let datePicker = null;
  if (dateInput && typeof window.flatpickr === "function") {
    datePicker = window.flatpickr(dateInput, {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      altInput: true,
      altFormat: "F j, Y h:i K",
      minDate: "today",
      time_24hr: false,
    });
  }

  // 1. Auth Check
  onAuthStateChanged(auth, (user) => {
    adminPanel.style.display = "none";
    authWarning.style.display = "none";
    loginContainer.style.display = "none";
    if (adminLogoutBtn) adminLogoutBtn.style.display = "none";
    if (adminBackLink) adminBackLink.style.display = user ? "inline-flex" : "none";

    if (user) {
      if (adminLogoutBtn) adminLogoutBtn.style.display = "inline-flex";
      if (user.email === ADMIN_EMAIL) {
        adminPanel.style.display = "block";
        loadEvents();
      } else {
        authWarning.style.display = "block";
      }
    } else {
      loginContainer.style.display = "block";
    }
  });

  // 2. Login Handler
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", async () => {
      try {
        provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
        provider.addScope('https://www.googleapis.com/auth/tasks.readonly');
        provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' });

        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential && credential.accessToken) {
          localStorage.setItem('googleCalendarToken', credential.accessToken);
        }
      } catch (e) {
        showToast("Login failed: " + e.message, "danger");
      }
    });
  }

  // 3. Logout Handler
  [adminLogoutBtn, warningLogoutBtn].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      signOut(auth).finally(() => {
        window.location.href = "/";
      });
    });
  });

  // 4. Toggle Logic
  radios.forEach((radio) => {
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

  // 5. Add Event
  addBtn.addEventListener("click", async () => {
    const title = document.getElementById("evtTitle").value;
    const desc = document.getElementById("evtDesc").value;
    const date = dateInput ? dateInput.value : "";

    let locType = "text";
    let locValue = "";

    if (document.querySelector('input[name="locType"]:checked').value === "map") {
      locType = "map";
      const rawInput = document.getElementById("evtLocMap").value;
      const srcMatch = rawInput.match(/src="([^"]+)"/);
      locValue = srcMatch ? srcMatch[1] : rawInput;
    } else {
      locType = "text";
      locValue = document.getElementById("evtLocText").value;
    }

    if (!title || !date) {
      showToast("Title and Date are required!", "danger");
      return;
    }

    addBtn.disabled = true;
    addBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

    try {
      await addDoc(collection(db, "public_events"), {
        title: title,
        description: desc,
        date: new Date(date).toISOString(),
        type: "public",
        locationType: locType,
        locationValue: locValue,
      });

      showToast("Event published successfully!", "success");

      // Clear form
      document.getElementById("evtTitle").value = "";
      document.getElementById("evtDesc").value = "";
      if (datePicker) {
        datePicker.clear();
      } else if (dateInput) {
        dateInput.value = "";
      }
      document.getElementById("evtLocText").value = "";
      document.getElementById("evtLocMap").value = "";

      loadEvents();
    } catch (e) {
      console.error("Error:", e);
      showToast("Error adding event: " + e.message, "danger");
    } finally {
      addBtn.disabled = false;
      addBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Event';
    }
  });

  // 6. Load Events
  async function loadEvents() {
    listDiv.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading events...</p>
      </div>
    `;

    try {
      const querySnapshot = await getDocs(collection(db, "public_events"));
      const events = [];

      querySnapshot.forEach((docSnap) => {
        events.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      // Sort by date (newest first)
      events.sort((a, b) => new Date(b.date) - new Date(a.date));
      adminEventsById = new Map(events.map((event) => [event.id, event]));

      // Update event count
      updateEventCount(events.length);

      if (events.length === 0) {
        listDiv.innerHTML = `
          <div class="empty-state">
            <i class="fa-regular fa-calendar-xmark"></i>
            <h4>No events yet</h4>
            <p>Create your first public event using the form above.</p>
          </div>
        `;
      } else {
        listDiv.innerHTML = events.map((event) => renderEventCard(event)).join("");
        attachDeleteListeners();
      }
    } catch (e) {
      console.error("Error loading events:", e);
      listDiv.innerHTML = `
        <div class="empty-state" style="border-color: #fecaca;">
          <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>
          <h4>Error loading events</h4>
          <p>${e.message}</p>
        </div>
      `;
    }
  }

  function showEventDetailsModal(eventData) {
    const existingModal = document.getElementById("details-modal");
    if (existingModal) existingModal.remove();

    const eventDate = new Date(eventData.date);
    const readableDate = eventDate.toLocaleString("default", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const getMapSrc = (raw) => {
      const value = String(raw || "").trim();
      const srcMatch = value.match(/src="([^"]+)"/i);
      const src = srcMatch ? srcMatch[1] : value;
      return /^https?:\/\//i.test(src) ? src : "";
    };

    const mapSrc = eventData.locationType === "map" ? getMapSrc(eventData.locationValue) : "";
    const locationHtml = mapSrc
      ? `<iframe src="${mapSrc}" width="100%" height="240" style="border:0; border-radius:12px;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
      : `<div class="details-location-text"><i class="fa-solid fa-location-dot"></i><span>${escapeHtml(eventData.locationValue || "No location provided")}</span></div>`;

    const modal = document.createElement("div");
    modal.id = "details-modal";
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content details-modal-content">
          <button class="details-close-btn" id="details-close-btn" aria-label="Close details">&times;</button>
          <h3 class="details-title">${escapeHtml(eventData.title || "Untitled Event")}</h3>
          <div class="details-meta"><i class="fa-regular fa-clock"></i> ${readableDate}</div>
          <div class="details-section">
            <h4>Description</h4>
            <p>${escapeHtml(eventData.description || "No description provided.")}</p>
          </div>
          <div class="details-section">
            <h4>Location</h4>
            ${locationHtml}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("show"));

    document.getElementById("details-close-btn").addEventListener("click", () => {
      closeModal(modal);
    });

    modal.querySelector(".modal-overlay").addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        closeModal(modal);
      }
    });

    const escHandler = (e) => {
      if (e.key === "Escape") {
        closeModal(modal);
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }

  // 7. Render Event Card
  function renderEventCard(event) {
    const date = new Date(event.date);
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "short" });
    const year = date.getFullYear();
    const time = date.toLocaleString("default", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const isUpcoming = date > new Date();
    const locationDisplay = event.locationType === "map" ? "Map Location" : event.locationValue || "No location";
    const locationIcon = event.locationType === "map" ? "fa-map-location-dot" : "fa-location-dot";

    return `
      <div class="event-item" data-id="${event.id}">
        <div class="event-date-badge">
          <div class="day">${day}</div>
          <div class="month">${month}</div>
        </div>
        <div class="event-info">
          <h4>
            ${escapeHtml(event.title)}
            <span class="tag ${isUpcoming ? "tag-upcoming" : "tag-past"}">
              ${isUpcoming ? "Upcoming" : "Past"}
            </span>
            <span class="tag" style="background: #f0f0f0; color: #666;">
              ${event.locationType === "map" ? "📍 Map" : "📝 Text"}
            </span>
          </h4>
          <div class="event-meta">
            <span><i class="fa-regular fa-clock"></i> ${time}</span>
            <span><i class="fa-solid ${locationIcon}"></i> ${escapeHtml(locationDisplay)}</span>
            <span><i class="fa-regular fa-calendar"></i> ${year}</span>
          </div>
          ${event.description ? `<p style="margin-top: 8px; font-size: 13px; color: #64748b;">${escapeHtml(event.description)}</p>` : ""}
        </div>
        <div class="event-actions">
          <button class="btn-icon btn-icon-danger btn-delete" data-id="${event.id}" data-title="${escapeHtml(event.title)}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  // 8. Attach Delete Listeners - THIS IS THE KEY FUNCTION
  function attachDeleteListeners() {
    const deleteButtons = document.querySelectorAll(".btn-delete");
    
    deleteButtons.forEach((btn) => {
      // Remove any existing listeners first
      btn.replaceWith(btn.cloneNode(true));
    });

    // Re-select after cloning
    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const eventId = this.getAttribute("data-id");
        const eventTitle = this.getAttribute("data-title");
        
        console.log("Delete clicked for:", eventId, eventTitle); // Debug log
        
        showDeleteModal(eventId, eventTitle);
      });
    });
  }

  // 9. Show Delete Modal
  function showDeleteModal(eventId, eventTitle) {
    // Remove existing modal
    const existingModal = document.getElementById("delete-modal");
    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");
    modal.id = "delete-modal";
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-icon">
            <i class="fa-solid fa-trash"></i>
          </div>
          <h3>Delete Event?</h3>
          <p>Are you sure you want to delete this event? This action cannot be undone.</p>
          <div class="modal-event-name">${eventTitle}</div>
          <div class="modal-actions">
            <button class="btn-modal btn-modal-cancel" id="modal-cancel">Cancel</button>
            <button class="btn-modal btn-modal-danger" id="modal-confirm">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => {
      modal.classList.add("show");
    });

    // Cancel button
    document.getElementById("modal-cancel").addEventListener("click", () => {
      closeModal(modal);
    });

    // Confirm delete
    document.getElementById("modal-confirm").addEventListener("click", async () => {
      await handleDelete(eventId, modal);
    });

    // Click overlay to close
    modal.querySelector(".modal-overlay").addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        closeModal(modal);
      }
    });

    // ESC key to close
    const escHandler = (e) => {
      if (e.key === "Escape") {
        closeModal(modal);
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }

  // 10. Handle Delete
  async function handleDelete(eventId, modal) {
    const confirmBtn = document.getElementById("modal-confirm");
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
    confirmBtn.disabled = true;

    try {
      // Delete from Firebase
      await deleteDoc(doc(db, "public_events", eventId));

      // Animate out the event card
      const eventItem = document.querySelector(`.event-item[data-id="${eventId}"]`);
      if (eventItem) {
        eventItem.style.transform = "translateX(100%)";
        eventItem.style.opacity = "0";
        eventItem.style.transition = "all 0.3s ease";

        setTimeout(() => {
          eventItem.remove();

          // Update count
          const remaining = document.querySelectorAll(".event-item").length;
          updateEventCount(remaining);

          // Show empty state if no events
          if (remaining === 0) {
            listDiv.innerHTML = `
              <div class="empty-state">
                <i class="fa-regular fa-calendar-xmark"></i>
                <h4>No events yet</h4>
                <p>Create your first public event using the form above.</p>
              </div>
            `;
          }
        }, 300);
      }

      closeModal(modal);
      showToast("Event deleted successfully!", "success");

    } catch (e) {
      console.error("Delete error:", e);
      showToast("Error deleting event: " + e.message, "danger");
      confirmBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
      confirmBtn.disabled = false;
    }
  }

  // 11. Close Modal
  function closeModal(modal) {
    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 200);
  }

  // 12. Update Event Count
  function updateEventCount(count) {
    const eventCountEl = document.getElementById("event-count");
    if (eventCountEl) {
      eventCountEl.textContent = `${count} event${count !== 1 ? "s" : ""}`;
    }
  }

  // 13. Toast Notification
  function showToast(message, type = "success") {
    const existingToast = document.getElementById("toast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.className = `toast toast-${type}`;

    const icon =
      type === "success"
        ? "fa-check-circle"
        : type === "danger"
        ? "fa-times-circle"
        : "fa-info-circle";

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // 14. Escape HTML
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});