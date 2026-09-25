/**
 * DGPL System-1 & BRPilot Centralized Configuration Registry
 * Single Source of Truth (SSOT) for In-Browser ONNX, Local Rust & Cloud Engine Endpoints.
 */

export const DGPL_CONFIG = {
  DEFAULT_MODE: "wasm", // Direct In-Browser ONNX WASM Engine (0ms network, zero setup)
  DEFAULT_BASE_URL: "http://127.0.0.1:8000",
  CLOUD_BASE_URL: "https://br.durbhasigurukulam.com",
  LOCAL_BASE_URL: "http://127.0.0.1:8000",

  getEngineMode() {
    return localStorage.getItem("dgpl_engine_mode") || this.DEFAULT_MODE;
  },

  setEngineMode(mode) {
    if (mode) {
      localStorage.setItem("dgpl_engine_mode", mode);
      if (mode === "cloud") {
        this.setBaseUrl(this.CLOUD_BASE_URL);
      } else if (mode === "local") {
        this.setBaseUrl(this.LOCAL_BASE_URL);
      }
    }
  },

  isWasm() {
    return this.getEngineMode() === "wasm";
  },

  isLocal() {
    return this.getEngineMode() === "local" || this.getEngineMode() === "wasm";
  },

  getBaseUrl() {
    return (
      localStorage.getItem("dgpl_base_url") ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_DGPL_BASE_URL) ||
      (this.getEngineMode() === "cloud" ? this.CLOUD_BASE_URL : this.DEFAULT_BASE_URL)
    ).replace(/\/+$/, "");
  },

  setBaseUrl(url) {
    if (url) {
      localStorage.setItem("dgpl_base_url", url.replace(/\/+$/, ""));
    } else {
      localStorage.removeItem("dgpl_base_url");
    }
  },

  getApiUrl() {
    return (
      localStorage.getItem("dgpl_api_url") ||
      `${this.getBaseUrl()}/api/v1/systemone`
    );
  },

  getWsUrl() {
    if (localStorage.getItem("dgpl_ws_url")) {
      return localStorage.getItem("dgpl_ws_url");
    }
    const base = this.getBaseUrl();
    const wsProto = base.startsWith("https") ? "wss:" : "ws:";
    const host = base.replace(/^https?:\/\//, "");
    return `${wsProto}//${host}/ws/v1/stream`;
  },

  getHealthUrl() {
    return `${this.getBaseUrl()}/api/v1/health`;
  },

  getKeysPageUrl() {
    return `${this.getBaseUrl()}/#keys`;
  },

  getKeysRequestUrl() {
    return `${this.getBaseUrl()}/auth/keys/request`;
  },

  getEnvironmentLabel() {
    const mode = this.getEngineMode();
    if (mode === "wasm") return "DGPL In-Browser ONNX (WASM)";
    if (mode === "local") return "DGPL Local Engine (Rust)";
    return "DGPL Cloud Engine";
  }
};

export default DGPL_CONFIG;
