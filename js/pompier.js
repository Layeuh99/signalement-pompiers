import { updateReportStatus, subscribeToReports } from "./reports.js";
import { renderReportCard, updateCaserneDistance } from "./reportCard.js";
import { initMap, renderMarkers, openReportPopup } from "./map.js";
import { showToast } from "./utils.js";

const state = {
  reports: [],
  loading: true,
  filter: "all",
  view: "list", // list | map
};

const els = {};
let unsubscribe = null;
let map = null;

export function initPompierView() {
  els.filters = document.getElementById("filters");
  els.list = document.getElementById("reports-list");
  els.viewToggle = document.getElementById("view-toggle");
  els.mapContainer = document.getElementById("pompier-map");
  els.liveIndicator = document.getElementById("live-indicator");

  renderFilters();
  bindViewToggle();

  // La carte est initialisée tout de suite (pas seulement au clic sur "Carte") :
  // sur grand écran, liste et carte sont affichées côte à côte en permanence.
  map = initMap("pompier-map");
  window.addEventListener("resize", () => map.invalidateSize());

  if (!unsubscribe) {
    unsubscribe = subscribeToReports(
      (reports) => {
        state.reports = reports;
        state.loading = false;
        setLiveStatus("ok");
        renderFilters();
        renderList();
        renderMarkers(map, getFilteredReports());
      },
      () => {
        setLiveStatus("error");
        showToast("Connexion au serveur perdue. Vérifiez la configuration Firebase.", "error");
      }
    );
  } else {
    renderList();
    renderMarkers(map, getFilteredReports());
  }
}

function setLiveStatus(status) {
  els.liveIndicator.classList.toggle("error", status === "error");
  els.liveIndicator.innerHTML = `<span class="live-dot"></span> ${status === "error" ? "Hors ligne" : "En direct"}`;
}

function bindViewToggle() {
  els.viewToggle.querySelectorAll(".view-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      updateViewToggleUI();
      requestAnimationFrame(() => map.invalidateSize());
    });
  });
  updateViewToggleUI();
}

function switchToMapView() {
  state.view = "map";
  updateViewToggleUI();
}

function updateViewToggleUI() {
  els.viewToggle.querySelectorAll(".view-toggle-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.view);
  });
  els.list.classList.toggle("hidden", state.view !== "list");
  els.mapContainer.classList.toggle("hidden", state.view !== "map");
}

function getFilteredReports() {
  return state.reports.filter((r) => state.filter === "all" || r.status === state.filter);
}

function renderFilters() {
  const counts = {
    all: state.reports.length,
    nouveau: state.reports.filter((r) => r.status === "nouveau").length,
    encours: state.reports.filter((r) => r.status === "encours").length,
    traite: state.reports.filter((r) => r.status === "traite").length,
  };
  const defs = [
    { id: "all", label: "Tous" },
    { id: "nouveau", label: "Nouveaux" },
    { id: "encours", label: "En cours" },
    { id: "traite", label: "Traités" },
  ];
  els.filters.innerHTML = defs
    .map(
      (f) =>
        `<button class="filter-btn ${f.id === state.filter ? "active" : ""}" data-filter="${f.id}">${f.label} · ${counts[f.id]}</button>`
    )
    .join("");
  els.filters.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      renderFilters();
      renderList();
      renderMarkers(map, getFilteredReports());
    });
  });
}

function renderList() {
  if (state.loading) {
    els.list.innerHTML = `<div class="loading-row">Chargement des signalements…</div>`;
    return;
  }

  const filtered = getFilteredReports();

  if (filtered.length === 0) {
    els.list.innerHTML = `<div class="empty-row">Aucun signalement pour l'instant.</div>`;
    return;
  }

  els.list.innerHTML = filtered.map((r) => renderReportCard(r)).join("");
  filtered.forEach((r) => updateCaserneDistance(els.list, r));

  // Boutons de changement de statut
  els.list.querySelectorAll(".status-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { id, status } = btn.dataset;
      await updateReportStatus(id, status);
    });
  });

  // "Voir l'itinéraire sur la carte" et "Ouvrir sur la carte" font la même
  // chose : basculer en vue carte et ouvrir le popup du signalement (ce qui
  // trace l'itinéraire automatiquement, voir popupopen dans map.js).
  els.list.querySelectorAll(".report-itineraire, .report-open-map").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchToMapView();
      requestAnimationFrame(() => {
        map.invalidateSize();
        openReportPopup(map, btn.dataset.reportId);
      });
    });
  });
}
