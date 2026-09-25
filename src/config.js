/**
 * DGPL System-1 & BRPilot Centralized Configuration Registry
 * Single Source of Truth (SSOT) for Local & Cloud Engine Endpoints.
 * Change or configure here once to update across the entire application.
 */

export const DGPL_CONFIG = {
  // Default base URL: point to Local Rust Engine (http://127.0.0.1:8000) by default.
  // To switch to Cloud: change DEFAULT_BASE_URL to "https://br.durbhasigurukulam.com"
  // or set localStorage.setItem("dgpl_base_url", "https://br.durbhasigurukulam.com")
  DEFAULT_BASE_URL: "http://127.0.0.1:8000",
  CLOUD_BASE_URL: "https://br.durbhasigurukulam.com",
  LOCAL_BASE_URL: "http://127.0.0.1:8000",

  /**
   * Resolves the active base URL dynamically.
   * Priority: localStorage("dgpl_base_url") > Vite ENV > DEFAULT_BASE_URL
   */
  getBaseUrl() {
    return (
      localStorage.getItem("dgpl_base_url") ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_DGPL_BASE_URL) ||
      this.DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
  },

  /**
   * Sets the base URL in localStorage for runtime persistence.
   */
  setBaseUrl(url) {
    if (url) {
      localStorage.setItem("dgpl_base_url", url.replace(/\/+$/, ""));
    } else {
      localStorage.removeItem("dgpl_base_url");
    }
  },

  /**
   * Primary REST Decision Endpoint (/api/v1/systemone)
   */
  getApiUrl() {
    return (
      localStorage.getItem("dgpl_api_url") ||
      `${this.getBaseUrl()}/api/v1/systemone`
    );
  },

  /**
   * Real-Time WebSocket Decision Stream (/ws/v1/stream)
   */
  getWsUrl() {
    if (localStorage.getItem("dgpl_ws_url")) {
      return localStorage.getItem("dgpl_ws_url");
    }
    const base = this.getBaseUrl();
    const wsProto = base.startsWith("https") ? "wss:" : "ws:";
    const host = base.replace(/^https?:\/\//, "");
    return `${wsProto}//${host}/ws/v1/stream`;
  },

  /**
   * Health Check & Telemetry SLA Endpoint (/api/v1/health)
   */
  getHealthUrl() {
    return `${this.getBaseUrl()}/api/v1/health`;
  },

  /**
   * Developer Keys Portal Page
   */
  getKeysPageUrl() {
    return `${this.getBaseUrl()}/#keys`;
  },

  /**
   * Instant Auto-Approved Key Request API (/auth/keys/request)
   */
  getKeysRequestUrl() {
    return `${this.getBaseUrl()}/auth/keys/request`;
  },

  /**
   * Returns true if currently targeting local instance
   */
  isLocal() {
    const base = this.getBaseUrl();
    return base.includes("localhost") || base.includes("127.0.0.1") || base.includes("192.168.");
  },

  /**
   * Human readable engine label
   */
  getEnvironmentLabel() {
    return this.isLocal() ? "DGPL Local Engine" : "DGPL Cloud Engine";
  }
};

export default DGPL_CONFIG;
