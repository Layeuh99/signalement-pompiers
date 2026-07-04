# Alerte Secours — version HTML / CSS / JavaScript

Version 100% statique, sans build, sans npm — fonctionne directement avec **XAMPP** (ou n'importe quel serveur Apache/PHP), ou même en ouvrant `index.html` directement.

Deux vues :
- **Témoin** : signale un accident (type, gravité, description, photo, position GPS automatique).
- **Poste de commandement** : reçoit les signalements en temps réel, avec carte et suivi de statut.

---

## 1. Placer le projet dans XAMPP

Copie tout le dossier `signalement-pompiers-html/` dans :

```
C:\xampp\htdocs\signalement-pompiers\        (Windows)
/Applications/XAMPP/htdocs/signalement-pompiers/   (Mac)
```

Démarre Apache depuis le panneau de contrôle XAMPP, puis ouvre :

```
http://localhost/signalement-pompiers/
```

**Ne double-clique pas directement sur `index.html`** dans l'explorateur de fichiers : certains navigateurs bloquent les imports de modules JavaScript (`type="module"`) et la géolocalisation sur le protocole `file://`. Passe toujours par `http://localhost/...`.

---

## 2. Créer le projet Firebase (gratuit, 5 minutes)

1. Va sur https://console.firebase.google.com et clique **Ajouter un projet**.
2. Donne-lui un nom (ex. `alerte-secours-pompiers`).
3. Menu de gauche : **Compilation > Firestore Database** → **Créer une base de données** → mode **test** pour démarrer vite (voir `firestore.rules` pour sécuriser plus tard).
4. **Paramètres du projet** (icône engrenage) > **Vos applications** > icône Web (`</>`) pour enregistrer une app.
5. Copie les valeurs affichées (`apiKey`, `authDomain`, `projectId`, etc.).

---

## 3. Configurer Firebase dans le code

Ouvre `js/firebase-config.js` et remplace les valeurs `"REMPLACE_MOI"` par celles de ton projet :

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "alerte-secours-pompiers.firebaseapp.com",
  projectId: "alerte-secours-pompiers",
  storageBucket: "alerte-secours-pompiers.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

Il n'y a pas de fichier `.env` ici (pas de build) : les clés Firebase Web sont conçues pour être visibles côté client, ce n'est pas un problème de sécurité — la vraie protection se fait via les règles Firestore (`firestore.rules`).

---

## 4. Tester

Recharge `http://localhost/signalement-pompiers/` dans le navigateur. Autorise la géolocalisation quand le navigateur la demande.

Pour tester depuis un téléphone sur le même réseau Wi-Fi : trouve l'adresse IP locale de ton PC (`ipconfig` sous Windows) et ouvre `http://<ton-ip>/signalement-pompiers/` depuis le téléphone. Note : la géolocalisation du navigateur exige HTTPS sur la plupart des mobiles récents — en local via IP en HTTP, certains navigateurs mobiles peuvent la bloquer. Pour un test terrain fiable, prévois un déploiement HTTPS (Firebase Hosting, Netlify, etc.).

---

## 5. Déployer les règles Firestore

Nécessite le CLI Firebase (`npm install -g firebase-tools`, une seule fois) :

```bash
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

---

## 6. Déployer en ligne (HTTPS, accessible sur mobile)

Le dossier est déjà 100% statique : héberge-le tel quel sur **Firebase Hosting**, Netlify, ou tout hébergement statique.

```bash
firebase init hosting     # dossier public = "." (racine du projet)
firebase deploy --only hosting
```

---

## Structure du projet

```
index.html            → structure des deux vues (témoin / pompiers)
css/style.css         → tous les styles
js/
  firebase-config.js  → connexion Firebase (à remplir avec tes clés)
  reports.js          → création / écoute / mise à jour des signalements
  constants.js        → types d'urgence, gravités, statuts
  casernes.js         → casernes de sapeurs-pompiers (BNSP Sénégal) + calcul de la plus proche
  utils.js            → redimensionnement photo, formatage de date, notifications toast
  reportCard.js        → rendu HTML d'un signalement (partagé liste + carte)
  citoyen.js          → logique du formulaire de signalement
  pompier.js          → logique du tableau de bord temps réel (liste + bascule carte)
  map.js              → carte Leaflet : marqueurs, casernes, itinéraires, recadrage automatique
  app.js              → point d'entrée, bascule entre les deux vues
firestore.rules       → règles de sécurité Firestore
```

La vue « Poste de commandement » propose une carte (Leaflet + fond OpenStreetMap,
chargés via CDN, aucune clé requise) en plus de la liste : bouton **Liste / Carte**,
marqueurs colorés par gravité avec l'icône du type d'urgence, popup avec le détail
du signalement et les boutons de changement de statut, recadrage automatique sur
les signalements filtrés.

**Casernes et itinéraires (Sénégal)** : `js/casernes.js` contient les casernes de
sapeurs-pompiers du Sénégal (BNSP), avec leurs coordonnées réelles issues
d'OpenStreetMap (requête Overpass sur `amenity=fire_station`, données ouvertes
ODbL). Chaque signalement affiche automatiquement la caserne la plus proche et
un bouton « Voir l'itinéraire sur la carte » (calcul interne, plus de lien
sortant vers Google Maps). Sur la carte, ouvrir le popup d'un signalement trace
l'itinéraire routier réel entre la caserne et le lieu du signalement.

`js/routing.js` calcule cet itinéraire via la **TomTom Routing API**
(`traffic=true`), qui tient compte du trafic temps réel (distance, durée et
retard dû au trafic) — clé gratuite sur https://developer.tomtom.com. Si la clé
n'est pas configurée ou que le service est indisponible, l'app retombe
automatiquement sur [OSRM](http://project-osrm.org/) (gratuit, sans clé, mais
sans notion de trafic). Comme pour Firebase, la clé TomTom est prévue pour un
usage côté client ; pense à la restreindre par domaine (HTTP referrer) dans le
tableau de bord TomTom avant un usage en production.

Sur la carte, tracer un itinéraire affiche aussi une **feuille de route**
(panneau en bas à droite, façon Network Analyst d'ArcGIS Pro) : liste des
instructions de conduite étape par étape, en français (TomTom fournit le texte
directement ; en repli OSRM, le texte est généré à partir du type de manœuvre).
Cliquer sur une étape centre la carte sur ce point.

---

## Prochaines étapes suggérées

- **Sécuriser Firestore** : restreindre `firestore.rules` avec Firebase Auth (comptes pompiers).
- **Notifications** : Firebase Cloud Messaging pour alerter même app/onglet fermé.
- **Export vers ArcGIS Online / QGIS** : export périodique des signalements Firestore en GeoJSON.
