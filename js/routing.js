// Calcul d'itinéraire routier avec prise en compte du trafic temps réel.
//
// TomTom Routing API (clé gratuite sur https://developer.tomtom.com) est la
// source principale : elle renvoie un temps de trajet ajusté au trafic en
// direct (summary.trafficDelayInSeconds). Si la clé n'est pas configurée ou
// que le service est indisponible (réseau, quota dépassé...), on retombe sur
// OSRM (gratuit, sans clé, mais sans notion de trafic).
//
// Un cache mémoire (par promesse, pas seulement par résultat) évite de
// recalculer/redemander le même trajet caserne → signalement à chaque
// nouveau rendu de la liste (ex. changement de statut d'un autre
// signalement, qui redéclenche le rendu de tous les autres).
import { TOMTOM_API_KEY } from "./tomtom-config.js";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const cache = new Map();

// Le plan gratuit TomTom limite le nombre de requêtes par seconde : afficher
// une liste de plusieurs signalements d'un coup demandait leur itinéraire en
// parallèle et déclenchait des erreurs 429. On espace donc les appels au lieu
// de les envoyer tous en rafale.
const MIN_INTERVAL_MS = 300;
let queueTail = Promise.resolve();

function throttledTomTomCall(run) {
  const result = queueTail.then(run);
  queueTail = result.catch(() => {}).then(() => new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS)));
  return result;
}

function fetchFromTomTom(caserne, report) {
  if (!TOMTOM_API_KEY) return Promise.resolve(null);

  return throttledTomTomCall(async () => {
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${caserne.lat},${caserne.lng}:${report.lat},${report.lng}/json?key=${TOMTOM_API_KEY}&traffic=true&travelMode=car&instructionsType=text&language=fr-FR`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TomTom HTTP ${res.status}`);

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    const instructions = route.guidance?.instructions || [];

    return {
      distanceKm: route.summary.lengthInMeters / 1000,
      minutes: Math.round(route.summary.travelTimeInSeconds / 60),
      trafficDelayMinutes: Math.round((route.summary.trafficDelayInSeconds || 0) / 60),
      coordinates: route.legs.flatMap((leg) => leg.points.map((p) => [p.latitude, p.longitude])),
      withTraffic: true,
      steps: instructions.map((ins, i) => ({
        message: ins.message,
        distanceM: i === 0 ? 0 : ins.routeOffsetInMeters - instructions[i - 1].routeOffsetInMeters,
        point: [ins.point.latitude, ins.point.longitude],
      })),
    };
  });
}

async function fetchFromOsrm(caserne, report) {
  const url = `${OSRM_URL}/${caserne.lng},${caserne.lat};${report.lng},${report.lat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) return null;

  const steps = route.legs.flatMap((leg) => leg.steps);

  return {
    distanceKm: route.distance / 1000,
    minutes: Math.round(route.duration / 60),
    trafficDelayMinutes: 0,
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    withTraffic: false,
    steps: steps.map((s) => ({
      message: describeOsrmStep(s),
      distanceM: s.distance,
      point: [s.maneuver.location[1], s.maneuver.location[0]],
    })),
  };
}

// OSRM ne fournit pas de texte d'instruction (juste un type/modifier de
// manœuvre) : on construit un message en français, moins riche que celui de
// TomTom mais suffisant pour une solution de repli.
const OSRM_MODIFIERS_FR = {
  left: "à gauche",
  right: "à droite",
  straight: "tout droit",
  "slight left": "légèrement à gauche",
  "slight right": "légèrement à droite",
  "sharp left": "franchement à gauche",
  "sharp right": "franchement à droite",
  uturn: "en demi-tour",
};

function describeOsrmStep(step) {
  const name = step.name || "la route";
  const mod = OSRM_MODIFIERS_FR[step.maneuver.modifier] || "";
  switch (step.maneuver.type) {
    case "depart":
      return `Partir sur ${name}`;
    case "arrive":
      return "Arrivée à destination";
    case "roundabout":
    case "rotary":
      return `Prenez le rond-point vers ${name}`;
    case "turn":
    case "end of road":
    case "fork":
      return `Tournez ${mod} sur ${name}`.replace("  ", " ");
    default:
      return `Continuez sur ${name}`;
  }
}

export function fetchRoute(caserne, report) {
  const key = `${caserne.id}|${report.id}`;
  if (cache.has(key)) return cache.get(key);

  const promise = (async () => {
    let result = null;
    try {
      result = await fetchFromTomTom(caserne, report);
    } catch (e) {
      console.warn("TomTom indisponible, repli sur OSRM :", e);
    }

    if (!result) {
      try {
        result = await fetchFromOsrm(caserne, report);
      } catch (e) {
        console.warn("Itinéraire indisponible :", e);
        result = null;
      }
    }
    return result;
  })();

  cache.set(key, promise);
  // N'immortalise pas un échec : si les deux services ont échoué (ex. coupure
  // réseau ponctuelle), on retire l'entrée pour qu'un rendu ultérieur réessaie.
  promise.then((result) => {
    if (!result) cache.delete(key);
  });

  return promise;
}

// Libellé trafic à afficher à côté d'une durée de trajet. Toujours explicite
// (même sans retard) pour qu'on voie que le trafic est bien pris en compte :
// sans ça, un retard nul et une absence totale de données de trafic (repli
// OSRM) sont visuellement indiscernables.
export function trafficLabel(info) {
  if (!info.withTraffic) return "estimation sans trafic";
  return info.trafficDelayMinutes > 0 ? `+${info.trafficDelayMinutes} min de trafic` : "trafic fluide";
}