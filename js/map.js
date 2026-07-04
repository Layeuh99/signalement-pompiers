import { TYPES } from "./constants.js";
import { updateReportStatus, deleteReport } from "./reports.js";
import { renderReportCard, updateCaserneDistance } from "./reportCard.js";
import { CASERNES, nearestCaserne } from "./casernes.js";
import { fetchRoute, trafficLabel } from "./routing.js";
import { escapeHtml, showToast } from "./utils.js";

const DEFAULT_CENTER = [14.7167, -17.4677]; // Dakar, Sénégal
const DEFAULT_ZOOM = 11;

let markersLayer = null;
let casernesLayer = null;
let routeLayer = null;
let userLocationLayer = null;
let watchId = null;
let markersById = new Map();
let routeSheetEl = null;

// Crée la carte Leaflet dans le conteneur donné. À appeler une seule fois
// (la carte est réutilisée à chaque bascule liste/carte).
export function initMap(containerId) {
  const map = L.map(containerId, { zoomControl: true, closePopupOnClick: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // Filet de sécurité : force la fermeture de la popup ouverte au clic sur la
  // carte (un clic sur un marqueur stoppe sa propagation, donc ceci ne se
  // déclenche que pour un clic sur le fond de carte, pas sur un marqueur).
  map.on("click", () => map.closePopup());

  const planClassique = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Tiles &copy; Esri" }
  );

  markersLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  casernesLayer = L.layerGroup().addTo(map);
  userLocationLayer = L.layerGroup().addTo(map);
  renderCasernes();

  // ---- Normes cartographiques : échelle, couches, légende, position ----
  L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);

  // L'itinéraire n'est pas un calque permanent : il n'apparaît qu'à la
  // demande (ouverture d'un signalement) et ne figure donc pas ici.
  L.control
    .layers(
      { "Plan": planClassique, "Satellite": satellite },
      { "Signalements": markersLayer, "Casernes": casernesLayer },
      { position: "topright", collapsed: false }
    )
    .addTo(map);

  addLegendControl(map);
  addLocateControl(map);
  addRouteSheetControl(map);

  return map;
}

// Panneau "feuille de route" (façon Network Analyst d'ArcGIS Pro) : liste des
// instructions de conduite étape par étape. Vide et masqué tant qu'aucun
// itinéraire n'est affiché ; rempli par drawRoute(), vidé par clearRoute().
function addRouteSheetControl(map) {
  const control = L.control({ position: "bottomright" });
  control.onAdd = () => {
    const div = L.DomUtil.create("div", "map-route-sheet hidden");
    L.DomEvent.disableClickPropagation(div);
    routeSheetEl = div;
    return div;
  };
  control.addTo(map);
}

function addLegendControl(map) {
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = () => {
    const div = L.DomUtil.create("div", "map-legend collapsed");
    L.DomEvent.disableClickPropagation(div);
    div.innerHTML = `
      <button class="map-legend-toggle" type="button">
        <i data-lucide="list-tree"></i> Légende
      </button>
      <div class="map-legend-body">
        <div class="map-legend-title">Gravité</div>
        <div class="map-legend-row"><span class="map-legend-swatch" style="background:#D62828"></span> Grave</div>
        <div class="map-legend-row"><span class="map-legend-swatch" style="background:#F4A300"></span> Moyenne</div>
        <div class="map-legend-row"><span class="map-legend-swatch" style="background:#4A4E54"></span> Légère</div>
        <div class="map-legend-title">Type d'urgence</div>
        ${TYPES.map((t) => `<div class="map-legend-row"><i data-lucide="${t.icon}"></i> ${t.label}</div>`).join("")}
        <div class="map-legend-title">Autres éléments</div>
        <div class="map-legend-row"><i data-lucide="siren"></i> Caserne de sapeurs-pompiers</div>
        <div class="map-legend-row"><span class="map-legend-line"></span> Itinéraire routier</div>
      </div>
    `;
    div.querySelector(".map-legend-toggle").addEventListener("click", () => {
      div.classList.toggle("collapsed");
    });
    // Un clic ailleurs sur la carte (hors légende) la referme, plutôt que de
    // devoir recliquer précisément sur le bouton.
    map.on("click", () => div.classList.add("collapsed"));
    return div;
  };
  legend.addTo(map);
}

