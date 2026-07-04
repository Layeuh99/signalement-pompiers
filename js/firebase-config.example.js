// Configuration Firebase — MODÈLE
//
// 1. Crée un projet gratuit sur https://console.firebase.google.com
// 2. Ajoute une application "Web" et copie la configuration ci-dessous
// 3. Active "Firestore Database" (mode test pour démarrer) dans la console Firebase
// 4. Copie ce fichier en js/firebase-config.js et remplace les valeurs REMPLACE_MOI
//    (js/firebase-config.js n'est jamais commité, voir .gitignore)
//
// Ce projet n'utilise aucun outil de build : Firebase est chargé directement
// depuis le CDN officiel via des imports ES Modules, supportés nativement
// par tous les navigateurs modernes (et donc compatibles XAMPP / Apache).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ⚠️ Remplace ces valeurs par celles de TON projet Firebase
// (Console Firebase > Paramètres du projet > Tes applications > Config SDK)
const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI",
};

export const app = initializeApp(firebaseConfig);

// useFetchStreams: false → force Firestore à utiliser du long-polling XHR
// classique plutôt que le streaming fetch. Sans ça, la connexion temps réel
// d'onSnapshot reste ouverte indéfiniment et certains navigateurs affichent
// l'onglet comme "en cours de chargement" en permanence.
export const db = initializeFirestore(app, { useFetchStreams: false });