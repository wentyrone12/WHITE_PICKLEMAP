import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig, firebaseReady } from "./firebase-config.js";
import { COURTS, COTABATO_CENTER, CITY_BOUNDS } from "./courts.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let auth = null;
let db = null;
if (firebaseReady) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const THEME_KEY = "picklefinderTheme";
const REPORT_NAME_KEY = "picklefinderShareReportName";
const REMEMBER_SEARCH_KEY = "picklefinderRememberSearch";

let currentUser = null;
let communityReports = {};
let favoriteIds = JSON.parse(localStorage.getItem("picklefinderFavorites") || "[]");
let activeFilter = "all";
let searchTerm = localStorage.getItem(REMEMBER_SEARCH_KEY) === "false" ? "" : (localStorage.getItem("picklefinderLastSearch") || "");
let map;
let markers = new Map();
let geocoded = new Map();
let mapSearchController = null;
let routeLayer = null;
let routeOrigin = null;
let routeTargetId = null;
let routeRequestController = null;
let courtsExpanded = false;
let deferredInstallPrompt = null;
let sidebarFilter = "all";
const INITIAL_COURT_LIMIT = 4;
const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
const toast = (text, type = "info") => {
  let el = $("#appToast");
  if (!el) {
    el = document.createElement("div"); el.id = "appToast"; el.className = "app-toast"; document.body.appendChild(el);
  }
  el.textContent = text; el.dataset.type = type; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
};

const reportFor = (id) => communityReports[id];
const availabilityLabel = (id) => {
  const report = reportFor(id);
  if (!report) return { key:"listed", label:"Listed", detail:"No recent community update" };
  return report.status === "available" ? { key:"available", label:"Available", detail: timeAgo(report.updatedAt) } : report.status === "busy" ? { key:"busy", label:"Busy", detail: timeAgo(report.updatedAt) } : { key:"closed", label:"Closed", detail: timeAgo(report.updatedAt) };
};
const timeAgo = (value) => {
  if (!value) return "just now";
  const ms = value?.toDate ? value.toDate().getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) return "recently";
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
const saveFavorites = () => localStorage.setItem("picklefinderFavorites", JSON.stringify(favoriteIds));

function visibleCourts() {
  return COURTS.filter((court) => {
    const hay = `${court.name} ${court.area} ${court.barangay} ${court.address} ${court.tags.join(" ")}`.toLowerCase();
    if (searchTerm && !hay.includes(searchTerm)) return false;
    if (activeFilter === "favorites" && !favoriteIds.includes(court.id)) return false;
    if (activeFilter === "available" && availabilityLabel(court.id).key !== "available") return false;
    if (activeFilter === "indoor" && !["indoor","covered"].includes(court.type)) return false;
    if (activeFilter === "outdoor" && court.type !== "outdoor") return false;
    return true;
  });
}

function typeLabel(type) { return type === "indoor" ? "Indoor" : type === "covered" ? "Covered" : "Outdoor"; }
function courtCard(court) {
  const av = availabilityLabel(court.id);
  const fav = favoriteIds.includes(court.id);
  const courtCount = court.courts ? `${court.courts} court${court.courts > 1 ? "s" : ""}` : "Court count not listed";
  return `<article class="court-card" data-court-id="${court.id}">
    <div class="court-card-top"><div class="court-badge ${av.key}"><i></i>${av.label}</div><button class="favorite-btn ${fav ? "active" : ""}" data-favorite="${court.id}" aria-label="${fav ? "Remove from" : "Add to"} favorites">${fav ? "♥" : "♡"}</button></div>
    <button class="court-title-btn" data-open-court="${court.id}"><h3>${escapeHTML(court.name)}</h3><span>${escapeHTML(court.area)}</span></button>
    <div class="court-meta"><span>⌂ ${typeLabel(court.type)}</span><span>▦ ${escapeHTML(courtCount)}</span><span>₱ ${escapeHTML(court.rate).replace(/^₱\s*/,"")}</span></div>
    <div class="court-address">${escapeHTML(court.address)}</div>
    <div class="court-card-bottom"><span class="report-age">${escapeHTML(av.detail)}</span><button class="details-btn" data-open-court="${court.id}">View details <b>→</b></button></div>
  </article>`;
}

