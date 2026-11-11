/**
 * AEROBOARD - Site-owner configuration. This is a PUBLIC file on GitHub Pages.
 * Never put secrets, cookies, API keys, or tokens here!
 */
window.AEROBOARD_CONFIG = {
  // Step 1: Roblox Creator Dashboard > OAuth 2.0 Apps > Create App.
  // Add the deployed website URL as an exact redirect URI, then paste the Client ID below.
  // The OAuth app needs only the openid and profile scopes.
  robloxClientId: "",

  // Step 2 (optional, requires provider permission): a browser-readable HTTPS API
  // that reports flight positions for the verified user. Example *format only*:
  // https://provider.example/api/projectflight/position/{userId}
  // Placeholders: {userId}, {username}. Do not use a private API key here.
  flightPositionsEndpoint: "",

  // Poll the permitted tracking source every 10 seconds while the page is open.
  refreshIntervalMs: 10000
};
