import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig, firebaseReady } from "./firebase-config.js";

const page = location.pathname.split("/").pop() || "index.html";
const AUTH_PAGES = ["", "index.html", "signup.html", "forgot.html"];
let auth = null;
let provider = null;

if (firebaseReady) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
}

const $ = (selector) => document.querySelector(selector);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("PWA service worker registration failed", err));
}

function message(text, type = "") {
  const el = $("#authMessage");
  if (!el) return;
  el.textContent = text;
  el.className = `auth-message ${type}`.trim();
}

function friendlyError(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/email-already-in-use": "That email is already registered. Try signing in instead.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/password-does-not-meet-requirements": "Choose a stronger password that meets Firebase's password policy.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled before it finished.",
    "auth/popup-blocked": "The browser blocked the Google popup. Switching to redirect sign-in…",
    "auth/cancelled-popup-request": "Another Google sign-in request is already running.",
    "auth/account-exists-with-different-credential": "That email already uses another sign-in method. Sign in with that method first.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication.",
    "auth/network-request-failed": "Network request failed. Check your internet connection and try again.",
    "auth/internal-error": "Firebase Authentication returned an internal error. Please refresh and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/user-disabled": "This account has been disabled in Firebase Authentication.",
    "auth/invalid-action-code": "This password-reset link is no longer valid. Request a new one.",
    "auth/expired-action-code": "This password-reset link has expired. Request a new one."
  };
  return map[code] || error?.message || "Something went wrong. Please try again.";
}

function setButtonBusy(button, busy, busyText = "Please wait…") {
  if (!button) return;
  if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = busy ? `<span class="button-spinner" aria-hidden="true"></span><span>${busyText}</span>` : button.dataset.originalHtml;
}

async function choosePersistence(remember = true) {
  if (!auth) return;
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
}

// Password visibility
document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = $(btn.dataset.togglePassword);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    btn.textContent = input.type === "password" ? "◉" : "◌";
    btn.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
  });
});

if (auth) {
  // Handles the return leg when Google redirect sign-in was used as a fallback/mobile flow.
  getRedirectResult(auth).catch((error) => message(friendlyError(error), "error"));

  onAuthStateChanged(auth, (user) => {
    if (user && AUTH_PAGES.includes(page)) {
      location.replace("dashboard.html");
    }
  });
} else if (AUTH_PAGES.includes(page)) {
  message("Firebase is not configured. Check assets/firebase-config.js.", "error");
}

async function handleGoogle() {
  if (!auth || !provider) {
    message("Firebase is not connected yet. Check your Firebase configuration.", "error");
    return;
  }

  const buttons = [$("#googleLoginBtn"), $("#googleSignupBtn")].filter(Boolean);
  buttons.forEach((button) => setButtonBusy(button, true, "Connecting to Google…"));
  message("Opening Google sign-in…", "info");

  try {
    // Popup works across desktop and modern mobile browsers and avoids the cross-origin
    // storage issue that can affect signInWithRedirect on non-Firebase hosts.
    await choosePersistence(true);
    await signInWithPopup(auth, provider);
    message("Google sign-in successful. Opening PickleFinder…", "success");
    location.replace("dashboard.html");
  } catch (error) {
    console.warn("Google popup sign-in failed:", error);

    // Only fall back to redirect when the popup cannot be used.
    if (["auth/popup-blocked", "auth/cancelled-popup-request"].includes(error?.code)) {
      try {
        await choosePersistence(true);
        message("Popup was unavailable. Redirecting to Google sign-in…", "info");
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        message(friendlyError(redirectError), "error");
      }
    } else {
      message(friendlyError(error), "error");
    }
  } finally {
    // Redirect navigation will unload this page; harmless when it does not.
    buttons.forEach((button) => {
      if (document.body.contains(button) && button.disabled) setButtonBusy(button, false);
    });
  }
}

$("#googleLoginBtn")?.addEventListener("click", handleGoogle);
$("#googleSignupBtn")?.addEventListener("click", handleGoogle);

$("#loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return message("Firebase is not configured.", "error");

  const email = $("#loginEmail")?.value.trim();
  const password = $("#loginPassword")?.value || "";
  const remember = $("#rememberMe")?.checked ?? true;
  const button = event.submitter || $("#loginForm .primary-btn");

  if (!email || !password) return message("Enter your email and password.", "error");
  setButtonBusy(button, true, "Signing in…");
  message("Checking your account…", "info");

  try {
    await choosePersistence(remember);
    await signInWithEmailAndPassword(auth, email, password);
    message("Signed in successfully. Opening PickleFinder…", "success");
    location.replace("dashboard.html");
  } catch (error) {
    message(friendlyError(error), "error");
    setButtonBusy(button, false);
  }
});

$("#signupForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return message("Firebase is not configured.", "error");

  const name = $("#signupName")?.value.trim();
  const email = $("#signupEmail")?.value.trim();
  const password = $("#signupPassword")?.value || "";
  const confirm = $("#signupConfirm")?.value || "";
  const terms = $("#acceptTerms")?.checked;
  const button = event.submitter || $("#signupForm .primary-btn");

  if (!name || name.length < 2) return message("Enter a display name with at least 2 characters.", "error");
  if (!email || !password) return message("Complete the required fields.", "error");
  if (password.length < 6) return message("Password must contain at least 6 characters.", "error");
  if (password !== confirm) return message("Passwords do not match.", "error");
  if (!terms) return message("Please accept the community-use note.", "error");

  setButtonBusy(button, true, "Creating account…");
  message("Creating your PickleFinder account…", "info");

  try {
    await choosePersistence(true);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    message("Account created successfully. Opening PickleFinder…", "success");
    location.replace("dashboard.html");
  } catch (error) {
    message(friendlyError(error), "error");
    setButtonBusy(button, false);
  }
});

$("#forgotForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return message("Firebase is not configured.", "error");

  const email = $("#forgotEmail")?.value.trim();
  const button = event.submitter || $("#forgotForm .primary-btn");
  if (!email) return message("Enter your email address.", "error");

  setButtonBusy(button, true, "Sending reset email…");
  try {
    await sendPasswordResetEmail(auth, email);
    message("Reset email sent. Check your inbox and spam folder.", "success");
  } catch (error) {
    message(friendlyError(error), "error");
  } finally {
    setButtonBusy(button, false);
  }
});
