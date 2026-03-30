import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, app } from "/static/js/firebase-config.js";
import { toggleBookmark, isBookmarked } from "/static/js/bookmarks-logic.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODE_DELAY_MS = 1100;

let countdownTimer = null;
let bookmarkEnabled = false;
let currentDetailBookmarkPayload = null;
let bookmarkSyncToken = 0;

function extractMapSrc(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";
    const srcMatch = raw.match(/src=\"([^\"]+)\"/i);
    const src = srcMatch ? srcMatch[1] : raw;
    return /^https?:\/\//i.test(src) ? src : "";
}

function extractLatLng(mapSrc) {
    const value = String(mapSrc || "");

    const pairPatternA = value.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i);
    if (pairPatternA) {
        return { lat: parseFloat(pairPatternA[2]), lng: parseFloat(pairPatternA[1]) };
    }

    const pairPatternB = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
    if (pairPatternB) {
        return { lat: parseFloat(pairPatternB[1]), lng: parseFloat(pairPatternB[2]) };
    }

    try {
        const parsed = new URL(value);
        const center = parsed.searchParams.get("center") || "";
        const q = parsed.searchParams.get("q") || "";
        const queryValue = center || q;
        const coordMatch = queryValue.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (coordMatch) {
            return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
        }
    } catch (_) {
        return null;
    }

    return null;
}

function extractAddressQuery(mapSrc) {
    try {
        const parsed = new URL(mapSrc);
        const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || "";
        if (!q) return "";
        return decodeURIComponent(q).trim();
    } catch (_) {
        return "";
    }
}

