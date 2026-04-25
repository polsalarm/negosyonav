/// <reference types="@types/google.maps" />

declare global {
  interface Window {
    google?: typeof google;
  }
}

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Maps cannot load on the server"));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      reject(new Error("VITE_GOOGLE_MAPS_API_KEY missing"));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=marker,routes,geometry`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps script loaded but window.google.maps missing"));
    };
    s.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}
