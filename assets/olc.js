// Minimal Open Location Code ("Plus Code") decoder.
// Several listings use short codes like "56MH+8GR". Combined with a nearby reference point
// (the city center) they resolve to an exact location without calling any web service.
const ALPHABET = "23456789CFGHJMPQRVWX";
const PLUS_RE = /\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})/i;

export function findPlusCode(text) {
  const m = String(text || "").match(PLUS_RE);
  return m ? m[1].toUpperCase() : null;
}

export function stripPlusCode(text) {
  return String(text || "").replace(PLUS_RE, "").replace(/^[\s,]+/, "").trim();
}

// First `digits` characters of the code that contains (lat, lng) — used to complete a short code.
function encodePrefix(lat, lng, digits) {
  let la = lat + 90, lo = lng + 180, pv = 20, out = "";
  for (let i = 0; i < digits / 2; i++) {
    const dLa = Math.min(19, Math.floor(la / pv));
    const dLo = Math.min(19, Math.floor(lo / pv));
    out += ALPHABET[dLa] + ALPHABET[dLo];
    la -= dLa * pv; lo -= dLo * pv; pv /= 20;
  }
  return out;
}

// Decode a full code (>= 8 digits before "+", pair digits only) to its center.
function decodeFull(code) {
  const digits = code.replace("+", "").slice(0, 10);
  let la = -90, lo = -180, pv = 20, size = 20;
  for (let i = 0; i + 1 < digits.length; i += 2) {
    la += ALPHABET.indexOf(digits[i]) * pv;
    lo += ALPHABET.indexOf(digits[i + 1]) * pv;
    size = pv;
    pv /= 20;
  }
  return { lat: la + size / 2, lng: lo + size / 2 };
}

// Resolve a short code (e.g. "56MH+8GR") against a reference location.
export function decodePlusCode(code, refLat, refLng) {
  code = String(code).toUpperCase();
  const plus = code.indexOf("+");
  if (plus < 0) return null;
  const pad = 8 - plus;
  let center;
  if (pad <= 0) {
    center = decodeFull(code);
  } else {
    if (pad % 2 !== 0 || pad > 6) return null;
    center = decodeFull(encodePrefix(refLat, refLng, pad) + code);
    const res = Math.pow(20, 2 - pad / 2);
    const half = res / 2;
    if (refLat + half < center.lat && center.lat - res >= -90) center.lat -= res;
    else if (refLat - half > center.lat && center.lat + res <= 90) center.lat += res;
    if (refLng + half < center.lng) center.lng -= res;
    else if (refLng - half > center.lng) center.lng += res;
  }
  return Number.isFinite(center.lat) && Number.isFinite(center.lng) ? center : null;
}
