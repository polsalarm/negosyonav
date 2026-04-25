export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  // Legacy — kept for unused Forge-based files that still compile
  forgeApiUrl: "",
  forgeApiKey: "",
  cookieSecret: "",
  oAuthServerUrl: "",
  appId: "",
  ownerOpenId: "",
};
