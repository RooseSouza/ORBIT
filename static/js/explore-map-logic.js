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

function getStartDate(item) {
    return new Date(item?.date || item?.sortDate || Date.now());
}

function getEndDate(item) {
    if (item?.endDate) {
        const parsed = new Date(item.endDate);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const start = getStartDate(item);
    return new Date(start.getTime() + 60 * 60 * 1000);
}

function isEventLive(item) {
    const now = Date.now();
    const startMs = getStartDate(item).getTime();
    const endMs = getEndDate(item).getTime();
    return now >= startMs && now < endMs;
}

function extractMapSrc(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";
    const srcMatch = raw.match(/src=["']([^"']+)["']/i);
    const src = srcMatch ? srcMatch[1] : raw;
    const normalizedSrc = src.replace(/&amp;/gi, "&");
    return /^https?:\/\//i.test(normalizedSrc) ? normalizedSrc : "";
}

function extractLatLng(mapSrc) {
    const value = String(mapSrc || "");

    const toLatLng = (latRaw, lngRaw) => {
        const lat = parseFloat(latRaw);
        const lng = parseFloat(lngRaw);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { lat, lng };
    };

    const fromLastMatch = (pattern, toLatIndex, toLngIndex) => {
        const matches = Array.from(value.matchAll(pattern));
        for (let i = matches.length - 1; i >= 0; i -= 1) {
            const candidate = toLatLng(matches[i][toLatIndex], matches[i][toLngIndex]);
            if (candidate) return candidate;
        }
        return null;
    };

    // Prefer explicit coordinates in URL query/path before parsing encoded embed blobs.
    try {
        const parsed = new URL(value);
        const center = parsed.searchParams.get("center") || "";
        const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || "";
        const queryValue = center || q;
        const queryCoords = queryValue.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (queryCoords) {
            const direct = toLatLng(queryCoords[1], queryCoords[2]);
            if (direct) return direct;
        }

        const pathDecoded = decodeURIComponent(parsed.pathname);
        const atCoords = pathDecoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (atCoords) {
            const direct = toLatLng(atCoords[1], atCoords[2]);
            if (direct) return direct;
        }
    } catch (_) {
        // Fall through to token parsing for non-standard or partial URLs.
    }

    const pairPatternB = fromLastMatch(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/gi, 1, 2);
    if (pairPatternB) return pairPatternB;

    const pairPatternA = fromLastMatch(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/gi, 2, 1);
    if (pairPatternA) return pairPatternA;

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

function getDisplayImageUrls(images) {
    const list = Array.isArray(images) ? images : [];
    const out = [];
    const seen = new Set();

    for (const raw of list) {
        const url = String(raw || "").trim();
        if (!url) continue;
        if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        out.push(url);
    }

    return out.slice(0, 8);
}

function startCountdown(targetIso, endIso = null) {
    const daysEl = document.getElementById("exploreCdDays");
    const hoursEl = document.getElementById("exploreCdHours");
    const minutesEl = document.getElementById("exploreCdMinutes");
    const secondsEl = document.getElementById("exploreCdSeconds");
    const primaryEl = document.getElementById("exploreCountdownPrimary");
    const secondaryEl = document.getElementById("exploreCountdownSecondary");

    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;
    if (countdownTimer) clearInterval(countdownTimer);

    const targetTime = new Date(targetIso).getTime();
    const fallbackEnd = targetTime + 60 * 60 * 1000;
    const parsedEnd = endIso ? new Date(endIso).getTime() : fallbackEnd;
    const endTime = Number.isFinite(parsedEnd) ? parsedEnd : fallbackEnd;

    const update = () => {
        const now = Date.now();
        const liveNow = now >= targetTime && now < endTime;
        const diff = (liveNow ? endTime : targetTime) - now;

        if (primaryEl) {
            primaryEl.textContent = liveNow ? "Event is LIVE" : "Event Starts In:";
            primaryEl.classList.toggle("live-text", liveNow);
        }
        if (secondaryEl) {
            secondaryEl.style.display = liveNow ? "block" : "none";
        }

        if (diff <= 0) {
            daysEl.textContent = "00";
            hoursEl.textContent = "00";
            minutesEl.textContent = "00";
            secondsEl.textContent = "00";
            if (primaryEl) {
                primaryEl.textContent = "Event Ended";
                primaryEl.classList.remove("live-text");
            }
            if (secondaryEl) {
                secondaryEl.style.display = "none";
            }
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
    const imagesEl = document.getElementById("exploreDetailImages");
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
        endDate: eventData.endDate || null,
        type: "Public",
        color: "blue",
        isAllDay: false,
        locType: eventData.locationType || "text",
        locValue: eventData.locationValue || eventData.mapSrc || "",
        ticketUrl: eventData.ticketUrl || "",
        images: getDisplayImageUrls(eventData.images)
    };

    const googleMapsHref = latLng
        ? `https://www.google.com/maps/search/?api=1&query=${latLng.lat},${latLng.lng}`
        : mapSrc;

    titleEl.textContent = safeTitle;
    dateEl.textContent = formatEventDate(eventData.date);
    descEl.textContent = eventData.description || "No description provided.";

    if (imagesEl) {
        const imageUrls = getDisplayImageUrls(eventData.images);
        if (imageUrls.length) {
            imagesEl.innerHTML = `
                <h3 class="explore-detail-images-title">Images</h3>
                <div class="explore-detail-images-grid">
                    ${imageUrls
                        .map((src) => `<button type="button" class="explore-image-popup-btn"><img src="${escapeHtml(src)}" alt="${escapeHtml(safeTitle)} image"></button>`)
                        .join("")}
                </div>
            `;

            imagesEl.querySelectorAll(".explore-image-popup-btn img").forEach((imgEl) => {
                imgEl.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.openOrbitImagePopup === "function") {
                        window.openOrbitImagePopup(imgEl.getAttribute("src"), imgEl.getAttribute("alt") || "Event image preview");
                    }
                });
            });
        } else {
            imagesEl.innerHTML = "";
        }
    }

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

    startCountdown(eventData.date, eventData.endDate || null);

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
        const locationType = String(data.locationType || "text").toLowerCase();
        const locationValue = String(data.locationValue || "").trim();
        if (!locationValue) return;

        const startDate = new Date(data.date);
        if (Number.isNaN(startDate.getTime())) return;
        const parsedEnd = data.endDate ? new Date(data.endDate) : null;
        const endDate = parsedEnd && !Number.isNaN(parsedEnd.getTime())
            ? parsedEnd
            : new Date(startDate.getTime() + 60 * 60 * 1000);
        if (endDate.getTime() < nowMs) return;

        const mapSrc = locationType === "map" ? extractMapSrc(locationValue) : "";
        if (locationType === "map" && !mapSrc) return;

        rawEvents.push({
            id: docSnap.id,
            title: data.title || "Untitled Event",
            description: data.description || "No description provided.",
            date: data.date,
            endDate: data.endDate || null,
            locationType,
            locationValue,
            mapSrc,
            ticketUrl: data.ticketUrl || "",
            images: Array.isArray(data.images) ? data.images : []
        });
    });

    rawEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    const mapped = [];
    for (const item of rawEvents) {
        let latLng = extractLatLng(item.mapSrc || item.locationValue);
        if (!latLng) {
            const addressQuery = item.locationType === "map"
                ? extractAddressQuery(item.mapSrc)
                : item.locationValue;
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

                if (isEventLive(eventData)) {
                    window.L.circleMarker(latLng, {
                        radius: 6,
                        className: "explore-live-pin-dot",
                        stroke: false,
                        fillOpacity: 1
                    }).addTo(map);
                }

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