function sidebarCourtCard(court) {
  const av = availabilityLabel(court.id);
  const fav = favoriteIds.includes(court.id);
  const courtCount = court.courts ? `${court.courts} court${court.courts > 1 ? "s" : ""}` : "Court count n/a";
  return `<article class="sidebar-court-card" data-court-id="${court.id}">
    <div class="sidebar-court-top"><div class="court-badge ${av.key}"><i></i>${av.label}</div><button class="favorite-btn ${fav ? "active" : ""}" data-favorite="${court.id}" aria-label="${fav ? "Remove from" : "Add to"} favorites">${fav ? "♥" : "♡"}</button></div>
    <button class="sidebar-court-title" data-open-court="${court.id}"><b>${escapeHTML(court.name)}</b><small>${escapeHTML(court.area)}</small></button>
    <div class="sidebar-court-meta"><span>${typeLabel(court.type)}</span><span>${escapeHTML(courtCount)}</span><span>${escapeHTML(court.rate)}</span></div>
    <div class="sidebar-court-address">${escapeHTML(court.address)}</div>
    <button class="sidebar-court-action" data-open-court="${court.id}">View details <b>→</b></button>
  </article>`;
}

function bindRenderedCourtActions(root = document) {
  root.querySelectorAll("[data-favorite]").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleFavorite(e); });
  });
  root.querySelectorAll("[data-open-court]").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => openCourt(btn.dataset.openCourt));
  });
}

function sidebarVisibleCourts() {
  return visibleCourts().filter((court) => {
    if (sidebarFilter === "all") return true;
    if (sidebarFilter === "available") return availabilityLabel(court.id).key === "available";
    if (sidebarFilter === "indoor") return ["indoor", "covered"].includes(court.type);
    if (sidebarFilter === "outdoor") return court.type === "outdoor";
    return true;
  });
}

function renderList() {
  const courts = visibleCourts();
  const shownCourts = courtsExpanded ? courts : courts.slice(0, INITIAL_COURT_LIMIT);
  const list = $("#courtList");
  if (list) list.innerHTML = shownCourts.map(courtCard).join("");
  $("#visibleCount") && ($("#visibleCount").textContent = courts.length);
  $("#emptyState")?.classList.toggle("hidden", courts.length !== 0);
  const seeMore = $("#seeMoreCourts");
  if (seeMore) {
    const hasMore = courts.length > INITIAL_COURT_LIMIT;
    seeMore.classList.toggle("hidden", !hasMore);
    seeMore.textContent = courtsExpanded ? "Show less" : `See all ${courts.length} courts`;
    seeMore.setAttribute("aria-expanded", String(courtsExpanded));
  }
  $("#resultsTitle") && ($("#resultsTitle").textContent = activeFilter === "favorites" ? "My favorite courts" : activeFilter === "available" ? "Available now" : searchTerm ? `Results for “${searchTerm}”` : "Courts near the city");
  bindRenderedCourtActions();

  const sidebarCourts = sidebarVisibleCourts();
  const sideList = $("#sidebarCourtList");
  const sideEmpty = $("#sidebarCourtEmpty");
  if (sideList) sideList.innerHTML = sidebarCourts.map(sidebarCourtCard).join("");
  if (sideEmpty) sideEmpty.classList.toggle("hidden", sidebarCourts.length !== 0);
  $("#sidebarCourtCount") && ($("#sidebarCourtCount").textContent = sidebarCourts.length);
  if (searchTerm && $("#courtSidebarSearch") && $("#courtSidebarSearch").value !== searchTerm) $("#courtSidebarSearch").value = searchTerm;
  bindRenderedCourtActions(sideList || document);
  updateCounts();
}

function renderMarkers() {
  if (!map) return;
  const keep = new Set(visibleCourts().map((c) => c.id));
  markers.forEach((marker, id) => { if (!keep.has(id)) { marker.remove(); markers.delete(id); } });
  for (const court of visibleCourts()) {
    const point = geocoded.get(court.id);
    if (!point || markers.has(court.id)) continue;
    const av = availabilityLabel(court.id);
    const marker = L.marker([point.lat, point.lon], { title: court.name }).addTo(map);
    marker.bindPopup(`<div class="map-popup"><div class="popup-status ${av.key}"><i></i>${av.label}</div><h3>${escapeHTML(court.name)}</h3><p>${escapeHTML(court.address)}</p><div class="popup-actions"><button class="popup-btn" data-popup-court="${court.id}">View details</button><button class="popup-btn route-popup-btn" data-popup-route="${court.id}">Directions</button></div></div>`);
    marker.on("popupopen", () => setTimeout(() => {
      document.querySelector(`[data-popup-court="${court.id}"]`)?.addEventListener("click", () => openCourt(court.id));
      document.querySelector(`[data-popup-route="${court.id}"]`)?.addEventListener("click", () => { marker.closePopup(); startRouteToCourt(court.id); });
    }, 0));
    markers.set(court.id, marker);
  }
  if (geocoded.size) $("#mapNotice").textContent = `${geocoded.size} of ${visibleCourts().length || COURTS.length} visible court locations mapped. Tap a pin for details.`;
}

