import { TYPES, GRAVITES, STATUTS } from "./constants.js";
import { timeAgo, escapeHtml } from "./utils.js";
import { nearestCaserne } from "./casernes.js";
import { fetchRoute, trafficLabel } from "./routing.js";

// Rendu HTML d'un signalement, partagé entre la liste (pompier.js) et les
// popups de la carte (map.js) pour garder un seul format et un seul jeu
// de boutons de changement de statut et d'itinéraire.
export function renderReportCard(r) {
  const typeInfo = TYPES.find((t) => t.id === r.type) || TYPES[TYPES.length - 1];
  const statutInfo = STATUTS[r.status] || STATUTS.nouveau;
  const graviteInfo = GRAVITES.find((g) => g.id === r.gravite);
  const graviteColor = r.gravite === "grave" ? "#D62828" : r.gravite === "moyenne" ? "#F4A300" : "#4A4E54";
  const ts = r.clientTimestamp || (r.createdAt?.toMillis ? r.createdAt.toMillis() : Date.now());
  const near = Number.isFinite(r.lat) && Number.isFinite(r.lng) ? nearestCaserne(r.lat, r.lng) : null;

  const statusButtons = Object.entries(STATUTS)
    .map(
      ([key, val]) => `
      <button
        class="status-btn"
        data-id="${r.id}"
        data-status="${key}"
        style="color:${r.status === key ? val.color : "#8a8e95"}; background:${r.status === key ? val.color + "10" : "transparent"}"
      >${val.label}</button>`
    )
    .join("");

  return `
    <div class="report-card">
      <div class="report-head">
        <div class="report-type">
          <div class="type-icon" style="background:${typeInfo.color}1a;color:${typeInfo.color}"><i data-lucide="${typeInfo.icon}"></i></div>
          <div>
            <div class="report-type-name">${escapeHtml(typeInfo.label)}</div>
            <div class="report-time"><i data-lucide="clock"></i> ${timeAgo(ts)}</div>
          </div>
        </div>
        <span class="badge" style="background:${statutInfo.color}1a;color:${statutInfo.color};border:1px solid ${statutInfo.color}55">${statutInfo.label}</span>
      </div>

      <div class="badge-row">
        <span class="badge" style="background:${graviteColor}1a;color:${graviteColor};border:1px solid ${graviteColor}55">${escapeHtml(graviteInfo?.label || "")}</span>
      </div>

      ${r.description ? `<p class="report-desc">${escapeHtml(r.description)}</p>` : ""}

      ${r.photo ? `<img class="report-photo" src="${r.photo}" alt="Photo de l'incident" />` : ""}

      ${
        r.nomTemoin || r.telephone
          ? `<div class="report-contact">${escapeHtml(r.nomTemoin || "Témoin anonyme")}${r.telephone ? " · " + escapeHtml(r.telephone) : ""}</div>`
          : ""
      }

      <a class="report-map" href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank" rel="noopener noreferrer">
        <i data-lucide="map-pin"></i> Ouvrir la localisation (${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)})
      </a>

      ${
        near
          ? `
      <div class="report-caserne">
        <div class="report-caserne-name"><i data-lucide="siren"></i> ${escapeHtml(near.caserne.name)} <span class="report-caserne-dist" data-report-id="${r.id}">· calcul de la distance…</span></div>
        <button type="button" class="report-itineraire" data-report-id="${r.id}">
          <i data-lucide="navigation"></i> Voir l'itinéraire sur la carte
        </button>
      </div>`
          : ""
      }

      <div class="status-row">${statusButtons}</div>

      <button type="button" class="report-open-map" data-report-id="${r.id}">
        <i data-lucide="map"></i> Ouvrir sur la carte
      </button>

      <button type="button" class="report-delete" data-report-id="${r.id}">
        <i data-lucide="trash-2"></i> Supprimer le signalement
      </button>
    </div>
  `;
}

// Remplace le "calcul de la distance…" par la distance/durée routière réelle
// (via OSRM) une fois connue. root = élément contenant le rendu de la carte
// (liste ou popup de la carte).
export async function updateCaserneDistance(root, r) {
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
  const near = nearestCaserne(r.lat, r.lng);
  if (!near) return;

  const info = await fetchRoute(near.caserne, r);
  if (!info) return;

  root.querySelectorAll(`.report-caserne-dist[data-report-id="${r.id}"]`).forEach((el) => {
    el.textContent = `· ${info.distanceKm.toFixed(1)} km en voiture · ${info.minutes} min · ${trafficLabel(info)}`;
  });
}