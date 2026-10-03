# Cotabato PickleFinder — Firebase Setup

The uploaded project is already wired to the supplied Firebase Web App configuration for project `whitequiz-24288`.

## 1) Authentication

In Firebase Console → **Authentication** → **Sign-in method**, enable:

- **Email/Password**
- **Google**

Then go to **Authentication → Settings → Authorized domains** and add every domain where you actually host the site, such as:

- `localhost` for local HTTP development
- your `web.app` / `firebaseapp.com` hosting domain
- your custom domain
- your GitHub Pages domain, if you use GitHub Pages

Firebase's web authentication docs support both `signInWithPopup()` and `signInWithRedirect()`. This project uses **popup first** because it is generally more reliable when the app is hosted on a domain different from Firebase's auth helper domain. If a browser blocks the popup, the project falls back to redirect sign-in. Firebase documents additional same-domain considerations for redirect auth on non-Firebase hosting.

## 2) Google account behavior

The **Continue with Google** button is used on both the sign-in and sign-up screens. Google Authentication creates a Firebase user automatically when that Google account is used for the first time; the same button can therefore sign in existing users or create a new account.

## 3) Cloud Firestore

Firebase Console → **Databases & Storage → Firestore Database** → **Create database**.

Create the default `(default)` database.

The dashboard reads/writes:

`availabilityReports/{courtId}`

The included `firestore.rules` file restricts availability updates to authenticated users and records the UID of the user who posted the report.

## 4) Deploy Firestore rules

From this folder, when Firebase CLI is installed:

```bash
firebase login
firebase deploy --only firestore:rules
```

The included `.firebaserc` points to:

`whitequiz-24288`

## 5) Run locally

Do not open the site directly with `file://` for normal testing. Serve it through HTTP instead, for example with VS Code Live Server:

```text
http://localhost:5500/
```

Make sure `localhost` is authorized in Firebase Authentication if your Firebase project does not already contain it.

## 6) Google sign-in troubleshooting

If Google sign-in fails, check these in order:

1. Authentication → Sign-in method → **Google = Enabled**.
2. Authentication → Settings → **Authorized domains** includes the exact host shown in the browser address bar.
3. The site is running from an HTTP/HTTPS origin, not a raw `file://` URL.
4. Browser popup blocking is not preventing the first attempt. The app automatically tries redirect as a fallback when a popup is blocked.
5. If the Google account already exists with another Firebase sign-in provider, use that provider first or link credentials according to your chosen account flow.

The Firebase JavaScript SDK used by the project is `12.19.0`, released September 9, 2026.
