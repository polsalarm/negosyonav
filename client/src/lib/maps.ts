/// <reference types="@types/google.maps" />

declare global {
  interface Window {
    google?: typeof google;
  }
}

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<typeof google>((resolve, reject) => {
    const fail = (err: Error) => {
      loaderPromise = null;
      reject(err);
    };
    if (typeof window === "undefined") {
      fail(new Error("Google Maps cannot load on the server"));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) {
      fail(new Error("VITE_GOOGLE_MAPS_API_KEY missing"));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=marker,routes,geometry`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else fail(new Error("Google Maps script loaded but window.google.maps missing"));
    };
    s.onerror = () => fail(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}