function addLocateControl(map) {
  const LocateControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const btn = L.DomUtil.create("button", "leaflet-bar map-locate-btn");
      btn.type = "button";
      btn.title = "Centrer sur ma position en temps réel";
      btn.innerHTML = '<i data-lucide="home"></i>';
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, "click", () => locateRealtime(map, btn));
      return btn;
    },
  });
  map.addControl(new LocateControl());
}

// Centre la carte sur la position réelle de l'utilisateur et la garde à jour
// (suivi continu façon "ma position" des applications cartographiques).
function locateRealtime(map, btn) {
  if (!navigator.geolocation) return;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    userLocationLayer.clearLayers();
    btn.classList.remove("active");
    return;
  }

  btn.classList.add("active");
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      userLocationLayer.clearLayers();
      userLocationLayer.addLayer(
        L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#fff",
          weight: 2,
          fillColor: "#1E6091",
          fillOpacity: 1,
        })
      );
      userLocationLayer.addLayer(
        L.circle([latitude, longitude], { radius: accuracy, color: "#1E6091", weight: 1, fillOpacity: 0.08 })
      );
      map.setView([latitude, longitude], Math.max(map.getZoom(), 14));
    },
    () => {
      btn.classList.remove("active");
      watchId = null;
    },
    { enableHighAccuracy: true }
  );
}

function casterneIcon() {
  return L.divIcon({
    className: "caserne-marker",
    html: `<span class="caserne-marker-pin"><i data-lucide="siren"></i></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function renderCasernes() {
  CASERNES.forEach((c) => {
    const marker = L.marker([c.lat, c.lng], { icon: casterneIcon() });
    marker.bindPopup(`<div class="caserne-popup"><strong><i data-lucide="siren"></i> ${c.name}</strong></div>`);
    casernesLayer.addLayer(marker);
  });
}

function graviteColor(gravite) {
  return gravite === "grave" ? "#D62828" : gravite === "moyenne" ? "#F4A300" : "#4A4E54";
}

function buildIcon(r) {
  const typeInfo = TYPES.find((t) => t.id === r.type) || TYPES[TYPES.length - 1];
  return L.divIcon({
    className: "map-marker",
    html: `<span class="map-marker-pin" style="background:${graviteColor(r.gravite)}"><span><i data-lucide="${typeInfo.icon}"></i></span></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });
}

// Affiche les signalements donnés sur la carte. Les boutons de statut et
// d'itinéraire dans les popups utilisent le même comportement que ceux de
// la liste.
export function renderMarkers(map, reports) {
  markersLayer.clearLayers();
  markersById = new Map();

  const withCoords = reports.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  withCoords.forEach((r) => {
    const marker = L.marker([r.lat, r.lng], { icon: buildIcon(r) });
    marker.bindPopup(renderReportCard(r), {
      maxWidth: 300,
      minWidth: 260,
      maxHeight: 340,
      autoPanPadding: [20, 20],
      className: "map-popup",
    });
    marker.on("popupopen", (e) => {
      const popupEl = e.popup.getElement();
      popupEl.querySelectorAll(".status-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const { id, status } = btn.dataset;
          await updateReportStatus(id, status);
        });
      });
      const near = nearestCaserne(r.lat, r.lng);
      if (near) drawRoute(map, near.caserne, r);
      updateCaserneDistance(popupEl, r);
      popupEl.querySelectorAll(".report-itineraire").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (near) drawRoute(map, near.caserne, r);
        });
      });
      // Déjà sur la carte avec le popup ouvert : recentrer suffit.
      popupEl.querySelectorAll(".report-open-map").forEach((btn) => {
        btn.addEventListener("click", () => {
          map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
        });
      });
      popupEl.querySelectorAll(".report-delete").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Supprimer définitivement ce signalement ? Cette action est irréversible.")) return;
          try {
            await deleteReport(btn.dataset.reportId);
            map.closePopup();
            showToast("Signalement supprimé.");
          } catch (err) {
            console.error(err);
            showToast("Erreur lors de la suppression.", "error");
          }
        });
      });
    });
    // L'itinéraire reste affiché après la fermeture du popup : il n'est
    // remplacé que quand un autre signalement est ouvert (drawRoute efface
    // l'ancien tracé avant de dessiner le nouveau).
    markersById.set(r.id, marker);
    markersLayer.addLayer(marker);
  });

  // Le zoom reste toujours fixé sur Dakar : pas de recadrage automatique sur
  // l'étendue des signalements (qui peuvent être dispersés dans tout le pays).
}