function formatEventDate(rawIso) {
    const date = new Date(rawIso);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return date.toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function startCountdown(targetIso) {
    const daysEl = document.getElementById("exploreCdDays");
    const hoursEl = document.getElementById("exploreCdHours");
    const minutesEl = document.getElementById("exploreCdMinutes");
    const secondsEl = document.getElementById("exploreCdSeconds");

    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;
    if (countdownTimer) clearInterval(countdownTimer);

    const targetTime = new Date(targetIso).getTime();
    const update = () => {
        const now = Date.now();
        const diff = targetTime - now;
        if (diff <= 0) {
            daysEl.textContent = "00";
            hoursEl.textContent = "00";
            minutesEl.textContent = "00";
            secondsEl.textContent = "00";
            clearInterval(countdownTimer);
            countdownTimer = null;
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        daysEl.textContent = String(d).padStart(2, "0");
        hoursEl.textContent = String(h).padStart(2, "0");
        minutesEl.textContent = String(m).padStart(2, "0");
        secondsEl.textContent = String(s).padStart(2, "0");
    };

    update();
    countdownTimer = setInterval(update, 1000);
}

function renderDetails(eventData) {
    const emptyState = document.getElementById("exploreMapEmptyState");
    const detailCard = document.getElementById("exploreMapDetailCard");

    if (!detailCard || !emptyState) return;

    const titleEl = document.getElementById("exploreDetailTitle");
    const dateEl = document.getElementById("exploreDetailDate");
    const descEl = document.getElementById("exploreDetailDesc");
    const locationEl = document.getElementById("exploreDetailLocation");
    const ticketEl = document.getElementById("exploreDetailTicket");
    const bookmarkBtn = document.getElementById("exploreDetailBookmarkBtn");

    const mapSrc = eventData.mapSrc || "";
    const latLng = eventData.latLng || null;
    const safeTitle = String(eventData.title || "").trim() || "Untitled Event";
        currentDetailBookmarkPayload = {
            id: eventData.id,
            title: safeTitle,
            description: eventData.description || "No description provided.",
            sortDate: eventData.date,
            type: "Public",
            color: "blue",
            isAllDay: false,
            locType: "map",
            locValue: eventData.mapSrc || "",
            ticketUrl: eventData.ticketUrl || "",
            images: []
        };

    const googleMapsHref = latLng
        ? `https://www.google.com/maps/search/?api=1&query=${latLng.lat},${latLng.lng}`
        : mapSrc;

    titleEl.textContent = safeTitle;
    dateEl.textContent = formatEventDate(eventData.date);
    descEl.textContent = eventData.description || "No description provided.";

    if (locationEl) {
        locationEl.innerHTML = googleMapsHref
            ? `<a class="explore-location-link" href="${googleMapsHref}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-location-dot"></i><span>Open location in Google Maps</span></a>`
            : "";
    }

    const ticketUrl = /^https?:\/\//i.test(String(eventData.ticketUrl || "").trim())
        ? String(eventData.ticketUrl).trim()
        : "";
    if (ticketEl) {
        ticketEl.innerHTML = ticketUrl
            ? `<a href="${ticketUrl}" target="_blank" rel="noopener noreferrer" class="gcal-add-btn" style="background:#fff7ed;color:#9a3412;border:1px solid #fdba74;"><i class="fa-solid fa-ticket" style="margin-right:8px;"></i>Book Tickets</a>`
            : "";
    }

    emptyState.classList.add("is-hidden");
    detailCard.classList.remove("is-hidden");
    detailCard.setAttribute("aria-hidden", "false");

    startCountdown(eventData.date);

    if (bookmarkBtn) {
        if (!bookmarkEnabled || !currentDetailBookmarkPayload?.id) {
            bookmarkBtn.hidden = true;
            bookmarkBtn.classList.remove("active");
            const icon = bookmarkBtn.querySelector("i");
            if (icon) {
                icon.classList.add("fa-regular");
                icon.classList.remove("fa-solid");
            }
            return;
        }

        bookmarkBtn.hidden = false;
        const syncId = ++bookmarkSyncToken;
        isBookmarked(currentDetailBookmarkPayload.id)
            .then((bookmarked) => {
                if (syncId !== bookmarkSyncToken) return;
                bookmarkBtn.classList.toggle("active", bookmarked);
                const icon = bookmarkBtn.querySelector("i");
                if (icon) {
                    icon.classList.toggle("fa-solid", bookmarked);
                    icon.classList.toggle("fa-regular", !bookmarked);
                }
            })
            .catch(() => {
                // Keep default icon state if lookup fails.
            });
    }
}

function showFallback(message) {
    const fallback = document.getElementById("exploreMapFallback");
    if (!fallback) return;
    fallback.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>${escapeHtml(message)}</span>`;
    fallback.hidden = false;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeAddressFree(address) {
    const q = String(address || "").trim();
    if (!q) return null;

    const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json"
            }
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!Array.isArray(data) || !data[0]) return null;
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return { lat, lng };
    } catch (_) {
        return null;
    }
}

async function buildMappedEvents(db) {
    const snapshot = await getDocs(collection(db, "public_events"));
    const nowMs = Date.now();

    const rawEvents = [];
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.locationType !== "map") return;

        const eventDate = new Date(data.date);
        if (Number.isNaN(eventDate.getTime())) return;
        if (eventDate.getTime() < nowMs) return;

        const mapSrc = extractMapSrc(data.locationValue);
        if (!mapSrc) return;

        rawEvents.push({
            id: docSnap.id,
            title: data.title || "Untitled Event",
            description: data.description || "No description provided.",
            date: data.date,
            mapSrc,
            ticketUrl: data.ticketUrl || ""
        });
    });

    rawEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    const mapped = [];
    for (const item of rawEvents) {
        let latLng = extractLatLng(item.mapSrc);
        if (!latLng) {
            const addressQuery = extractAddressQuery(item.mapSrc);
            if (addressQuery) {
                latLng = await geocodeAddressFree(addressQuery);
                await sleep(GEOCODE_DELAY_MS);
            }
        }

        if (!latLng) continue;
        mapped.push({ ...item, latLng });
    }

    return mapped;
}

document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("explore-map-view");
    const mapCanvas = document.getElementById("exploreMapCanvas");
    const bookmarkBtn = document.getElementById("exploreDetailBookmarkBtn");

    if (!root || !mapCanvas) return;

    const db = getFirestore(app);
    const isGuest = localStorage.getItem("isOrbitGuest") === "true";

    if (bookmarkBtn) {
        bookmarkBtn.addEventListener("click", async () => {
            if (!bookmarkEnabled || !currentDetailBookmarkPayload) return;

            const added = await toggleBookmark(currentDetailBookmarkPayload);
            bookmarkBtn.classList.toggle("active", added);
            const icon = bookmarkBtn.querySelector("i");
            if (icon) {
                icon.classList.toggle("fa-solid", added);
                icon.classList.toggle("fa-regular", !added);
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        bookmarkEnabled = Boolean(user) && !isGuest;
        if (!user && !isGuest) {
            window.location.href = "/";
            return;
        }

        if (!window.L) {
            showFallback("Map library could not load. Please refresh the page.");
            return;
        }

        try {
            const mappedEvents = await buildMappedEvents(db);

            if (!mappedEvents.length) {
                showFallback("No events with usable map locations were found.");
                return;
            }

            const map = window.L.map(mapCanvas, {
                center: [mappedEvents[0].latLng.lat, mappedEvents[0].latLng.lng],
                zoom: 6,
                zoomControl: true,
                dragging: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: true,
                keyboard: true,
                touchZoom: true,
                tap: true
            });

            window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            const bounds = window.L.latLngBounds([]);
            let activeMarker = null;

            mappedEvents.forEach((eventData, index) => {
                const latLng = [eventData.latLng.lat, eventData.latLng.lng];
                const marker = window.L.marker(latLng, {
                    title: eventData.title
                }).addTo(map);

                marker.bindTooltip(String(eventData.title || "Event"), {
                    permanent: true,
                    direction: "top",
                    offset: [0, -12],
                    className: "explore-map-marker-label"
                });

                bounds.extend(latLng);

                marker.on("click", () => {
                    if (activeMarker && activeMarker !== marker) {
                        activeMarker.setZIndexOffset(0);
                    }

                    marker.setZIndexOffset(1000);
                    activeMarker = marker;

                    map.panTo(latLng);
                    if (map.getZoom() < 11) map.setZoom(11);
                    renderDetails(eventData);
                });
            });

            map.fitBounds(bounds);
            if (mappedEvents.length === 1) {
                map.setZoom(13);
            }
        } catch (error) {
            console.error(error);
            showFallback("Could not load the map right now. Please try again later.");
        }
    });
});