function updateCounts() {
  const avail = COURTS.filter(c => availabilityLabel(c.id).key === "available").length;
  $("#availableCount").textContent = avail || "—";
  $("#favoriteCount").textContent = favoriteIds.length;
  $("#courtCount").textContent = COURTS.length;
}

function toggleFavorite(e) {
  const id = e.currentTarget.dataset.favorite;
  favoriteIds = favoriteIds.includes(id) ? favoriteIds.filter(x => x !== id) : [...favoriteIds, id];
  saveFavorites(); renderList(); renderMarkers();
  toast(favoriteIds.includes(id) ? "Court saved to favorites." : "Removed from favorites.", "success");
}

async function geocodeCourt(court) {
  if (geocoded.has(court.id)) return;
  try {
    const query = `${court.address}, Philippines`;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&bounded=1&viewbox=124.17,7.14,124.31,7.29&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error("Geocoder error");
    const data = await res.json();
    if (data[0]) {
      const lat = Number(data[0].lat), lon = Number(data[0].lon);
      if (lat >= CITY_BOUNDS.minLat && lat <= CITY_BOUNDS.maxLat && lon >= CITY_BOUNDS.minLng && lon <= CITY_BOUNDS.maxLng) geocoded.set(court.id, { lat, lon });
    }
  } catch (e) { console.warn("Geocoding failed for", court.name, e); }
}
async function geocodeAll() {
  $("#mapNotice").textContent = "Mapping local court locations…";
  for (const court of COURTS) {
    await geocodeCourt(court);
    renderMarkers();
    await new Promise((r) => setTimeout(r, 850));
  }
  $("#mapNotice").textContent = geocoded.size ? `Mapped ${geocoded.size} local venues. Exact venue details can change—confirm before travel.` : "Map pins could not be loaded. Use the court list to open directions.";
}

