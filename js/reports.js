import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const REPORTS_COLLECTION = "reports";

// Crée un nouveau signalement. Retourne l'id du document créé.
export async function addReport(report) {
  const ref = await addDoc(collection(db, REPORTS_COLLECTION), {
    ...report,
    createdAt: serverTimestamp(),
    clientTimestamp: Date.now(),
  });
  return ref.id;
}

// S'abonne au flux de signalements en temps réel, triés du plus récent au plus ancien.
// Retourne une fonction "unsubscribe" à appeler pour arrêter l'écoute.
export function subscribeToReports(onChange, onError) {
  const q = query(collection(db, REPORTS_COLLECTION), orderBy("clientTimestamp", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(reports);
    },
    (error) => {
      console.error(error);
      onError?.(error);
    }
  );
}

// Met à jour le statut d'un signalement (nouveau / encours / traite).
export async function updateReportStatus(id, status) {
  await updateDoc(doc(db, REPORTS_COLLECTION, id), { status });
}
