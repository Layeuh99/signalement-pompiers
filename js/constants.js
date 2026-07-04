export const TYPES = [
  { id: "accident", label: "Accident de la route", color: "#D62828", icon: "car-front" },
  { id: "incendie", label: "Incendie", color: "#F4A300", icon: "flame" },
  { id: "noyade", label: "Noyade / secours nautique", color: "#1E6091", icon: "life-buoy" },
  { id: "malaise", label: "Malaise / urgence médicale", color: "#7A4CA0", icon: "stethoscope" },
  { id: "autre", label: "Autre urgence", color: "#4A4E54", icon: "triangle-alert" },
];

export const GRAVITES = [
  { id: "legere", label: "Légère" },
  { id: "moyenne", label: "Moyenne" },
  { id: "grave", label: "Grave / vies en danger" },
];

export const STATUTS = {
  nouveau: { label: "Nouveau", color: "#D62828" },
  encours: { label: "En cours d'intervention", color: "#F4A300" },
  traite: { label: "Traité", color: "#2E7D32" },
};
