import { TYPES, GRAVITES } from "./constants.js";
import { resizeImage, showToast } from "./utils.js";
import { addReport } from "./reports.js";

const state = {
  type: null,
  gravite: null,
  photo: null,
  coords: null,
  geoStatus: "loading", // loading | ok | error
  sending: false,
};

const els = {};

export function initCitoyenView() {
  els.geoStrip = document.getElementById("geo-strip");
  els.geoIcon = document.getElementById("geo-icon");
  els.geoText = document.getElementById("geo-text");
  els.geoRetry = document.getElementById("geo-retry");
  els.typeGrid = document.getElementById("type-grid");
  els.graviteRow = document.getElementById("gravite-row");
  els.description = document.getElementById("description");
  els.nomTemoin = document.getElementById("nom-temoin");
  els.telephone = document.getElementById("telephone");
  els.photoInput = document.getElementById("photo-input");
  els.photoBtn = document.getElementById("photo-btn");
  els.photoPreviewWrap = document.getElementById("photo-preview-wrap");
  els.photoPreview = document.getElementById("photo-preview");
  els.photoRemove = document.getElementById("photo-remove");
  els.sendBtn = document.getElementById("send-btn");
  els.citoyenForm = document.getElementById("citoyen-form");
  els.citoyenSuccess = document.getElementById("citoyen-success");
  els.sendBar = document.getElementById("send-bar");
  els.newReportBtn = document.getElementById("new-report-btn");

  renderTypes();
  renderGravites();
  bindEvents();
  acquireLocation();
}

function renderTypes() {
  els.typeGrid.innerHTML = TYPES.map(
    (t) => `<button class="type-card" data-type="${t.id}"><i data-lucide="${t.icon}"></i> ${t.label}</button>`
  ).join("");
  els.typeGrid.querySelectorAll(".type-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.type = btn.dataset.type;
      updateTypeUI();
      updateSendState();
    });
  });
}

function updateTypeUI() {
  const selected = TYPES.find((t) => t.id === state.type);
  els.typeGrid.querySelectorAll(".type-card").forEach((btn) => {
    const isSel = btn.dataset.type === state.type;
    btn.classList.toggle("selected", isSel);
    btn.style.borderColor = isSel ? selected.color : "";
    btn.style.background = isSel ? selected.color + "14" : "#fff";
    btn.style.color = isSel ? selected.color : "#1C1F23";
  });
}

function renderGravites() {
  els.graviteRow.innerHTML = GRAVITES.map(
    (g) => `<button class="gravite-btn" data-gravite="${g.id}">${g.label}</button>`
  ).join("");
  els.graviteRow.querySelectorAll(".gravite-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.gravite = btn.dataset.gravite;
      els.graviteRow.querySelectorAll(".gravite-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.gravite === state.gravite);
      });
      updateSendState();
    });
  });
}

function bindEvents() {
  els.geoRetry.addEventListener("click", acquireLocation);

  els.photoBtn.addEventListener("click", () => els.photoInput.click());
  els.photoInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.photo = await resizeImage(file);
    els.photoPreview.src = state.photo;
    els.photoPreviewWrap.classList.remove("hidden");
    els.photoBtn.classList.add("hidden");
  });
  els.photoRemove.addEventListener("click", () => {
    state.photo = null;
    els.photoInput.value = "";
    els.photoPreviewWrap.classList.add("hidden");
    els.photoBtn.classList.remove("hidden");
  });

  els.sendBtn.addEventListener("click", handleSubmit);
  els.newReportBtn.addEventListener("click", resetForm);
}

function acquireLocation() {
  state.geoStatus = "loading";
  updateGeoUI();
  if (!navigator.geolocation) {
    state.geoStatus = "error";
    updateGeoUI();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precision: pos.coords.accuracy,
      };
      state.geoStatus = "ok";
      updateGeoUI();
      updateSendState();
    },
    () => {
      state.geoStatus = "error";
      updateGeoUI();
      updateSendState();
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function updateGeoUI() {
  els.geoStrip.classList.remove("ok", "error");
  els.geoRetry.classList.add("hidden");
  if (state.geoStatus === "loading") {
    els.geoIcon.innerHTML = '<i data-lucide="loader-circle" class="spin"></i>';
    els.geoText.textContent = "Localisation en cours…";
  } else if (state.geoStatus === "ok") {
    els.geoStrip.classList.add("ok");
    els.geoIcon.innerHTML = '<i data-lucide="map-pin"></i>';
    els.geoText.textContent = `Position acquise · précision ≈ ${Math.round(state.coords.precision)} m`;
  } else {
    els.geoStrip.classList.add("error");
    els.geoIcon.innerHTML = '<i data-lucide="triangle-alert"></i>';
    els.geoText.textContent = "Localisation refusée ou indisponible";
    els.geoRetry.classList.remove("hidden");
  }
}

function updateSendState() {
  const canSend = state.type && state.gravite && state.geoStatus === "ok" && !state.sending;
  els.sendBtn.disabled = !canSend;
}

async function handleSubmit() {
  const canSend = state.type && state.gravite && state.geoStatus === "ok" && !state.sending;
  if (!canSend) return;

  state.sending = true;
  els.sendBtn.innerHTML = '<i data-lucide="loader-circle" class="spin"></i> Envoi en cours…';
  updateSendState();

  try {
    await addReport({
      type: state.type,
      gravite: state.gravite,
      description: els.description.value.trim(),
      nomTemoin: els.nomTemoin.value.trim(),
      telephone: els.telephone.value.trim(),
      lat: state.coords.lat,
      lng: state.coords.lng,
      precision: Math.round(state.coords.precision || 0),
      photo: state.photo || null,
      status: "nouveau",
    });
    showSuccess();
  } catch (e) {
    console.error(e);
    showToast("Erreur d'envoi. Vérifiez la connexion et réessayez.", "error");
  } finally {
    state.sending = false;
    els.sendBtn.innerHTML = '<i data-lucide="siren"></i> Alerter les sapeurs-pompiers';
    updateSendState();
  }
}

function showSuccess() {
  els.citoyenForm.classList.add("hidden");
  els.sendBar.classList.add("hidden");
  els.citoyenSuccess.classList.remove("hidden");
}

function resetForm() {
  state.type = null;
  state.gravite = null;
  state.photo = null;
  state.sending = false;

  els.description.value = "";
  els.nomTemoin.value = "";
  els.telephone.value = "";
  els.photoInput.value = "";
  els.photoPreviewWrap.classList.add("hidden");
  els.photoBtn.classList.remove("hidden");
  updateTypeUI();
  els.graviteRow.querySelectorAll(".gravite-btn").forEach((b) => b.classList.remove("selected"));

  els.citoyenSuccess.classList.add("hidden");
  els.citoyenForm.classList.remove("hidden");
  els.sendBar.classList.remove("hidden");

  acquireLocation();
  updateSendState();
}
