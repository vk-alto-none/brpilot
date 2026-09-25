/**
 * DGPL System-1 — Direct In-Browser ONNX Runtime Neural Engine
 * Classification: PROPRIETARY & CONFIDENTIAL — COMMERCIAL ENTERPRISE (DGPL)
 * Direct WebAssembly (WASM) / WebGPU in-browser neural execution.
 * Zero HTTP requests, zero cloud latency, zero external API keys needed.
 */

import * as ort from "onnxruntime-web";

// Configure ONNX WebAssembly environment
ort.env.wasm.numThreads = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
ort.env.wasm.simd = true;

class LocalONNXEngine {
  constructor() {
    this.session = null;
    this.loadingPromise = null;
    this.modelPath = "/onnx/dgpl_system1_v2.onnx";
    this.candidateCache = new Map();
    this.isReady = false;
  }

  textToTokens(text) {
    const maxLen = 128;
    const tokens = new BigInt64Array(maxLen);
    const chars = text.slice(0, maxLen);
    for (let i = 0; i < chars.length; i++) {
      const code = chars.charCodeAt(i) + 100;
      tokens[i] = BigInt(Math.max(1, Math.min(code, 31999)));
    }
    for (let i = chars.length; i < maxLen; i++) {
      tokens[i] = 1n; // Pad token
    }
    return tokens;
  }

  async init() {
    if (this.isReady) return true;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        console.log("⚡ [Local ONNX] Initializing in-browser WebAssembly neural engine...");
        const options = {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all"
        };
        this.session = await ort.InferenceSession.create(this.modelPath, options);
        this.isReady = true;
        console.log("✅ [Local ONNX] DGPL System-1 v2.0 (48.8M ONNX) successfully loaded in browser memory!");

        // Warm up and pre-cache common candidate action vectors
        await this.preCacheCommonCandidates();
        return true;
      } catch (err) {
        console.warn("⚠️ [Local ONNX] In-browser ONNX WebAssembly init failed:", err);
        this.isReady = false;
        this.loadingPromise = null;
        return false;
      }
    })();

    return this.loadingPromise;
  }

  async getVectorForText(text) {
    if (this.candidateCache.has(text)) {
      return this.candidateCache.get(text);
    }
    const tokens = this.textToTokens(text);
    const inputTensor = new ort.Tensor("int64", tokens, [1, 128]);
    const feeds = { input_ids: inputTensor };
    const results = await this.session.run(feeds);
    
    // Output 1 is the pooled latent representation [1, 256]
    const outputNames = Object.keys(results);
    const pooledTensor = results[outputNames[1]] || results.pooled || results.output;
    const pooledVec = Array.from(pooledTensor.data);
    this.candidateCache.set(text, pooledVec);
    return pooledVec;
  }

  async preCacheCommonCandidates() {
    const common = [
      "cruise", "steer_left", "steer_right", "emergency_brake", "v0", "v1", "v2", "v3",
      "brake_hard", "swerve_left", "swerve_right", "maintain_speed", "accelerate_smoothly"
    ];
    for (const c of common) {
      try {
        await this.getVectorForText(c);
      } catch (e) {}
    }
  }

  cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA <= 0 || normB <= 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async evaluateDecision(task, stateDesc, candidates = ["v0", "v1", "v2", "v3"]) {
    const t0 = performance.now();
    if (!this.isReady) {
      const ok = await this.init();
      if (!ok) throw new Error("Local ONNX Engine not available");
    }

    const tokens = this.textToTokens(stateDesc);
    const inputTensor = new ort.Tensor("int64", tokens, [1, 128]);
    const feeds = { input_ids: inputTensor };
    const results = await this.session.run(feeds);

    const outputNames = Object.keys(results);
    const pooledTensor = results[outputNames[1]] || results.pooled;
    const pooledVec = Array.from(pooledTensor.data);

    // Compute similarity against all candidate actions
    const rawScores = [];
    for (const cand of candidates) {
      const candVec = await this.getVectorForText(cand);
      rawScores.push(this.cosineSimilarity(pooledVec, candVec));
    }

    // Z-Score Standardization to overcome embedding anisotropy
    const mean = rawScores.reduce((a, b) => a + b, 0) / Math.max(1, rawScores.length);
    const variance = rawScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, rawScores.length);
    const stdDev = Math.max(1e-4, Math.sqrt(variance));

    const zScores = rawScores.map(s => (s - mean) / stdDev);
    const maxZ = Math.max(...zScores);
    const tau = 0.85; // Calibrated sharp temperature
    const expSims = zScores.map(z => Math.exp((z - maxZ) / tau));
    const expSum = Math.max(1e-6, expSims.reduce((a, b) => a + b, 0));
    const probs = expSims.map(e => e / expSum);

    let bestIdx = 0;
    let bestProb = -1;
    const dist = {};
    for (let i = 0; i < candidates.length; i++) {
      const p = Math.round(probs[i] * 10000) / 10000;
      dist[candidates[i]] = p;
      if (p > bestProb) {
        bestProb = p;
        bestIdx = i;
      }
    }

    const elapsedMs = Math.round((performance.now() - t0) * 100) / 100;

    return {
      status: "success",
      decision: {
        primitive: "choice",
        selected: candidates[bestIdx],
        confidence: bestProb,
        distribution: dist,
        model: "DGPL-System1-v2.0 (Browser-WASM-ONNX)",
        latency_us: elapsedMs * 1000
      },
      key_tier: "in_browser_wasm",
      latency_us: elapsedMs * 1000,
      model: "DGPL-System1-v2.0"
    };
  }
}

export const localONNX = new LocalONNXEngine();
export default localONNX;
