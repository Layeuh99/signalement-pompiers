import { updateReportStatus, subscribeToReports } from "./reports.js";
import { renderReportCard, updateCaserneDistance } from "./reportCard.js";
import { initMap, renderMarkers, openReportPopup } from "./map.js";
import { showToast } from "./utils.js";
import { auth, login, logout, onAuthChange } from "./auth.js";

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
  els.loginPanel = document.getElementById("pompier-login");
  els.loginForm = document.getElementById("pompier-login-form");
  els.email = document.getElementById("pompier-email");
  els.password = document.getElementById("pompier-password");
  els.loginBtn = document.getElementById("pompier-login-btn");
  els.dashboard = document.getElementById("pompier-dashboard");
  els.logoutBtn = document.getElementById("pompier-logout-btn");

  els.filters = document.getElementById("filters");
  els.list = document.getElementById("reports-list");
  els.viewToggle = document.getElementById("view-toggle");
  els.mapContainer = document.getElementById("pompier-map");
  els.liveIndicator = document.getElementById("live-indicator");

  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutBtn.addEventListener("click", () => logout());

  // onAuthChange appelle immédiatement le callback avec l'état courant, puis
  // à chaque connexion/déconnexion : c'est ce qui bascule entre l'écran de
  // connexion et le tableau de bord.
  onAuthChange((user) => {
    console.log("[auth] onAuthStateChanged →", user ? `connecté (${user.email}, uid=${user.uid})` : "non connecté");
    els.loginPanel.classList.toggle("hidden", !!user);
    els.dashboard.classList.toggle("hidden", !user);

    if (user) {
      initDashboard();
    } else {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      state.reports = [];
      state.loading = true;
    }
  });
}

async function handleLogin(e) {
  e.preventDefault();
  els.loginBtn.disabled = true;
  els.loginBtn.innerHTML = '<i data-lucide="loader-circle" class="spin"></i> Connexion…';

  try {
    await login(els.email.value.trim(), els.password.value);
    els.password.value = "";
  } catch (err) {
    console.error(err);
    showToast("Email ou mot de passe incorrect.", "error");
  } finally {
    els.loginBtn.disabled = false;
    els.loginBtn.innerHTML = '<i data-lucide="log-in"></i> Se connecter';
  }
}

// La carte et les filtres ne sont créés qu'une seule fois (sur la première
// connexion) ; l'écoute des signalements, elle, redémarre à chaque connexion
// (elle est coupée à la déconnexion, voir onAuthChange ci-dessus).
function initDashboard() {
  if (!map) {
    renderFilters();
    bindViewToggle();
    map = initMap("pompier-map");
    window.addEventListener("resize", () => map.invalidateSize());
  }

  if (!unsubscribe) {
    console.log(
      "[reports] appel de subscribeToReports, auth.currentUser =",
      auth.currentUser ? `${auth.currentUser.email} (uid=${auth.currentUser.uid})` : "null"
    );
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