function openCourt(id) {
  const court = COURTS.find(c => c.id === id); if (!court) return;
  const av = availabilityLabel(id);
  const fav = favoriteIds.includes(id);
  $("#courtModalBody").innerHTML = `<div class="modal-kicker">COURT DETAILS</div><div class="detail-heading"><div><h2>${escapeHTML(court.name)}</h2><p>${escapeHTML(court.area)} · ${typeLabel(court.type)}</p></div><button class="favorite-lg ${fav ? "active" : ""}" data-favorite-modal="${court.id}">${fav ? "♥ Saved" : "♡ Save"}</button></div><div class="detail-status ${av.key}"><i></i><div><b>${av.label}</b><span>${escapeHTML(av.detail)}</span></div></div><div class="detail-grid"><div><span>Location</span><b>${escapeHTML(court.address)}</b></div><div><span>Courts</span><b>${escapeHTML(court.courts || "Not listed")}</b></div><div><span>Rate</span><b>${escapeHTML(court.rate)}</b></div><div><span>Contact</span><b>${escapeHTML(court.contact || "Not listed")}</b></div></div><div class="detail-tags">${court.tags.map(t => `<span>${escapeHTML(t)}</span>`).join("")}</div><div class="detail-actions"><button class="primary-btn" data-route-specific="${court.id}"><span>Directions in PickleFinder</span><b>→</b></button><button class="secondary-btn" data-report-specific="${court.id}">Report availability</button></div><p class="detail-disclaimer">Directions open inside this website. Your browser location is used as the route starting point when you allow location access. Confirm current hours, pricing, and court access with the venue.</p>`;
  $("[data-favorite-modal]")?.addEventListener("click", () => { toggleFavorite({currentTarget:{dataset:{favorite:court.id}}}); openCourt(court.id); });
  $("[data-route-specific]")?.addEventListener("click", async () => { closeModal("courtModal"); await startRouteToCourt(court.id); });
  $("[data-report-specific]")?.addEventListener("click", () => { closeModal("courtModal"); openReport(court.id); });
  openModal("courtModal");
  const point = geocoded.get(id); if (point) { map.setView([point.lat, point.lon], Math.max(map.getZoom(), 16)); setTimeout(() => markers.get(id)?.openPopup(), 250); }
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
function stepIcon(type) {
  const map = {
    turn: "↪", newName: "→", depart: "↑", arrive: "⌂", merge: "↗", onRamp: "↗", offRamp: "↘", fork: "⑂", roundabout: "⟳", rotary: "⟳", endOfRoad: "↰", continue: "↑", notification: "•"
  };
  return map[type] || "↑";
}
function renderTurnList(steps) {
  const list = $("#turnList");
  if (!list) return;
  if (!steps?.length) { list.innerHTML = `<div class="turn-empty">No turn-by-turn steps were returned. Follow the highlighted route on the map.</div>`; return; }
  list.innerHTML = steps.slice(0, 24).map((step, i) => {
    const name = step.name || "Unnamed road";
    const instruction = step.maneuver?.type === "arrive" ? "Arrive at your destination" : step.maneuver?.type === "depart" ? `Start on ${escapeHTML(name)}` : `${escapeHTML(step.maneuver?.modifier ? step.maneuver.modifier.replaceAll("-", " ") + " onto " : "Continue on ")}${escapeHTML(name)}`;
    return `<div class="turn-row"><span class="turn-number">${i + 1}</span><span class="turn-icon">${stepIcon(step.maneuver?.type)}</span><div><b>${instruction}</b><small>${formatDistance(step.distance)} · ${formatDuration(step.duration)}</small></div></div>`;
  }).join("");
}
function hideRoutePanel() {
  $("#routePanel")?.classList.add("hidden");
}

function clearRoute() {
  if (routeRequestController) routeRequestController.abort();
  routeRequestController = null;
  routeTargetId = null;
  routeOrigin = null;
  if (routeLayer && map) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
  hideRoutePanel();
}

function showRoutePanel(court) {
  $("#routeTitle").textContent = `Route to ${court.name}`;
  $("#routeDestinationText").textContent = court.name;
  $("#routeDestinationAddress").textContent = court.address;
  $("#routePanel").classList.remove("hidden");
}
async function startRouteToCourt(id) {
  const court = COURTS.find(c => c.id === id);
  const destination = geocoded.get(id);
  if (!court || !destination) { toast("This court has no mapped coordinates yet. Try again after the map finishes loading.", "error"); return; }
  routeTargetId = id;
  showRoutePanel(court);
  $("#routeDistance").textContent = "…"; $("#routeDuration").textContent = "…"; $("#routeOriginText").textContent = "Requesting your location…"; $("#turnList").innerHTML = `<div class="turn-empty">Getting your location and building the route…</div>`;
  try {
    const position = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Location unavailable"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
    routeOrigin = { lat: position.coords.latitude, lon: position.coords.longitude };
    $("#routeOriginText").textContent = `${routeOrigin.lat.toFixed(5)}, ${routeOrigin.lon.toFixed(5)}`;
    await calculateRoute(routeOrigin, destination, court);
  } catch (error) {
    console.warn("Route location failed", error);
    $("#routeOriginText").textContent = "Location permission is needed for directions.";
    $("#routeDistance").textContent = "—"; $("#routeDuration").textContent = "—";
    $("#turnList").innerHTML = `<div class="turn-empty"><b>Allow location access</b><span>PickleFinder needs your current location to calculate an in-app route to this court.</span><button class="secondary-btn" id="retryLocationBtn">Try location again</button></div>`;
    $("#retryLocationBtn")?.addEventListener("click", () => startRouteToCourt(id));
    toast("Enable location access to build directions.", "error");
  }
}
async function calculateRoute(origin, destination, court) {
  if (routeRequestController) routeRequestController.abort();
  routeRequestController = new AbortController();
  const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal: routeRequestController.signal });
  if (!res.ok) throw new Error(`Routing service returned ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0]) throw new Error("No route found");
  const route = data.routes[0];
  if (routeLayer && map) map.removeLayer(routeLayer);
  routeLayer = L.layerGroup().addTo(map);
  L.geoJSON(route.geometry, { style: { color: "#0a4bff", weight: 11, opacity: .22, lineCap: "round", lineJoin: "round" } }).addTo(routeLayer);
  L.geoJSON(route.geometry, { style: { color: "#2f80ff", weight: 7, opacity: .98, lineCap: "round", lineJoin: "round" } }).addTo(routeLayer);
  L.geoJSON(route.geometry, { style: { color: "#eaf3ff", weight: 2, opacity: .92, lineCap: "round", lineJoin: "round" } }).addTo(routeLayer);
  const originMarker = L.circleMarker([origin.lat, origin.lon], { radius: 8, color: "#fff", fillColor: "#3be6b4", fillOpacity: 1, weight: 3 });
  const destMarker = L.marker([destination.lat, destination.lon], { title: court.name });
  routeLayer.addLayer(originMarker); routeLayer.addLayer(destMarker);
  const isMobile = window.innerWidth <= 860;
  const routePanelWidth = $("#routePanel")?.offsetWidth || 360;
  const leftPad = isMobile ? 24 : Math.min(routePanelWidth + 45, 430);
  map.fitBounds(L.latLngBounds([origin.lat, origin.lon], [destination.lat, destination.lon]), { paddingTopLeft: [leftPad, 46], paddingBottomRight: [46, 46], maxZoom: 16 });
  $("#routeDistance").textContent = formatDistance(route.distance);
  $("#routeDuration").textContent = formatDuration(route.duration);
  renderTurnList(route.legs?.flatMap(leg => leg.steps) || []);
  toast(`Route ready: ${formatDistance(route.distance)} · ${formatDuration(route.duration)}`, "success");
}

function openModal(id) { $("#"+id)?.classList.remove("hidden"); document.body.classList.add("modal-open"); }
function closeModal(id) { $("#"+id)?.classList.add("hidden"); if ($$(".modal:not(.hidden)").length===0) document.body.classList.remove("modal-open"); }
$$("[data-close-modal]").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.closeModal)));
$$('.modal').forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); }));

function openReport(preselected = "") {
  const select = $("#reportCourt");
  select.innerHTML = COURTS.map(c => `<option value="${c.id}" ${c.id===preselected ? "selected" : ""}>${escapeHTML(c.name)}</option>`).join("");
  $("#reportMessage").textContent = ""; openModal("reportModal");
}
$("#reportFromNav")?.addEventListener("click", () => openReport());
$("#aboutBtn")?.addEventListener("click", () => openModal("aboutModal"));

$("#reportForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !db) { toast("Sign in and connect Firebase to post live reports.", "error"); return; }
  const courtId = $("#reportCourt").value;
  const status = document.querySelector('input[name="status"]:checked').value;
  const note = $("#reportNote").value.trim();
  try {
    await setDoc(doc(db, "availabilityReports", courtId), { status, note, updatedBy: currentUser.uid, updatedByName: localStorage.getItem(REPORT_NAME_KEY) === "false" ? "PickleFinder player" : (currentUser.displayName || "Player"), updatedAt: serverTimestamp() });
    $("#reportMessage").textContent = "Report posted. Thanks for helping other players."; $("#reportMessage").className = "auth-message success";
    $("#reportNote").value = "";
  } catch (error) { console.error(error); $("#reportMessage").textContent = "Could not post the report. Check Firestore setup and rules."; $("#reportMessage").className = "auth-message error"; }
});

function setupMap() {
  const mapEl = $("#map");
  if (!mapEl || typeof L === "undefined") {
    console.error("Leaflet map could not initialize.");
    $("#mapNotice") && ($("#mapNotice").textContent = "Map library could not load. Please refresh the page.");
    return;
  }

  map = L.map(mapEl, {
    zoomControl: false,
    minZoom: 12,
    maxZoom: 19,
    preferCanvas: true,
    tap: true
  }).setView(COTABATO_CENTER, 13);

  // Primary map tiles. If the primary tile host is unavailable, automatically switch
  // to a second public basemap so the map does not remain a blank/black panel.
  const primaryTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    crossOrigin: true,
    attribution: '&copy; OpenStreetMap contributors'
  });
  const fallbackTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    crossOrigin: true,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  });

  let primaryLoaded = false;
  let fallbackStarted = false;
  const startFallback = () => {
    if (primaryLoaded || fallbackStarted || !map) return;
    fallbackStarted = true;
    if (map.hasLayer(primaryTiles)) map.removeLayer(primaryTiles);
    fallbackTiles.addTo(map);
    $("#mapNotice") && ($("#mapNotice").textContent = "Using an alternate map tile service…");
  };
  primaryTiles.once("load", () => { primaryLoaded = true; });
  let tileErrors = 0;
  primaryTiles.on("tileerror", () => {
    tileErrors += 1;
    if (tileErrors >= 2) startFallback();
  });
  primaryTiles.addTo(map);
  window.setTimeout(startFallback, 5500);

  L.circle(COTABATO_CENTER, { radius: 8500, color: "#3be6b4", fillColor: "#3be6b4", fillOpacity: 0.035, weight: 1, dashArray: "5 7" }).addTo(map);
  L.marker(COTABATO_CENTER, { interactive: false, opacity: 0 }).addTo(map);

  const refreshMapSize = () => requestAnimationFrame(() => map?.invalidateSize({ animate: false, pan: false }));
  refreshMapSize();
  window.setTimeout(refreshMapSize, 200);
  window.setTimeout(refreshMapSize, 700);
  renderMarkers();
  geocodeAll();
}

// The X only closes the directions card. The highlighted blue route remains on the map.
$("#closeRouteBtn")?.addEventListener("click", hideRoutePanel);
$("#refreshRouteBtn")?.addEventListener("click", () => { if (routeTargetId) startRouteToCourt(routeTargetId); });
$("#recenterBtn")?.addEventListener("click", () => { if (routeTargetId) clearRoute(); map?.setView(COTABATO_CENTER, 13); });
$("#zoomInBtn")?.addEventListener("click", () => map?.zoomIn());
$("#zoomOutBtn")?.addEventListener("click", () => map?.zoomOut());
$("#locateBtn")?.addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Location is not supported by this browser.", "error");
  toast("Requesting your location…");
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    if (latitude < CITY_BOUNDS.minLat || latitude > CITY_BOUNDS.maxLat || longitude < CITY_BOUNDS.minLng || longitude > CITY_BOUNDS.maxLng) {
      toast("Your location is outside the Cotabato City area filter. Staying on the city map.", "error");
      return;
    }
    map.setView([latitude, longitude], 15);
    L.circleMarker([latitude, longitude], { radius: 8, color: "#ffffff", fillColor: "#3be6b4", fillOpacity: 1, weight: 3 }).addTo(map).bindTooltip("You are here").openTooltip();
    toast("Centered on your location.", "success");
  }, () => toast("Location permission was not granted.", "error"), { enableHighAccuracy: true, timeout: 10000 });
});

function applyFilter(filter, sourceButton = null) {
  activeFilter = filter;
  sidebarFilter = filter;
  courtsExpanded = false;
  $$(`[data-filter]`).forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
  $$(`[data-side-filter]`).forEach(b => b.classList.toggle("active", b.dataset.sideFilter === filter));
  if (sourceButton) sourceButton.classList.add("active");
  renderList(); renderMarkers();
}

function syncSearch(value, persist = true) {
  searchTerm = String(value || "").trim().toLowerCase();
  courtsExpanded = false;
  const main = $("#courtSearch"), side = $("#courtSidebarSearch");
  if (main && main.value !== value) main.value = value;
  if (side && side.value !== value) side.value = value;
  if (persist && localStorage.getItem(REMEMBER_SEARCH_KEY) !== "false") localStorage.setItem("picklefinderLastSearch", searchTerm);
  renderList(); renderMarkers();
}

$("#courtSearch")?.addEventListener("input", (e) => syncSearch(e.target.value));
$("#courtSidebarSearch")?.addEventListener("input", (e) => syncSearch(e.target.value));

$$("[data-filter]").forEach((btn) => btn.addEventListener("click", () => applyFilter(btn.dataset.filter, btn)));
$$("[data-side-filter]").forEach((btn) => btn.addEventListener("click", () => applyFilter(btn.dataset.sideFilter, btn)));

$$("[data-filter-nav]").forEach((btn) => btn.addEventListener("click", () => {
  const filter = btn.dataset.filterNav;
  applyFilter(filter);
  showSidebarView("courts");
}));

$("#clearFilters")?.addEventListener("click", () => {
  searchTerm = ""; activeFilter = "all"; sidebarFilter = "all"; courtsExpanded = false;
  $("#courtSearch") && ($("#courtSearch").value = "");
  $("#courtSidebarSearch") && ($("#courtSidebarSearch").value = "");
  localStorage.removeItem("picklefinderLastSearch");
  applyFilter("all");
});

$("#seeMoreCourts")?.addEventListener("click", () => {
  courtsExpanded = !courtsExpanded;
  renderList();
  const list = $("#courtList");
  if (courtsExpanded) list?.scrollTo({ top: 0, behavior: "smooth" });
});

// Sidebar views: map, court directory and settings.
const sidebar = $("#sidebar"), backdrop = $("#backdrop");
function showSidebarView(view) {
  if (!sidebar) return;
  sidebar.dataset.view = view;
  sidebar.classList.toggle("has-panel", view !== "map");
  $("#mainSideNav")?.classList.toggle("hidden", view !== "map");
  $("#courtsPanel")?.classList.toggle("hidden", view !== "courts");
  $("#settingsPanel")?.classList.toggle("hidden", view !== "settings");
  $$("[data-sidebar-view]").forEach((b) => b.classList.toggle("active", b.dataset.sidebarView === view));
  if (view === "courts") {
    renderList();
    requestAnimationFrame(() => map?.invalidateSize());
  }
  if (view === "settings") populateSettings();
}

$$('[data-sidebar-view]').forEach((btn) => btn.addEventListener('click', () => showSidebarView(btn.dataset.sidebarView)));
$$('[data-sidebar-back]').forEach((btn) => btn.addEventListener('click', () => showSidebarView('map')));

const openSidebar = () => { sidebar?.classList.add("open"); backdrop?.classList.add("show"); document.body.classList.add("sidebar-open"); };
const closeSidebar = () => { sidebar?.classList.remove("open"); backdrop?.classList.remove("show"); document.body.classList.remove("sidebar-open"); showSidebarView('map'); };
$("#openSidebar")?.addEventListener("click", openSidebar);
$("#closeSidebar")?.addEventListener("click", closeSidebar);
backdrop?.addEventListener("click", closeSidebar);

$("#profileMenuBtn")?.addEventListener("click", () => { openSidebar(); showSidebarView("settings"); });
$("#topProfile")?.addEventListener("click", () => { openSidebar(); showSidebarView("settings"); });
$("#signOutBtn")?.addEventListener("click", async () => { if(auth) await signOut(auth); location.replace("index.html"); });
$("#settingsSignOutBtn")?.addEventListener("click", async () => { if(auth) await signOut(auth); location.replace("index.html"); });

// Theme / privacy / account settings.
function setTheme(theme) {
  const root = document.documentElement;
  const valid = ["light", "dark", "system"].includes(theme) ? theme : "system";
  if (valid === "system") {
    localStorage.removeItem(THEME_KEY);
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
    root.dataset.theme = prefersLight ? "light" : "dark";
  } else {
    localStorage.setItem(THEME_KEY, valid);
    root.dataset.theme = valid;
  }
  $$('[data-theme-choice]').forEach((b) => b.classList.toggle('active', b.dataset.themeChoice === valid));
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', root.dataset.theme === 'light' ? '#f4f7f6' : '#0c1117');
}

function populateSettings() {
  $("#settingsDisplayName") && ($("#settingsDisplayName").value = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Player");
  $("#settingsEmail") && ($("#settingsEmail").value = currentUser?.email || "");
  const theme = localStorage.getItem(THEME_KEY) || "system";
  setTheme(theme);
  $("#shareReportName") && ($("#shareReportName").checked = localStorage.getItem(REPORT_NAME_KEY) !== "false");
  $("#rememberSearch") && ($("#rememberSearch").checked = localStorage.getItem(REMEMBER_SEARCH_KEY) !== "false");
  updateInstallUI();
}

$$('[data-theme-choice]').forEach((btn) => btn.addEventListener('click', () => setTheme(btn.dataset.themeChoice)));
$("#shareReportName")?.addEventListener("change", (e) => localStorage.setItem(REPORT_NAME_KEY, String(e.target.checked)));
$("#rememberSearch")?.addEventListener("change", (e) => {
  localStorage.setItem(REMEMBER_SEARCH_KEY, String(e.target.checked));
  if (!e.target.checked) localStorage.removeItem("picklefinderLastSearch");
});

$("#saveAccountBtn")?.addEventListener("click", async () => {
  const name = $("#settingsDisplayName")?.value.trim();
  if (!currentUser || !auth) return toast("Please sign in again before changing your profile.", "error");
  if (!name || name.length < 2) return toast("Display name must contain at least 2 characters.", "error");
  const button = $("#saveAccountBtn");
  button.disabled = true; button.textContent = "Saving…";
  try {
    await updateProfile(currentUser, { displayName: name });
    renderUser(currentUser);
    toast("Profile updated.", "success");
  } catch (error) {
    console.error(error); toast("Could not update your profile. Please try again.", "error");
  } finally { button.disabled = false; button.textContent = "Save profile"; }
});

$("#resetPasswordBtn")?.addEventListener("click", async () => {
  if (!auth || !currentUser?.email) return toast("No email account is available for password reset.", "error");
  try { await sendPasswordResetEmail(auth, currentUser.email); toast("Password reset email sent.", "success"); }
  catch (error) { console.error(error); toast(error?.code === "auth/too-many-requests" ? "Too many reset attempts. Try again later." : "Could not send the reset email.", "error"); }
});

$("#clearLocalDataBtn")?.addEventListener("click", () => {
  localStorage.removeItem("picklefinderFavorites");
  localStorage.removeItem("picklefinderLastSearch");
  localStorage.removeItem(THEME_KEY);
  localStorage.removeItem(REPORT_NAME_KEY);
  localStorage.removeItem(REMEMBER_SEARCH_KEY);
  favoriteIds = [];
  searchTerm = "";
  activeFilter = "all";
  sidebarFilter = "all";
  if ($("#courtSearch")) $("#courtSearch").value = "";
  if ($("#courtSidebarSearch")) $("#courtSidebarSearch").value = "";
  setTheme("system"); renderList(); renderMarkers();
  toast("Local favorites and preferences cleared.", "success");
});

function isStandalone() { return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true; }
function updateInstallUI() {
  const canInstall = Boolean(deferredInstallPrompt) && !isStandalone();
  $$('[id="installAppBtn"], [id="installNavBtn"]').forEach((btn) => {
    if (!btn) return;
    btn.disabled = isStandalone();
    if (btn.id === 'installAppBtn') btn.textContent = isStandalone() ? 'App is installed' : (canInstall ? 'Install PickleFinder' : 'Install / Add to Home Screen');
  });
  const state = $(".install-state"); if (state) state.textContent = isStandalone() ? "✓" : "+";
}
async function installApp() {
  if (isStandalone()) return toast("PickleFinder is already installed.", "info");
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === "accepted") toast("PickleFinder is being installed.", "success");
    deferredInstallPrompt = null; updateInstallUI();
    return;
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(isIOS ? "On iPhone/iPad: Share → Add to Home Screen." : "Your browser may show an Install or Add to Home Screen option in its menu.", "info");
}
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; updateInstallUI(); });
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; updateInstallUI(); toast("PickleFinder installed successfully.", "success"); });
$("#installAppBtn")?.addEventListener("click", installApp);
$("#installNavBtn")?.addEventListener("click", () => { openSidebar(); showSidebarView('settings'); setTimeout(installApp, 120); });

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $("#courtSearch")?.focus(); showSidebarView('map'); }
  if (e.key === 'Escape') {
    $$(".modal:not(.hidden)").forEach(m => closeModal(m.id));
    if (!$("#routePanel")?.classList.contains("hidden")) hideRoutePanel();
  }
});

window.addEventListener('resize', () => {
  if (!map) return;
  window.clearTimeout(window.__pickleFinderResizeTimer);
  window.__pickleFinderResizeTimer = window.setTimeout(() => map.invalidateSize({ animate: false, pan: false }), 90);
});
window.addEventListener('orientationchange', () => window.setTimeout(() => map?.invalidateSize({ animate: false, pan: false }), 250));


function renderUser(user) {
  const name = user?.displayName || user?.email?.split("@")[0] || "Player";
  const initial = name.trim().charAt(0).toUpperCase() || "P";
  $("#userName").textContent = name; $("#userEmail").textContent = user?.email || "Signed in"; $("#topUserName").textContent = name;
  $("#userAvatar").textContent = initial; $("#topAvatar").textContent = initial;
  if (user?.photoURL) { $("#userAvatar").style.backgroundImage=`url('${user.photoURL}')`; $("#userAvatar").textContent=""; $("#topAvatar").style.backgroundImage=`url('${user.photoURL}')`; $("#topAvatar").textContent=""; }
}

function subscribeReports() {
  if (!db) return;
  onSnapshot(doc(db, "availabilityReports", "_meta"), () => {});
  for (const court of COURTS) {
    onSnapshot(doc(db, "availabilityReports", court.id), (snap) => {
      if (snap.exists()) communityReports[court.id] = snap.data(); else delete communityReports[court.id];
      renderList(); renderMarkers();
    }, (err) => console.warn("Availability sync failed", err));
  }
}

function start() {
  setTheme(localStorage.getItem(THEME_KEY) || "system");
  renderList();
  setupMap();
  updateInstallUI();
  window.setTimeout(() => $("#appLoader")?.classList.add("hidden"), 1400);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("PWA service worker registration failed", err));
  if (!firebaseReady) {
    $("#mapNotice").textContent = "Map is live. Firebase is not configured, so login/report sync is disabled.";
    $("#appLoader").classList.add("hidden");
    return;
  }
  onAuthStateChanged(auth, (user) => {
    if (!user) { location.replace("index.html"); return; }
    currentUser = user; renderUser(user); subscribeReports(); $("#appLoader").classList.add("hidden");
  });
}

start();
