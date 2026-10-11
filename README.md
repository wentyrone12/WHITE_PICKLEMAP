# PickleFinder Philippines

A mobile-first pickleball court-finder for **the whole Philippines**.

## Included
- `index.html` — Firebase email/password login + Google sign-in
- `signup.html` — email/password registration + Google account continuation
- `forgot.html` — Firebase password reset
- `dashboard.html` — responsive Leaflet map + local court directory
- Search + availability + indoor/outdoor filters
- Favorites stored locally in the browser
- Browser geolocation with Cotabato City area guard for the map centering tool
- Community availability reports with Firestore real-time listeners
- In-app driving directions using an OpenStreetMap routing service; the route, distance, ETA, and turn-by-turn steps remain inside PickleFinder
- `firebase.json` for static Firebase Hosting
- `firestore.rules` for the availabilityReports collection

## Firebase configuration
The included `assets/firebase-config.js` is configured for project `whitequiz-24288` from the Firebase Web App configuration supplied for this project.

In Firebase Console, make sure these are enabled:
1. Authentication → Sign-in providers → Email/Password
2. Authentication → Sign-in providers → Google
3. Authentication → Settings → Authorized domains for every domain where the site runs
4. Firestore Database → create the default `(default)` database and publish `firestore.rules`

The browser uses Google popup sign-in first because it avoids the cross-origin storage issue that can affect redirect authentication on non-Firebase hosting. If a browser blocks the popup, the code falls back to redirect sign-in. Firebase's documentation recommends popup or redirect as the available web flows and notes that redirect can require additional same-domain setup on hosts outside Firebase Hosting.

## Run locally
Serve the folder through an HTTP server instead of opening the HTML files directly with `file://`. VS Code Live Server is fine:

```text
http://localhost:5500/
```

For Firebase Hosting, the included `.firebaserc` already points to `whitequiz-24288`.

## Court data
The directory contains a small starter set of Cotabato City listings. Address details, pricing, hours, and availability can change. Availability shown as live is community-reported and should be verified before travel.

Map tiles use OpenStreetMap. Addresses are geocoded client-side through Nominatim. Driving routes are calculated through an online OpenStreetMap routing service.


### PWA / Phone installation
The dashboard now includes a responsive mobile sidebar, Court Directory, Settings, Light/Dark/System themes, account/privacy controls, and PWA installation support.
Serve this project over HTTPS (GitHub Pages/Firebase Hosting) or localhost, then use the browser's Install/Add to Home Screen option.


## v2 — Nationwide + color themes
- **All of the Philippines:** courts are loaded live from OpenStreetMap (Overpass API, `sport=pickleball`) for the whole country, merged per venue, cached in the browser for 24h, and shown with map clustering. The curated Cotabato City directory stays as seed data.
- **Place search:** type a city/place in the search box and press Enter to fly there. City chips (Metro Manila, Cebu, Davao, etc.) jump straight to a region. Court lists are sorted nearest-first, using your location when allowed.
- **Color themes:** Settings → Appearance → *Color theme* (9 presets + any custom color) and *Text color* (Default, Tinted, Warm, Cool, High contrast). Works in light and dark mode, and on the login pages too.
- Availability reports now use one Firestore collection listener instead of one per court, so it scales to thousands of courts.
