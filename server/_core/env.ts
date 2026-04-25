export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  firebaseStorageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ??
    (process.env.FIREBASE_PROJECT_ID
      ? `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      : ""),
  // Legacy — kept for unused Forge-based files that still compile
  forgeApiUrl: "",
  forgeApiKey: "",
  cookieSecret: "",
  oAuthServerUrl: "",
  appId: "",
  ownerOpenId: "",
};
