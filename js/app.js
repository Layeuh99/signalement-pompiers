import { initCitoyenView } from "./citoyen.js";
import { initPompierView } from "./pompier.js";

// Les icônes (Lucide) sont insérées sous forme de balises <i data-lucide="...">
// par le HTML généré dynamiquement (listes, popups de carte, boutons...).
// On les transforme en SVG dès qu'elles apparaissent dans le DOM, plutôt que
// d'appeler lucide.createIcons() manuellement après chaque rendu.
//
// Important : lucide.createIcons() conserve l'attribut data-lucide sur le SVG
// généré (pour du debug interne à la lib) et retraite sans condition tout
// élément qui le porte. L'appeler après CHAQUE mutation sans filtre créerait
// donc une boucle infinie (le SVG généré redéclenche l'observateur, qui
// rappelle createIcons(), qui régénère un SVG, etc.) : on ne l'appelle que
// s'il reste au moins un <i data-lucide> non encore converti.
const iconObserver = new MutationObserver(() => {
  if (document.querySelector("i[data-lucide]")) {
    window.lucide?.createIcons();
  }
});
iconObserver.observe(document.body, { childList: true, subtree: true });
window.lucide?.createIcons();

const tabCitoyen = document.getElementById("tab-citoyen");
const tabPompier = document.getElementById("tab-pompier");
const viewCitoyen = document.getElementById("view-citoyen");
const viewPompier = document.getElementById("view-pompier");

let pompierInitialized = false;

function showCitoyen() {
  tabCitoyen.classList.add("active");
  tabPompier.classList.remove("active");
  viewCitoyen.classList.remove("hidden");
  viewPompier.classList.add("hidden");
}

function showPompier() {
  tabPompier.classList.add("active");
  tabCitoyen.classList.remove("active");
  viewPompier.classList.remove("hidden");
  viewCitoyen.classList.add("hidden");
  if (!pompierInitialized) {
    initPompierView();
    pompierInitialized = true;
  }
}

tabCitoyen.addEventListener("click", showCitoyen);
tabPompier.addEventListener("click", showPompier);

// Démarrage : la vue témoin est active par défaut
initCitoyenView();