// Centre la carte sur un signalement donné et ouvre son popup, ce qui
// déclenche automatiquement le tracé de l'itinéraire depuis la caserne la
// plus proche (voir popupopen dans renderMarkers).
export function openReportPopup(map, reportId) {
  const marker = markersById.get(reportId);
  if (!marker) return;
  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
  marker.openPopup();
}

// Trace l'itinéraire routier entre une caserne et le lieu d'un signalement,
// avec distance et durée ajustées au trafic temps réel (TomTom, repli OSRM),
// et remplit la feuille de route (instructions étape par étape).
async function drawRoute(map, caserne, report) {
  clearRoute();

  const info = await fetchRoute(caserne, report);
  if (!info) return;

  const line = L.polyline(info.coordinates, {
    color: "#1E6091",
    weight: 4,
    opacity: 0.8,
    dashArray: "1, 8",
    lineCap: "round",
  });
  routeLayer.addLayer(line);

  const midpoint = info.coordinates[Math.floor(info.coordinates.length / 2)];
  const label = L.marker(midpoint, {
    icon: L.divIcon({
      className: "route-label",
      html: `<span><i data-lucide="route"></i> ${info.distanceKm.toFixed(1)} km · ${info.minutes} min · ${trafficLabel(info)}</span>`,
      iconSize: [0, 0],
    }),
    interactive: false,
  });
  routeLayer.addLayer(label);

  renderRouteSheet(map, info);
}

function formatStepDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// Le panneau reste replié par défaut : seul le bouton « Afficher la feuille
// de route » apparaît, l'utilisateur choisit lui-même de dérouler la liste
// des instructions (plutôt qu'elle ne s'impose automatiquement).
function renderRouteSheet(map, info) {
  if (!routeSheetEl || !info.steps?.length) return;

  routeSheetEl.classList.remove("hidden");
  routeSheetEl.classList.add("collapsed");
  routeSheetEl.innerHTML = `
    <button class="map-route-sheet-toggle" type="button">
      <i data-lucide="list-ordered"></i> Afficher la feuille de route
    </button>
    <div class="map-route-sheet-body">
      <div class="map-route-sheet-body-header">
        <span>${info.steps.length} étapes</span>
        <button class="map-route-sheet-close" type="button" aria-label="Fermer l'itinéraire"><i data-lucide="x"></i></button>
      </div>
      ${info.steps
        .map(
          (s, i) => `
        <button type="button" class="map-route-sheet-step" data-step="${i}">
          <span class="map-route-sheet-index">${i + 1}</span>
          <span>
            <span class="map-route-sheet-msg">${escapeHtml(s.message)}</span>
            ${s.distanceM > 0 ? `<span class="map-route-sheet-dist">${formatStepDistance(s.distanceM)}</span>` : ""}
          </span>
        </button>`
        )
        .join("")}
    </div>
  `;

  routeSheetEl.querySelector(".map-route-sheet-toggle").addEventListener("click", () => {
    routeSheetEl.classList.toggle("collapsed");
  });
  routeSheetEl.querySelector(".map-route-sheet-close").addEventListener("click", () => clearRoute());
  routeSheetEl.querySelectorAll(".map-route-sheet-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = info.steps[Number(btn.dataset.step)];
      map.setView(step.point, Math.max(map.getZoom(), 16));
    });
  });
}

function clearRoute() {
  routeLayer?.clearLayers();
  if (routeSheetEl) {
    routeSheetEl.classList.add("hidden");
    routeSheetEl.innerHTML = "";
  }
}