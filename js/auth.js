import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { app } from "./firebase-config.js";

export const auth = getAuth(app);

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

// callback(user) est appelé immédiatement avec l'état courant, puis à chaque
// connexion/déconnexion. user vaut null si personne n'est connecté.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}