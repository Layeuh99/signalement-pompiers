// Casernes de sapeurs-pompiers du Sénégal (BNSP - Brigade Nationale des
// Sapeurs-Pompiers). Coordonnées issues d'OpenStreetMap (données ouvertes,
// © contributeurs OpenStreetMap, licence ODbL) : requête Overpass sur
// amenity=fire_station dans le périmètre du Sénégal.
export const CASERNES = [
  { id: "sn-1", name: "Caserne Sapeurs Pompiers (BNSP, Direction)", lat: 14.6833898, lng: -17.4396038 },
  { id: "sn-2", name: "Caserne Sapeurs-Pompiers, Dakar Plateau", lat: 14.7262067, lng: -17.4397137 },
  { id: "sn-3", name: "Caserne Sapeurs-Pompiers, Dakar", lat: 14.7604944, lng: -17.4372039 },
  { id: "sn-4", name: "Caserne de sapeurs-pompiers, Dakar", lat: 14.6676247, lng: -17.3994864 },
  { id: "sn-5", name: "Pompiers Dieuppeul, Dakar", lat: 14.7180717, lng: -17.4571792 },
  { id: "sn-6", name: "Caserne des Sapeurs-Pompiers de Guédiawaye", lat: 14.7714256, lng: -17.3880179 },
  { id: "sn-7", name: "Caserne Sapeurs-Pompiers ZI Mbao", lat: 14.7425317, lng: -17.3410936 },
  { id: "sn-8", name: "Caserne Sapeurs-Pompiers (Aéroport AIBD)", lat: 14.6657587, lng: -17.0698672 },
  { id: "sn-9", name: "Caserne de pompiers de Gorée", lat: 14.6693017, lng: -17.4003033 },
  { id: "sn-10", name: "Caserne de Sapeurs-Pompiers de Rufisque", lat: 14.7234044, lng: -17.2819405 },
  { id: "sn-11", name: "Sapeurs-Pompiers de Thiès", lat: 14.7901895, lng: -16.9244693 },
  { id: "sn-12", name: "Centre Principal d'Incendie et de Secours de Saint-Louis", lat: 16.0337691, lng: -16.5031852 },
  { id: "sn-13", name: "Sapeurs-Pompiers, Caserne de Touba", lat: 14.8397456, lng: -15.8882640 },
  { id: "sn-14", name: "Sapeurs-Pompiers de Kolda", lat: 12.8963169, lng: -14.9277194 },
  { id: "sn-15", name: "Camp Sapeurs-Pompiers de Tambacounda", lat: 13.7753497, lng: -13.6814149 },
  { id: "sn-16", name: "Caserne de Linguère", lat: 15.3978484, lng: -15.1231737 },
  { id: "sn-17", name: "Caserne de Cap Skirring", lat: 12.3802317, lng: -16.7309413 },
  { id: "sn-18", name: "Administration Sapeurs-Pompiers", lat: 14.1386308, lng: -16.0746903 },
  { id: "sn-19", name: "Caserne de sapeurs-pompiers", lat: 14.3475192, lng: -16.4051338 },
  { id: "sn-20", name: "Caserne de sapeurs-pompiers", lat: 15.1112934, lng: -16.6392385 },
  { id: "sn-21", name: "Caserne de sapeurs-pompiers", lat: 15.4843051, lng: -16.3370802 },
  { id: "sn-22", name: "Caserne de sapeurs-pompiers", lat: 15.6192722, lng: -16.2110369 },
  { id: "sn-23", name: "Caserne de sapeurs-pompiers", lat: 14.9621322, lng: -16.8049045 },
];

// Retourne la caserne la plus proche d'un point donné, avec la distance en km.
export function nearestCaserne(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const c of CASERNES) {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best ? { caserne: best, distanceKm: bestDist } : null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}