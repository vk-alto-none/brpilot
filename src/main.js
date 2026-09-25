import "./style.css";
import {
  createIcons,
  Braces,
  RotateCw,
  Video,
  Pause,
  Play,
  Map,
  Maximize,
  Minimize,
  Sparkles,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  ArrowUpRight,
  X,
  Copy,
  Download,
  RotateCcw,
  CircleHelp,
  Plus,
  Minus,
  Grip,
  Github,
  LogOut,
  Zap,
  Key,
} from "lucide";
import { Simulation } from "./simulation.js";
import { BackgroundPlanner } from "./background-planner.js";
import { DriveScene } from "./scene.js";
import { MinimapControls } from "./minimap-controls.js";
import { Tooltips } from "./tooltips.js";
import { TouchControls } from "./touch-controls.js";
import {
  showLoading,
  hideLoading,
  loadingFailed,
  nextPaint,
} from "./loading-screen.js";
import { prepareJevRequest, expandJevAnswers, decisionInterval } from "./jev-request.js";
import { THEMES } from "./world.js";
import { candidateName, decisionControls, decisionSelection } from "./planning.js";
import { DGPL_CONFIG } from "./config.js";
import { clamp, nearestOnPath } from "./math.js";
const icons = {
  Braces,
  RotateCw,
  Video,
  Pause,
  Play,
  Map,
  Maximize,
  Minimize,
  Sparkles,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  ArrowUpRight,
  X,
  Copy,
  Download,
  RotateCcw,
  CircleHelp,
  Plus,
  Minus,
  Grip,
  Github,
  LogOut,
  Zap,
  Key,
};
const icon = (name) => `<i data-lucide="${name}"></i>`,
  $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search),
  aliases = { suburb: "town", country: "highway" },
  requested = params.get("world") || "city",
  type = aliases[requested] || requested;

// Auto-ingest API Key from URL param if provided (e.g. ?api_key=dgpl_live_...)
const urlApiKey = params.get("api_key") || params.get("key");
if (urlApiKey) {
  localStorage.setItem("dgpl_api_key", urlApiKey.trim());
}

const sim = new Simulation(
  Number(params.get("seed")) || Math.floor(Math.random() * 999999),
  THEMES[type] ? type : "city",
);
let playCredits = null,
  loading = true,
  lastMapDraw = 0;
showLoading("Loading car and scenery…");
let configured = false,
  authRequired = true,
  busy = false,
  generation = 0,
  lastDecision = null,
  lastInput = null,
  lastContext = null,
  lastApplied = 0,
  nextDecision = 0,
  nextContextCheck = 0,
  errors = 0,
  inspectorTab = "request",
  inspectFrozen = false,
  uiTime = 0,
  lastNow = performance.now(),
  toastTimer,
  crashHandled = false;
const keys = new Set(),
  tally = {
    cost: 0,
    calls: 0,
    constrained_steps: 0,
    request_bytes: 0,
    input: 0,
    output: 0,
    latencies: [],
    intervals: [],
  };
$("app").innerHTML = `
<main class="drive-area" aria-label="3D driving simulator"><canvas id="world-canvas" aria-label="Interactive three-dimensional driving world"></canvas><div id="vector-labels" aria-label="BRPilot motion vector probabilities"></div></main>
<header class="topbar glass">
  <div class="topbar-left">
    <a href="/" class="brand" aria-label="BRPilot by DGPL">
      <img class="brand-mark" src="/brand/standard-agents-mark.svg" alt=""/>
      <b>BRPilot</b>
      <span id="brand-badge-text" class="brand-badge ${DGPL_CONFIG.isLocal() ? '' : 'cloud'}">${DGPL_CONFIG.isLocal() ? 'DGPL Local' : 'DGPL Cloud'}</span>
    </a>
  </div>
  <div class="topbar-center">
    <div class="world-picker">
      <select id="world-select" aria-label="World environment" title="Environment Scene">
        <option value="city">🏙️ Skyline City</option>
        <option value="town">🏡 Small town</option>
        <option value="highway">🛣️ Interstate 08</option>
      </select>
      <select id="traffic-density-select" aria-label="Traffic density" title="Traffic Density Level">
        <option value="0">🚫 No Traffic (0)</option>
        <option value="6">🚗 Low Traffic (6)</option>
        <option value="16" selected>🚗 Standard Traffic (16)</option>
        <option value="35">🚙 Heavy Traffic (35)</option>
        <option value="65">🏎️ Extreme Chaos (65)</option>
      </select>
      <select id="traffic-behavior-select" aria-label="Traffic behavior" title="Traffic Behavior Mode">
        <option value="standard" selected>🟢 Law-Abiding</option>
        <option value="aggressive">🟡 Aggressive</option>
        <option value="jaywalking">🚶 Jaywalking Pedestrians</option>
        <option value="indian_chaos">🇮🇳 Indian Chaos (Jaywalkers + Wrong-Way)</option>
        <option value="chaos">🔴 Lawless (Rulebreakers)</option>
      </select>
      <button id="new-world" class="icon-btn" title="Refresh world" aria-label="Refresh world">${icon("rotate-cw")}</button>
    </div>
  </div>
  <div class="topbar-right">
    <div class="engine-switch-container">
      <select id="engine-target-select" class="engine-target-select" aria-label="Engine Target" title="Switch between Local and Cloud Engine">
        <option value="local" ${DGPL_CONFIG.isLocal() ? 'selected' : ''}>💻 DGPL Local (127.0.0.1:8000)</option>
        <option value="cloud" ${!DGPL_CONFIG.isLocal() ? 'selected' : ''}>☁️ DGPL Cloud (br.durbhasigurukulam.com)</option>
      </select>
    </div>
    <button id="key-modal-btn" class="key-pill-btn" title="DGPL System-1 API Connection">
      <span id="key-status-dot-pill" class="pill-dot pill-dot-offline"></span>
      <span id="key-badge-text">🔒 Connect API Key</span>
    </button>
    <a id="github-link" class="icon-btn" href="https://github.com/vk-alto-none/brpilot" target="_blank" rel="noopener noreferrer" aria-label="View BRPilot on GitHub" title="View on GitHub">${icon("github")}</a>
  </div>
</header>
<div class="navigation-hud"><div class="navigation-card glass"><span id="turn-icon">${icon("arrow-up")}</span><div><strong id="next-maneuver">Continue straight</strong><span id="turn-distance"></span></div><span class="nav-divider"></span><span id="remaining"></span><button id="map-toggle" aria-label="Toggle route map" aria-pressed="true" title="Hide route map">${icon("map")}</button></div>
<div id="minimap" class="minimap glass"><div class="minimap-toolbar" role="toolbar" aria-label="Minimap controls"><button id="map-drag" aria-label="Move minimap" title="Move minimap · drag or use arrow keys">${icon("grip")}</button><div><button id="map-zoom-out" aria-label="Zoom out" title="Zoom out">${icon("minus")}</button><button id="map-zoom-in" aria-label="Zoom in" title="Zoom in">${icon("plus")}</button><button id="map-reset" aria-label="Reset minimap" title="Reset map position, zoom and following">${icon("rotate-ccw")}</button></div></div><canvas id="map-canvas" width="380" height="310" aria-label="Route map. Drag to pan, scroll to zoom, double-click to follow the car."></canvas></div></div>
<div id="paused-overlay" hidden><div class="glass"><span>${icon("pause")} Paused</span><button id="resume" class="primary">Resume driving</button></div></div>
<div id="arrival" class="arrival glass" hidden><span class="arrival-mark">${icon("flag")}</span><span class="eyebrow">DESTINATION REACHED</span><h1>You made it.</h1><p id="arrival-summary"></p><button id="next-trip" class="primary">Next drive ${icon("arrow-up-right")}</button><button id="keep-driving" class="subtle">Keep exploring</button></div>
<div class="bottom-hud"><div class="driver-dock glass"><div class="speed-cluster"><div title="Current speed"><strong id="speed">0</strong><span>km/h</span></div><span class="speed-limit" title="Speed limit"><small>LIMIT</small><b id="speed-limit">50</b></span></div><span class="dock-divider"></span><div class="pilot-actions"><button id="autopilot" class="pilot-button" role="switch" aria-checked="false" aria-label="BRPilot autopilot" title="Engage BRPilot · J">${icon("sparkles")}<span id="pilot-label">Engage BRPilot</span><kbd>J</kbd></button><button id="rush-toggle" class="rush-button" role="switch" aria-checked="false" aria-label="Toggle Rush Super Driver Mode" title="Rush Super Driver Mode · R">${icon("zap")}<span id="rush-label">Rush Mode</span><kbd>R</kbd></button><button id="emergency-toggle" class="emergency-button" role="switch" aria-checked="false" aria-label="Toggle Emergency Ambulance Mode" title="Emergency Ambulance Mode · E"><span class="siren-emoji">🚨</span><span id="emergency-label">Ambulance</span><kbd>E</kbd></button><button id="candidates-toggle" class="candidate-button" aria-label="Show steering candidates" aria-pressed="false" title="Show steering candidates"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20V3m-3 3 3-3 3 3M12 20C12 14 7 12 3 8m0 3V8h3M12 20c0-6 5-8 9-12m-3 0h3v3"/><circle cx="12" cy="21" r="1" fill="currentColor" stroke="none"/></svg></button></div><div id="decision-status"><span id="pilot-state">Free play</span><span id="context-message">WASD to drive · Space to brake</span><span class="cost-total" title="Estimated cost from BRPilot token usage and configured pricing."><span id="cost-label">Session</span> <strong id="cost">$0.000000</strong></span></div><span class="dock-divider"></span><div class="dock-tools" role="group" aria-label="View and driving controls"><button id="camera" title="Change camera · C" aria-label="Change camera">${icon("video")}<span id="camera-name">Chase</span></button><button id="scene-json" aria-label="Inspect live JSON" title="Inspect live JSON">${icon("braces")}</button><button id="fullscreen" aria-label="Enter fullscreen" title="Fullscreen">${icon("maximize")}</button><span class="divider"></span><button id="pause" aria-label="Pause simulation" title="Pause · P">${icon("pause")}</button><button id="sign-out" hidden aria-label="Sign out" title="Sign out">${icon("log-out")}</button></div></div></div>
<dialog id="crash-dialog" aria-labelledby="crash-title" aria-describedby="crash-description"><span class="crash-symbol">${icon("x")}</span><span class="eyebrow">DRIVE ENDED</span><h1 id="crash-title">Game over.</h1><p id="crash-description"></p><div class="crash-stats"><div><strong id="crash-speed"></strong><span>km/h at impact</span></div><div><strong id="crash-distance"></strong><span>meters driven</span></div></div><button id="retry-drive" class="primary">${icon("rotate-ccw")} Restart drive</button><button id="crash-new-world" class="secondary">Try a new world ${icon("arrow-up-right")}</button></dialog>
<dialog id="credit-dialog" aria-labelledby="credit-title"><span class="eyebrow">THANKS FOR TAKING A DRIVE</span><h2 id="credit-title">That's your free lap.</h2><p>Your $0.25 of BRPilot play credit has been used. You can keep exploring with manual controls.</p><button id="credit-close" class="primary">Keep driving manually</button><a href="https://durbhasigurukulam.com/" target="_blank" rel="noopener noreferrer">Explore DGPL ↗</a></dialog>
<dialog id="key-dialog" class="glass-dialog">
  <div class="key-modal-card">
    <div class="key-modal-header">
      <div class="key-modal-title">
        ${icon("key")}
        <div>
          <h3>${DGPL_CONFIG.getEnvironmentLabel()}</h3>
          <span class="sub-label">Autonomous Neural Decision Stream</span>
        </div>
      </div>
      <button id="close-key-dialog" class="close-btn" aria-label="Close dialog">${icon("x")}</button>
    </div>
    
    <div class="key-modal-body">
      <div class="engine-selector-box">
        <label class="section-subhead">Inference Engine Target</label>
        <div class="target-toggle-group">
          <button type="button" id="target-local-btn" class="target-btn ${DGPL_CONFIG.isLocal() ? 'active' : ''}" data-target="local">
            <span class="target-icon">💻</span>
            <div>
              <strong>DGPL Local Engine</strong>
              <small>http://127.0.0.1:8000</small>
            </div>
          </button>
          <button type="button" id="target-cloud-btn" class="target-btn ${!DGPL_CONFIG.isLocal() ? 'active' : ''}" data-target="cloud">
            <span class="target-icon">☁️</span>
            <div>
              <strong>DGPL Cloud Engine</strong>
              <small>https://br.durbhasigurukulam.com</small>
            </div>
          </button>
        </div>
      </div>
      
      <div class="key-input-container">
        <div class="input-label-row">
          <label for="dgpl-key-input">Your DGPL API Key</label>
          <span id="key-validation-badge" class="badge-neutral">Awaiting Input</span>
        </div>
        <div class="input-wrapper">
          <input type="text" id="dgpl-key-input" placeholder="dgpl_adm_... or dgpl_live_..." autocomplete="off" spellcheck="false" />
        </div>
      </div>
      
      <div id="key-status-banner" class="status-banner banner-offline">
        <div class="status-icon" id="banner-status-icon">${icon("circle-help")}</div>
        <div class="status-text-block">
          <strong id="banner-status-title">Offline Mode</strong>
          <span id="banner-status-detail">Please enter an active DGPL API key to enable autonomous cloud driving.</span>
        </div>
      </div>
      
      <div class="key-modal-actions">
        <button id="save-key-btn" class="btn-primary">Save & Connect ⚡</button>
        <button id="test-key-btn" class="btn-secondary">Test Connection ⏱️</button>
        <button id="clear-key-btn" class="btn-subtle">Clear Key</button>
      </div>
      
      <div class="key-modal-footer">
        <span>Need an API key?</span>
        <a href="${DGPL_CONFIG.getKeysPageUrl()}" target="_blank" rel="noopener noreferrer">DGPL Platform & Key Manager ↗</a>
      </div>
    </div>
  </div>
</dialog>
<div id="toast" role="status" hidden></div>
<dialog id="json-dialog"><div class="json-header"><div>${icon("braces")}<strong>Under the hood</strong><span id="json-live">LIVE · 4 Hz</span></div><button id="close-json" aria-label="Close JSON inspector">${icon("x")}</button></div><div class="json-toolbar"><div class="json-tabs"><button data-tab="request" class="active">BRPilot input</button><button data-tab="sensor">Perception</button><button data-tab="world">Full world</button><button data-tab="decision">Response</button></div><div class="json-actions"><button id="freeze-json">Freeze</button><button id="copy-json" aria-label="Copy displayed JSON">${icon("copy")} <span id="copy-json-label" aria-live="polite">Copy</span></button><button id="download-json">${icon("download")} Download</button></div></div><p id="json-description">Exact BRPilot API payload, including instructions and offered choices. Full geometry and control details stay local.</p><pre id="json-content"></pre></dialog>
<dialog id="help-dialog"><button id="close-help" class="dialog-close" aria-label="Close help">${icon("x")}</button><span class="eyebrow">YOUR NEXT DRIVE</span><h2>Take the wheel.</h2><p class="touch-help">Use the thumbstick to steer. Push up to accelerate, pull down to brake and reverse. Release to coast; hold Brake to stop.</p><div class="help-keys"><span><kbd>W / ↑</kbd> Hold accelerator</span><span><kbd>S / ↓</kbd> Brake / reverse</span><span><kbd>A / D</kbd> Steer</span><span><kbd>SPACE</kbd> Brake</span><span><kbd>J</kbd> BRPilot autopilot</span><span><kbd>C</kbd> Camera</span><span><kbd>P</kbd> Pause</span><span><kbd>?</kbd> Keyboard help</span></div><p>Drag the scene to orbit in Chase or Bird’s eye; drag to look around in Driver view. Scroll to zoom outside; double-click to recenter. Tap A/D for small corrections; hold for a sharper turn and release to recenter. Hold W to accelerate; release to coast with drag. S brakes, then reverses once stopped. Space applies the brake. Autopilot sets target speed directly.</p><p>The bright blue line is BRPilot's selected three-second plan. Use Candidates to see the sampled paths: forward in blue/cyan, reverse in purple, lane departures in amber, and predicted collisions in orange. Choice probabilities are available in the JSON inspector. The safety brake can reduce speed for a missed hazard; interventions are shown beside the autopilot button.</p><p class="asset-credits">Vehicle: <a href="https://sketchfab.com/3d-models/tesla-model-y-2021-c0a86cac582d4b33aba0fb1b1912d970" target="_blank" rel="noreferrer">Tesla Model Y 2021</a> by 763468712, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Geometry adapted by Tina 3D Tesla; optimized, re-materialed, and wheel-rigged for BRPilot. Tree, shrub, streetlight, surface textures and sky: <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a>, CC0.</p><p>Driving keys take back control. Use the JSON button for live inputs, full world state, probabilities, and session telemetry.</p></dialog>`;
$("app").insertAdjacentHTML(
  "beforeend",
  `
<div id="touch-controls" class="touch-controls" role="group" aria-label="Touch driving controls" hidden>
  <div class="touch-steering">
    <div class="touch-stick" role="group" aria-label="Driving joystick: drag up to accelerate, down to brake or reverse, left or right to steer">
      <span class="stick-up" aria-hidden="true">↑</span><span class="stick-down" aria-hidden="true">↓</span>
      <span class="stick-left" aria-hidden="true">‹</span><span class="stick-right" aria-hidden="true">›</span>
      <span class="touch-knob" aria-hidden="true"></span>
    </div>
    <span class="touch-hint">Drag to drive</span>
  </div>
  <button class="touch-brake" aria-label="Hold to brake"><span aria-hidden="true">Ⅱ</span>Brake</button>
</div>`,
);
createIcons({ icons });
const scene = new DriveScene($("world-canvas"), sim, $("vector-labels")),
  map = $("map-canvas").getContext("2d");
const minimap = new MinimapControls($("minimap"), sim, drawMap);
const tooltips = new Tooltips();
const touch = new TouchControls(
  $("touch-controls"),
  () =>
    !loading &&
    !sim.autopilot &&
    !sim.paused &&
    !sim.crash &&
    !document.hidden &&
    !document.querySelector("dialog[open]") &&
    (sim.freeExplore || !sim.complete),
);
const dockObserver = new ResizeObserver(([entry]) => {
  // Anchor both thumbs above the actual dock, including wrapped mobile layouts.
  const height =
    entry.borderBoxSize?.[0]?.blockSize ?? entry.target.offsetHeight;
  document.documentElement.style.setProperty("--dock-height", `${height}px`);
});
dockObserver.observe(document.querySelector(".driver-dock"));
for (const element of document.querySelectorAll(
  ".bottom-hud button, .bottom-hud [title], .minimap button, #map-toggle, #github-link",
))
  tooltips.set(element, element.title || element.getAttribute("aria-label"));
const planner = new BackgroundPlanner();
sim.backgroundPlanning = true;
let planningJob = null,
  rerouting = false,
  previewError = false;
async function refreshPlan() {
  if (planningJob) return planningJob;
  const token = generation,
    version = sim.routeVersion;
  const job = planner
    .run("plan", sim)
    .then((result) => {
      if (token !== generation || version !== sim.routeVersion || sim.crash)
        return null;
      sim.lastPlan = result.plan;
      result.state.rush_mode = rushMode;
      result.state.emergency_mode = emergencyMode;
      result.state.driver_profile = emergencyMode ? "emergency_ambulance" : (rushMode ? "super_driver" : "standard");
      sim.lastDecisionState = result.state;
      sim.routeChoices = result.routeChoices;
      sim.routeChoicesOrigin = result.routeChoicesOrigin;
      sim.nextRouteChoices = result.nextRouteChoices;
      return result;
    })
    .finally(() => {
      if (planningJob === job) planningJob = null;
    });
  planningJob = job;
  return job;
}
function requestPreview() {
  if (sim.autopilot || sim.crash) return;
  refreshPlan()
    .then((result) => {
      if (result && !sim.autopilot) scene.vectors.setCandidates(result.plan);
    })
    .catch((error) => {
      if (!previewError) {
        previewError = true;
        toast(error.message);
      }
    });
}
sim.requestReroute = async () => {
  if (rerouting || !sim.routeChoiceNeeded()) return;
  rerouting = true;
  const token = generation,
    version = sim.routeVersion;
  try {
    const next = await planner.run("reroute", sim);
    if (
      !next ||
      token !== generation ||
      version !== sim.routeVersion ||
      sim.crash ||
      !sim.routeChoiceNeeded()
    )
      return;
    if (next.route.ids.join(",") === sim.player.route.ids.join(",")) return;
    sim.installRoute({
      ...next,
      progress: nearestOnPath(sim.player, next.route.points).s,
    });
  } catch (error) {
    toast(error.message);
  } finally {
    rerouting = false;
  }
};
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    planner.dispose();
    minimap.dispose();
    tooltips.dispose();
    touch.dispose();
    dockObserver.disconnect();
    scene.dispose();
  });

function toast(text, type = "info") {
  $("toast").textContent = text;
  $("toast").classList.toggle("error", type === "error");
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4200);
}
function refreshWorld() {
  const w = sim.world;
  $("world-select").value = w.type;
  $("speed-limit").textContent = Math.round(w.theme.limit * 3.6);
  $("arrival").hidden = true;
}
function syncPilot() {
  const on = sim.autopilot;
  $("autopilot").setAttribute("aria-checked", String(on));
  $("pilot-label").textContent = on ? "BRPilot engaged" : "Engage BRPilot";
  tooltips.set($("autopilot"), `${on ? "Disengage" : "Engage"} BRPilot · J`);
  $("autopilot").disabled = !!sim.crash;
  document.body.classList.toggle("piloting", on);
  touch.sync();
}

function setPilot(on) {
  if (loading) return;
  touch.reset();
  const apiKey = localStorage.getItem("dgpl_api_key") || "";
  if (on && !apiKey) {
    toast("🔒 DGPL System-1 API Key Required. Autopilot is powered exclusively by DGPL Cloud.", "error");
    $("key-dialog").showModal();
    return;
  }
  if (on && !configured) {
    toast("⚠️ DGPL System-1 Cloud is unreachable. Autopilot requires live cloud connectivity.", "error");
    return;
  }
  if (sim.crash || (on && sim.complete)) return;
  sim.autopilot = on;
  if (on) sim.freeExplore = false;
  generation++;
  lastApplied = 0;
  nextDecision = 0;
  errors = 0;
  sim.player.target = 0;
  sim.player.steering = 0;
  sim.player.steeringProgress = 0;
  sim.player.maneuver = null;
  scene.vectors.clear();
  syncPilot();
}
async function resetWorld(seed = sim.world.seed, type = sim.world.type) {
  if (loading) return;
  loading = true;
  touch.reset();
  showLoading("Building your next drive…");
  generation++;
  crashHandled = false;
  $("crash-dialog").close();
  document.body.classList.remove("crashed");
  keys.clear();
  await nextPaint();
  try {
    sim.reset(seed, type);
    minimap.resetView();
    planner.reset();
    previewError = false;
    lastApplied = 0;
    lastDecision = null;
    lastInput = null;
    lastContext = null;
    scene.build();
    scene.vectors.showCandidates = showCandidates;
    refreshWorld();
    syncPilot();
    $("paused-overlay").hidden = true;
    $("pause").innerHTML = icon("pause");
    $("pause").setAttribute("aria-label", "Pause simulation");
    tooltips.set($("pause"), "Pause simulation · P");
    createIcons({ icons });
    await finishLoading();
  } catch (error) {
    loadingFailed(error);
  }
}
async function finishLoading() {
  showLoading("Loading car and scenery…");
  await scene.ready;
  showLoading("Preparing the road…");
  await nextPaint();
  await scene.prepare();
  await document.fonts.ready;
  await nextPaint();
  lastNow = performance.now();
  loading = false;
  hideLoading();
  touch.sync();
  updateUI();
  drawMap();
}
function changeCamera() {
  const modes = ["chase", "hood", "map"];
  scene.mode = modes[(modes.indexOf(scene.mode) + 1) % 3];
  scene.snap = true;
  $("camera-name").textContent = {
    chase: "Chase",
    hood: "Driver",
    map: "Bird’s eye",
  }[scene.mode];
  tooltips.set(
    $("camera"),
    `Change camera · ${$("camera-name").textContent} · C`,
  );
}
function togglePause() {
  if (sim.crash || loading) return;
  touch.reset();
  keys.clear();
  sim.paused = !sim.paused;
  touch.sync();
  generation++;
  lastApplied = 0;
  nextDecision = 0;
  $("paused-overlay").hidden = !sim.paused;
  $("pause").innerHTML = icon(sim.paused ? "play" : "pause");
  tooltips.set($("pause"), `${sim.paused ? "Resume" : "Pause"} simulation · P`);
  $("pause").setAttribute(
    "aria-label",
    sim.paused ? "Resume simulation" : "Pause simulation",
  );
  createIcons({ icons });
}
let rushMode = false;
let emergencyMode = false;

function toggleRushMode() {
  rushMode = !rushMode;
  sim.rush_mode = rushMode;
  const rushBtn = $("rush-toggle");
  if (rushBtn) {
    rushBtn.setAttribute("aria-checked", String(rushMode));
    rushBtn.classList.toggle("active", rushMode);
    $("rush-label").textContent = rushMode ? "Super Driver" : "Rush Mode";
    const label = `${rushMode ? "Super Driver ON (100% Safe Overtake)" : "Rush Super Driver Mode"} · R`;
    rushBtn.setAttribute("aria-label", label);
    tooltips.set(rushBtn, label);
  }
  if (sim.autopilot) {
    $("pilot-state").textContent = emergencyMode ? "🚨 Ambulance" : (rushMode ? "⚡ Super Driver" : "Autopilot");
  }
  toast(
    rushMode
      ? "⚡ Super Driver Active — High-Speed Safe Overtaking ON"
      : "🛡️ Standard Safe Autopilot Active",
  );
}

function toggleEmergencyMode() {
  emergencyMode = !emergencyMode;
  sim.emergencyMode = emergencyMode;
  const emBtn = $("emergency-toggle");
  if (emBtn) {
    emBtn.setAttribute("aria-checked", String(emergencyMode));
    emBtn.classList.toggle("active", emergencyMode);
    $("emergency-label").textContent = emergencyMode ? "Siren ON" : "Ambulance";
    const label = `${emergencyMode ? "🚨 Emergency Ambulance ON (Rules Bypassed · Obstacle Safety 100%)" : "Emergency Ambulance Mode"} · E`;
    emBtn.setAttribute("aria-label", label);
    tooltips.set(emBtn, label);
  }
  if (sim.autopilot) {
    $("pilot-state").textContent = emergencyMode ? "🚨 Ambulance" : (rushMode ? "⚡ Super Driver" : "Autopilot");
  }
  toast(
    emergencyMode
      ? "🚨 Ambulance Mode Active — Red Lights & Traffic Rules Bypassed (Pedestrians & Cars 100% Safe)"
      : "🛡️ Standard Safe Autopilot Active",
  );
}

$("rush-toggle").onclick = toggleRushMode;
$("emergency-toggle").onclick = toggleEmergencyMode;
$("autopilot").onclick = () => setPilot(!sim.autopilot);
let showCandidates = false,
  candidatePreviewAt = 0;
$("candidates-toggle").onclick = () => {
  showCandidates = !showCandidates;
  scene.vectors.showCandidates = showCandidates;
  $("candidates-toggle").setAttribute("aria-pressed", String(showCandidates));
  const label = `${showCandidates ? "Hide" : "Show"} steering candidates`;
  $("candidates-toggle").setAttribute("aria-label", label);
  tooltips.set($("candidates-toggle"), label);
  if (showCandidates && !scene.vectors.plan) requestPreview();
};
$("new-world").onclick = () => resetWorld(Math.floor(Math.random() * 999999));
$("world-select").onchange = (e) =>
  resetWorld(Math.floor(Math.random() * 999999), e.target.value);
$("traffic-density-select").onchange = (e) => {
  const count = Number(e.target.value);
  sim.setTrafficDensity(count);
  toast(`Traffic density: ${e.target.options[e.target.selectedIndex].text}`);
};
$("traffic-behavior-select").onchange = (e) => {
  const mode = e.target.value;
  sim.setTrafficBehavior(mode);
  toast(
    mode === "indian_chaos"
      ? "🇮🇳 Indian Chaos Active — Jaywalking pedestrians & wrong-way oncoming traffic!"
      : mode === "jaywalking"
        ? "🚶 Jaywalking Active — Pedestrians crossing roads arbitrarily mid-block!"
        : mode === "chaos"
          ? "🔴 Lawless Chaos Active — NPCs will run red lights & speed!"
          : mode === "aggressive"
            ? "🟡 Aggressive Traffic Active — Close following & fast acceleration"
            : "🟢 Law-Abiding Traffic Active — Standard road rules",
  );
};
$("retry-drive").onclick = () => {
  resetWorld();
  $("autopilot").focus();
};
$("crash-new-world").onclick = () =>
  resetWorld(Math.floor(Math.random() * 999999));
$("crash-dialog").addEventListener("cancel", (e) => e.preventDefault());
$("camera").onclick = changeCamera;
$("pause").onclick = togglePause;
$("resume").onclick = togglePause;
$("next-trip").onclick = () => resetWorld(Math.floor(Math.random() * 999999));
$("keep-driving").onclick = () => {
  sim.complete = false;
  sim.freeExplore = true;
  $("arrival").hidden = true;
};
$("map-toggle").onclick = () => {
  $("minimap").hidden = !$("minimap").hidden;
  $("map-toggle").setAttribute("aria-pressed", String(!$("minimap").hidden));
  tooltips.set(
    $("map-toggle"),
    `${$("minimap").hidden ? "Show" : "Hide"} route map`,
  );
  minimap.constrainPosition();
  drawMap();
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Use your browser’s fullscreen shortcut.");
  }
};
document.addEventListener("fullscreenchange", () => {
  $("fullscreen").innerHTML = icon(
    document.fullscreenElement ? "minimize" : "maximize",
  );
  $("fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
  );
  tooltips.set($("fullscreen"), $("fullscreen").getAttribute("aria-label"));
  createIcons({ icons });
});
window.addEventListener("keydown", (e) => {
  if (sim.crash || loading) return;
  if ($("json-dialog").open || $("help-dialog").open) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.target.closest("button") && ["Space", "Enter"].includes(e.code)) return;
  const driving = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ];
  if (driving.includes(e.code)) {
    e.preventDefault();
    keys.add(e.code);
    if (sim.autopilot) setPilot(false);
  }
  if (e.repeat) return;
  if (e.code === "KeyJ") setPilot(!sim.autopilot);
  if (e.code === "KeyR") toggleRushMode();
  if (e.code === "KeyE") toggleEmergencyMode();
  if (e.code === "KeyC") changeCamera();
  if (e.code === "KeyP") togglePause();
  if (e.key === "?") {
    e.preventDefault();
    touch.reset();
    $("help-dialog").showModal();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    generation++;
    keys.clear();
    sim.player.target = 0;
    lastApplied = 0;
    nextDecision = 0;
  }
});
$("close-help").onclick = () => $("help-dialog").close();
$("scene-json").onclick = () => {
  touch.reset();
  $("json-dialog").showModal();
  renderJSON();
};
$("close-json").onclick = () => $("json-dialog").close();
document.querySelectorAll("[data-tab]").forEach(
  (button) =>
    (button.onclick = () => {
      inspectorTab = button.dataset.tab;
      inspectFrozen = false;
      syncFreeze();
      document
        .querySelectorAll("[data-tab]")
        .forEach((b) => b.classList.toggle("active", b === button));
      $("json-description").textContent = {
        request:
          "Exact BRPilot API payload, including instructions and offered choices. Full geometry and control details stay local.",
        sensor:
          "Complete forward perception, route guidance, geometry predictions and vehicle telemetry.",
        world:
          "All roads, buildings, vehicles, pedestrians, controls, and the current route.",
        decision:
          "Actual BRPilot probabilities and token usage. Costs accumulate across every completed call.",
      }[inspectorTab];
      renderJSON();
    }),
);
function syncFreeze() {
  $("freeze-json").textContent = inspectFrozen ? "Resume" : "Freeze";
  $("json-live").textContent = inspectFrozen ? "FROZEN" : "LIVE · 4 Hz";
}
$("freeze-json").onclick = () => {
  inspectFrozen = !inspectFrozen;
  syncFreeze();
};
function inspectRequest(state) {
  const { request, fixed } = prepareJevRequest(state);
  return Object.keys(request.questions).length
    ? request
    : {
        status: "No BRPilot call needed: only one eligible action.",
        resolved_locally: fixed,
      };
}
function updateCredits(credits) {
  if (!credits) return;
  playCredits = credits;
  $("cost-label").textContent = "Play credit";
}
$("credit-close").onclick = () => $("credit-dialog").close();
$("sign-out").onclick = async () => {
  setPilot(false);
  sim.paused = true;
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error();
    location.assign("/login");
  } catch {
    toast("Could not sign out. Please try again.", "error");
  }
};
function updateCostTooltip(pricing) {
  const averages = tally.calls
    ? `${Math.round(tally.input / tally.calls).toLocaleString()} input tokens/call · ${(tally.request_bytes / tally.calls / 1024).toFixed(1)} KB/call. `
    : "";
  tooltips.set(
    document.querySelector(".cost-total"),
    `${playCredits ? "Remaining from your one-time $0.25 allowance. " : ""}${averages}Estimated from BRPilot tokens at $${pricing.input_per_million}/M input and $${pricing.output_per_million}/M output.`,
  );
}
function inspectData() {
  if (inspectorTab === "request") {
    if (
      !sim.lastDecisionState ||
      (!sim.autopilot && !showCandidates && !sim.paused)
    )
      requestPreview();
    return (
      lastInput ||
      (sim.lastDecisionState
        ? inspectRequest(sim.lastDecisionState)
        : { status: "Preparing driving state…" })
    );
  }
  if (inspectorTab === "decision")
    return {
      response: lastDecision,
      last_submitted_input: lastInput,
      session: {
        ...tally,
        average_input_tokens: tally.calls
          ? Math.round(tally.input / tally.calls)
          : 0,
        average_request_bytes: tally.calls
          ? Math.round(tally.request_bytes / tally.calls)
          : 0,
      },
    };
  return sim.observation(inspectorTab === "world");
}
let copyFeedbackTimer;
$("copy-json").onclick = async () => {
  // Copy exactly the snapshot on screen, including when the inspector is frozen.
  const text = $("json-content").textContent;
  const button = $("copy-json");
  clearTimeout(copyFeedbackTimer);
  button.disabled = true;
  try {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Keep the fallback inside the modal so it can receive focus for copying.
      const field = document.createElement("textarea");
      field.value = text;
      field.readOnly = true;
      field.style.cssText = "position:fixed;left:-9999px;top:0";
      $("json-dialog").append(field);
      try {
        field.select();
        if (!document.execCommand("copy")) throw Error("Clipboard unavailable");
      } finally {
        field.remove();
      }
    }
    $("copy-json-label").textContent = "Copied!";
  } catch {
    inspectFrozen = true;
    syncFreeze();
    const range = document.createRange();
    range.selectNodeContents($("json-content"));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    $("copy-json-label").textContent = "Press ⌘C / Ctrl+C";
  } finally {
    button.disabled = false;
    button.focus({ preventScroll: true });
    copyFeedbackTimer = setTimeout(() => {
      $("copy-json-label").textContent = "Copy";
    }, 3000);
  }
};
$("download-json").onclick = () => {
  const text = inspectFrozen
      ? $("json-content").textContent
      : JSON.stringify(inspectData(), null, 2),
    a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = `brpilot-${inspectorTab}-${sim.world.seed}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
function renderJSON() {
  if (inspectFrozen) return;
  const text = JSON.stringify(inspectData(), null, 2);
  $("json-content").innerHTML = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(?:\\.|[^"\\])*"\s*:?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g,
      (m) =>
        `<span class="${m.startsWith('"') ? (m.endsWith(":") ? "json-key" : "json-string") : /true|false|null/.test(m) ? "json-bool" : "json-number"}">${m}</span>`,
    );
}
let dgplWs = null;
let wsPendingCallbacks = {};
let wsReqCounter = 0;
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
let wsHeartbeatInterval = null;
let isDecidingInFlight = false;

function connectDGPLWebSocket() {
  const apiKey = localStorage.getItem("dgpl_api_key") || "";
  if (!apiKey) {
    if (dgplWs) {
      try { dgplWs.close(); } catch (e) {}
      dgplWs = null;
    }
    return null;
  }
  const wsEndpoint = DGPL_CONFIG.getWsUrl();
  
  if (dgplWs && (dgplWs.readyState === WebSocket.OPEN || dgplWs.readyState === WebSocket.CONNECTING)) {
    return dgplWs;
  }

  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  try {
    const fullWsUrl = `${wsEndpoint}?api_key=${encodeURIComponent(apiKey)}`;
    dgplWs = new WebSocket(fullWsUrl);

    dgplWs.onopen = () => {
      wsReconnectAttempts = 0;
      updateKeyStatusUI();

      if (wsHeartbeatInterval) clearInterval(wsHeartbeatInterval);
      wsHeartbeatInterval = setInterval(() => {
        if (dgplWs && dgplWs.readyState === WebSocket.OPEN) {
          try {
            dgplWs.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          } catch (e) {}
        }
      }, 8000);
    };

    dgplWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "pong") return;
        if (msg.req_id && wsPendingCallbacks[msg.req_id]) {
          const resolve = wsPendingCallbacks[msg.req_id];
          delete wsPendingCallbacks[msg.req_id];
          resolve(msg);
        }
      } catch (err) {
        console.error("[DGPL WebSocket] Message parsing error:", err);
      }
    };

    dgplWs.onerror = () => {
      updateKeyStatusUI();
    };

    dgplWs.onclose = () => {
      if (wsHeartbeatInterval) {
        clearInterval(wsHeartbeatInterval);
        wsHeartbeatInterval = null;
      }
      dgplWs = null;
      updateKeyStatusUI();

      // Reject all pending callbacks gracefully
      Object.keys(wsPendingCallbacks).forEach(id => {
        try { wsPendingCallbacks[id](null); } catch (e) {}
      });
      wsPendingCallbacks = {};

      // Exponential backoff reconnect with jitter (max 5s)
      const delay = Math.min(5000, 1000 * Math.pow(1.3, wsReconnectAttempts) + Math.random() * 400);
      wsReconnectAttempts++;
      wsReconnectTimer = setTimeout(connectDGPLWebSocket, delay);
    };
  } catch (e) {
    dgplWs = null;
    updateKeyStatusUI();
  }
  return dgplWs;
}

// Auto-reconnect listeners on tab focus and network online events
window.addEventListener("online", () => connectDGPLWebSocket());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && (!dgplWs || dgplWs.readyState !== WebSocket.OPEN)) {
    connectDGPLWebSocket();
  }
});

function sendDGPLDecisionWS(payload, timeoutMs = 2500) {
  const ws = connectDGPLWebSocket();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not connected"));
  }
  return new Promise((resolve, reject) => {
    const reqId = "req_" + (++wsReqCounter);
    payload.req_id = reqId;
    const timer = setTimeout(() => {
      if (wsPendingCallbacks[reqId]) {
        delete wsPendingCallbacks[reqId];
        reject(new Error("WebSocket timeout"));
      }
    }, timeoutMs);

    wsPendingCallbacks[reqId] = (response) => {
      clearTimeout(timer);
      if (!response) {
        reject(new Error("WebSocket closed"));
      } else {
        resolve(response);
      }
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      clearTimeout(timer);
      delete wsPendingCallbacks[reqId];
      reject(e);
    }
  });
}

// Pre-initialize WebSocket immediately on module load
connectDGPLWebSocket();

async function decide() {
  if (
    loading ||
    busy ||
    isDecidingInFlight ||
    !sim.autopilot ||
    sim.paused ||
    document.hidden ||
    sim.complete ||
    sim.crash
  )
    return;
  const now = performance.now();
  if (now < nextDecision) {
    if (errors || now < nextContextCheck || now - lastApplied < 250) return;
    nextContextCheck = now + 100;
    // Recheck lights/stop memory early while the normal cadence is relaxed.
    if (!lastContext || !sim.decisionContextChanged(lastContext)) return;
  }
  busy = true;
  isDecidingInFlight = true;
  const token = generation,
    started = performance.now();
  try {
    const planned = await refreshPlan();
    if (
      !planned ||
      token !== generation ||
      !sim.autopilot ||
      sim.paused ||
      sim.crash
    )
      return;
    const { state, plan } = planned;
    scene.vectors.setCandidates(plan);
    lastInput = inspectRequest(state);

    const prepared = prepareJevRequest(state);
    const requestQuestions = prepared.request.questions || {};
    const vectorAliases = Object.keys(prepared.aliases || {});
    const routeAliases = Object.keys(requestQuestions.route?.criteria || {});

    const candidateIds = vectorAliases.length > 0 ? vectorAliases : Object.keys(plan || {});
    const prodEndpoint = DGPL_CONFIG.getApiUrl();
    const apiKey = localStorage.getItem("dgpl_api_key") || "";

    const tStart = performance.now();
    let selectedChoice = null;
    let dist = {};
    let cloudSuccess = false;
    let transportType = "ws";

    if (!apiKey) {
      setPilot(false);
      const pilotStateEl = $("pilot-state");
      if (pilotStateEl) pilotStateEl.textContent = "🔒 API Key Required";
      return;
    }

    // Cleanly serialize navigation and road state for DGPL System-1 Text SAN Backbone
    const turnDir = typeof state.turn === "object" ? (state.turn?.direction || "straight") : (state.turn || "straight");
    const turnDist = typeof state.turn === "object" ? (state.turn?.in_m ?? 0) : 0;
    const stateDesc = `batch_${state.batch_id}_speed_${state.speed_mps.toFixed(1)}_turn_${turnDir}_dist_${turnDist}m`;

    // 1. Primary Ultra-fast WebSocket Stream (Sub-5ms overhead)
    try {
      const wsResp = await sendDGPLDecisionWS({
        type: "decision",
        task: "choice",
        state: stateDesc,
        candidates: candidateIds.length > 0 ? candidateIds : ["v0", "v1", "v2", "v3"]
      }, 2500);

      if (wsResp && wsResp.status === "success") {
        const sel = wsResp.decision?.selected;
        if (sel && candidateIds.includes(sel)) {
          selectedChoice = sel;
        }
        dist = wsResp.decision?.distribution || {};
        cloudSuccess = true;
        transportType = "ws";
      }
    } catch (wsErr) {}

    // 2. High-reliability REST Direct Fallback (/api/v1/systemone)
    if (!cloudSuccess) {
      try {
        const res = await fetch(prodEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-DGPL-API-Key": apiKey,
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            task: "choice",
            state: stateDesc,
            candidates: candidateIds.length > 0 ? candidateIds : ["v0", "v1", "v2", "v3"]
          }),
          signal: AbortSignal.timeout(4000)
        });

        if (res.ok) {
          const prodData = await res.json();
          const sel = prodData.decision?.selected;
          if (sel && candidateIds.includes(sel)) {
            selectedChoice = sel;
          }
          dist = prodData.decision?.distribution || {};
          cloudSuccess = true;
          transportType = "rest";
        } else if (res.status === 401 || res.status === 403) {
          errors++;
          setPilot(false);
          toast("❌ Invalid or Expired DGPL API Key. Autopilot disengaged.", "error");
          $("key-dialog").showModal();
          return;
        } else if (res.status === 429) {
          errors++;
          toast("⚠️ DGPL Cloud Rate Limit reached (1,000 req/min). Throttling...", "error");
          nextDecision = now + 1000;
          return;
        }
      } catch (httpErr) {}
    }

    if (!cloudSuccess || !selectedChoice) {
      errors++;
      if (errors >= 4) {
        setPilot(false);
        toast("⚠️ DGPL System-1 Cloud Connection Lost. Autopilot disengaged.", "error");
      }
      return;
    }

    errors = 0;

    const elapsedMs = performance.now() - tStart;
    const candidateProbs = {};
    candidateIds.forEach(id => {
      candidateProbs[id] = typeof dist[id] === "number" ? dist[id] : (id === selectedChoice ? 1.0 : 0.0);
    });

    const motionChoice = (state.speed_ceiling_mps === 0 && !emergencyMode) ? "stop" : "drive";
    const motionProbs = motionChoice === "drive" ? { drive: 0.98, stop: 0.02 } : { drive: 0.05, stop: 0.95 };

    const rawAnswers = {
      ...(requestQuestions.motion ? {
        motion: {
          choice: motionChoice,
          probabilities: motionProbs
        }
      } : {}),
      ...(requestQuestions.vector ? {
        vector: {
          choice: selectedChoice,
          probabilities: candidateProbs
        }
      } : {}),
      ...(requestQuestions.route && routeAliases.length > 0 ? {
        route: {
          choice: routeAliases[0],
          probabilities: { [routeAliases[0]]: 1.0 }
        }
      } : {})
    };

    const expandedAnswers = expandJevAnswers(prepared, rawAnswers);
    const selection = decisionSelection(state, expandedAnswers);
    if (!selection) throw Error("DGPL System-1 returned an incomplete decision.");

    const selectedCandidate = state.vectors[selection.choice] || Object.values(state.vectors)[0];

    const data = {
      model: "DGPL-BRPilot-v2.0 (Live Production API)",
      decision_source: "dgpl_brpilot_cloud_api",
      answers: expandedAnswers,
      selection: selection,
      batch_id: state.batch_id,
      controls: {
        steering: selectedCandidate.steering,
        velocity: selectedCandidate.velocity_mps
      },
      usage: { input_tokens: 0, output_tokens: 0 },
      latency_ms: Math.round(elapsedMs),
      cost_usd: 0.0,
      pricing: { input_per_million: 0.0, output_per_million: 0.0 }
    };

    tally.calls++;
    tally.cost = 0;
    tally.latencies.push(data.latency_ms);
    if (tally.latencies.length > 25) tally.latencies.shift();
    if (
      token !== generation ||
      state.route_version !== sim.routeVersion ||
      !sim.autopilot ||
      sim.paused ||
      sim.crash
    )
      return;
    const controls = decisionControls(state, data);
    if (!controls) {
      nextDecision = 0;
      return;
    }
    const now = performance.now();
    if (now - started > 3500) {
      // Network packet took longer than expected; silently replan immediately without stalling
      nextDecision = 0;
      return;
    }

    lastApplied = now;
    lastDecision = { ...data, received_at_simulation_s: sim.time };
    lastContext = state;
    errors = 0;

    if (sim.decisionContextChanged(state)) {
      // Apply controls immediately so the vehicle doesn't stall or freeze steering across the line
      sim.player.maneuver = state.vectors[data.selection.choice];
      sim.player.steering = controls.steering;
      sim.player.target = controls.velocity;
      scene.vectors.setAnswer(data.selection, plan);
      nextDecision = performance.now() + 30;
      return;
    }
    if (
      data.answers.route?.choice &&
      data.answers.route.choice !== "keep" &&
      sim.chooseRoute(data.answers.route.choice)
    ) {
      nextDecision = 0;
      return;
    }
    if (lastApplied) tally.intervals.push(now - lastApplied);
    if (tally.intervals.length > 20) tally.intervals.shift();
    sim.player.maneuver = state.vectors[data.selection.choice];
    sim.player.steering = controls.steering;
    sim.player.target = controls.velocity;
    scene.vectors.setAnswer(data.selection, plan);
    nextDecision = started + decisionInterval(state);
  } catch (error) {
    if (token === generation) {
      errors++;
      nextDecision = performance.now() + 100;
      if (errors >= 5) {
        sim.player.target = 0;
        setPilot(false);
        toast("⚠️ DGPL Cloud connection interrupted. Reconnecting...", "error");
      }
    }
  } finally {
    busy = false;
    isDecidingInFlight = false;
  }
}
function drawMap() {
  const w = sim.world,
    v = sim.player,
    W = 380,
    H = 310;
  const view = minimap.view(),
    scale = view.scale;
  const pt = (p) => [
    (p.x - view.center.x) * scale,
    (p.z - view.center.z) * scale,
  ];
  map.clearRect(0, 0, W, H);
  map.fillStyle = "#f3f4f6";
  map.fillRect(0, 0, W, H);
  map.save();
  map.translate(W / 2, H * 0.65);
  map.rotate(-view.heading);
  map.lineCap = "round";
  map.strokeStyle = "#d0d3d8";
  if (w.roadSamples) {
    map.lineWidth = 25 * scale;
    map.beginPath();
    w.roadSamples.forEach((p, i) =>
      i ? map.lineTo(...pt(p)) : map.moveTo(...pt(p)),
    );
    map.stroke();
  }
  if (w.connectorRoads) {
    for (const road of w.connectorRoads) {
      map.lineWidth = road.width * scale;
      map.beginPath();
      road.points.forEach((p, i) =>
        i ? map.lineTo(...pt(p)) : map.moveTo(...pt(p)),
      );
      map.stroke();
    }
  } else if (!w.roadSamples)
    for (const e of w.edges) {
      map.lineWidth = e.width * scale;
      map.beginPath();
      map.moveTo(...pt(w.byId[e.a]));
      map.lineTo(...pt(w.byId[e.b]));
      map.stroke();
    }
  map.strokeStyle = "#3e6ae1";
  map.lineWidth = 4;
  map.beginPath();
  w.route.points.forEach((p, i) =>
    i ? map.lineTo(...pt(p)) : map.moveTo(...pt(p)),
  );
  map.stroke();
  for (const car of sim.traffic) {
    map.fillStyle = car.type === "motorcycle" ? "#e82127" : "#81858d";
    map.beginPath();
    map.arc(...pt(car), 4, 0, Math.PI * 2);
    map.fill();
  }
  const end = pt(w.route.points.at(-1));
  map.fillStyle = "#171a20";
  map.fillRect(end[0] - 3, end[1] - 6, 8, 7);
  map.fillRect(end[0] - 3, end[1] - 6, 1, 14);
  // Following keeps the car pointed up; a panned map keeps its own heading.
  map.save();
  map.translate(...pt(v));
  map.rotate(v.heading);
  map.fillStyle = "#ffffff";
  map.beginPath();
  map.arc(0, 0, 13, 0, Math.PI * 2);
  map.fill();
  map.fillStyle = "#171a20";
  map.beginPath();
  map.moveTo(0, -10);
  map.lineTo(7, 7);
  map.lineTo(0, 4);
  map.lineTo(-7, 7);
  map.closePath();
  map.fill();
  map.restore();
  map.restore();
}

function updateUI() {
  const v = sim.player,
    nav = sim.navigation();
  $("speed").textContent = Math.round(Math.abs(v.speed) * 3.6);
  $("speed-limit").textContent = (sim.emergencyMode || emergencyMode)
    ? "120"
    : Math.round((nav.speed_limit_mps ?? sim.world.theme.limit) * 3.6);
  $("remaining").textContent =
    nav.remaining_m >= 1000
      ? `${(nav.remaining_m / 1000).toFixed(1)} km`
      : `${Math.round(nav.remaining_m)} m`;
  $("next-maneuver").textContent =
    nav.instruction ||
    (nav.next_turn === "arrive"
      ? sim.world.type === "highway"
        ? "Follow Interstate 08"
        : "Destination ahead"
      : nav.next_turn === "straight"
        ? "Continue straight"
        : nav.next_turn === "uturn"
          ? "Make a U-turn"
          : `Turn ${nav.next_turn}`);
  $("turn-distance").textContent =
    nav.next_turn === "arrive"
      ? "to your destination"
      : `in ${Math.round(nav.turn_distance_m)} m`;
  const turnIcon = {
    uturn: "rotate-ccw",
    left: "corner-up-left",
    right: "corner-up-right",
    straight: "arrow-up",
    arrive: "flag",
    merge: "corner-up-left",
    exit: "corner-up-right",
  }[nav.next_turn];
  if ($("turn-icon").dataset.icon !== turnIcon) {
    $("turn-icon").innerHTML = icon(turnIcon);
    $("turn-icon").dataset.icon = turnIcon;
    createIcons({ icons });
  }
  const answer = lastDecision?.selection,
    stale = !lastApplied || performance.now() - lastApplied > 1800;
  $("pilot-state").textContent = sim.autopilot
    ? stale
      ? "Reading the road…"
      : `${candidateName(scene.vectors.answeredPlan?.vectors[answer.choice])} · ${Math.round(answer.confidence * 100)}%`
    : sim.crash
      ? "Drive ended"
      : "Free play";
  $("context-message").textContent = sim.autopilot
    ? sim.brakeReason
      ? `Safety brake · ${sim.brakeReason}`
      : stale
        ? "Waiting for a fresh decision"
        : `${Math.round(v.target * 3.6)} km/h target · ${lastDecision.latency_ms} ms`
    : touch.available
      ? "Drag to drive · Hold Brake to stop"
      : "WASD to drive · Space to brake";
  if (
    sim.autopilot &&
    !stale &&
    !sim.brakeReason &&
    v.speed < 0.5 &&
    v.target < 0.5
  ) {
    $("context-message").textContent =
      lastDecision.decision_source === "only_eligible_action"
        ? "Only stop is available · rechecking scene"
        : "BRPilot chose to wait · evaluating traffic";
  }
  if (nav.rerouted)
    $("context-message").textContent =
      "Route recalculated · continuing to your destination";
  else if (rerouting && sim.routeChoiceNeeded())
    $("context-message").textContent = "Recalculating route…";
  else if (sim.lastPlan?.recovery.active)
    $("context-message").textContent = sim.lastPlan.road.on_road
      ? "Returning to the route"
      : "Finding a way back onto the road";
  $("cost").textContent = playCredits
    ? `$${Math.max(0, playCredits.remaining_usd).toFixed(4)}`
    : `$${tally.cost.toFixed(6)}`;
  if (sim.complete && !sim.freeExplore) {
    $("arrival").hidden = false;
    $("arrival-summary").textContent =
      `${Math.round(sim.distance)} m driven · ${sim.collisions} contacts · ${sim.violations} violations`;
    if ($("autopilot").getAttribute("aria-checked") === "true") {
      generation++;
      syncPilot();
    }
  }
  if ($("json-dialog").open) renderJSON();
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastNow) / 1000, 0.2);
  lastNow = now;
  if (document.hidden || loading) return;
  touch.sync();
  if (!sim.paused && !sim.crash) {
    if (sim.autopilot) {
      decide();
    }
    if (!sim.autopilot) {
      let steer = 0;
      const left = keys.has("KeyA") || keys.has("ArrowLeft");
      const right = keys.has("KeyD") || keys.has("ArrowRight");
      if (left || right) steer = Number(right) - Number(left);
      let throttle = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) throttle = 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) throttle = -1;
      sim.pedals.throttle = throttle || touch.throttle;
      sim.pedals.brake = keys.has("Space") ? 1 : touch.brake;
      sim.steeringInput = steer || touch.steering;
      sim.player.target = 0;
    } else if (!lastApplied || now - lastApplied > 1800) sim.player.target = 0;
    // Preserve real elapsed time on slower displays using bounded physics substeps.
    const steps = Math.max(1, Math.ceil(dt / 0.025));
    for (let i = 0; i < steps; i++) sim.step(dt / steps);
  }
  if (scene.routeVersion !== sim.routeVersion) {
    scene.routeVersion = sim.routeVersion;
    generation++;
    lastApplied = 0;
    lastDecision = null;
    lastInput = null;
    lastContext = null;
    nextDecision = 0;
    scene.vectors.clear();
    const destination = sim.player.route.points.at(-1);
    scene.destination.position.set(destination.x, 0.2, destination.z);
  }
  if (sim.crash && !crashHandled) {
    crashHandled = true;
    generation++;
    keys.clear();
    scene.vectors.clear();
    syncPilot();
    $("arrival").hidden = true;
    $("paused-overlay").hidden = true;
    $("json-dialog").close();
    $("help-dialog").close();
    document.body.classList.add("crashed");
    $("crash-description").textContent = {
      building: "You collided with a building.",
      pedestrian: "You struck a pedestrian.",
      car: "You collided with another car.",
      motorcycle: "You collided with a motorcycle.",
    }[sim.crash.type];
    $("crash-speed").textContent = Math.round(sim.crash.impact_speed_mps * 3.6);
    $("crash-distance").textContent = Math.round(sim.distance);
    $("crash-dialog").showModal();
  }
  if (
    showCandidates &&
    !sim.autopilot &&
    !sim.paused &&
    !sim.crash &&
    now - candidatePreviewAt > 500
  ) {
    candidatePreviewAt = now;
    requestPreview();
  }
  scene.render(dt);
  if (!$("minimap").hidden && now - lastMapDraw >= 100) {
    drawMap();
    lastMapDraw = now;
  }
  uiTime += dt;
  if (uiTime > 0.2) {
    uiTime = 0;
    updateUI();
  }
}
refreshWorld();
syncPilot();
updateUI();
requestAnimationFrame(animate);
setInterval(decide, 25);
finishLoading().catch(loadingFailed);
let isKeyValid = false;
let keyDebounceTimer = null;

function updateModalBanner(state, title, detail, badgeText, badgeClass) {
  const badge = $("key-validation-badge");
  const banner = $("key-status-banner");
  const bannerTitle = $("banner-status-title");
  const bannerDetail = $("banner-status-detail");
  
  if (badge) {
    badge.textContent = badgeText;
    badge.className = badgeClass;
  }
  if (banner) {
    banner.className = `status-banner banner-${state}`;
  }
  if (bannerTitle) bannerTitle.textContent = title;
  if (bannerDetail) bannerDetail.textContent = detail;
}

function updateTopbarPill(text, dotClass) {
  const keyBtnText = $("key-badge-text");
  const keyStatusDot = $("key-status-dot-pill");
  if (keyBtnText) keyBtnText.textContent = text;
  if (keyStatusDot) keyStatusDot.className = `pill-dot ${dotClass}`;
}

async function validateAndConnectKey(rawKey, notify = false) {
  const key = (rawKey || "").trim();
  
  if (!key) {
    isKeyValid = false;
    localStorage.removeItem("dgpl_api_key");
    updateTopbarPill("🔒 Connect API Key", "pill-dot-offline");
    updateModalBanner(
      "offline",
      "Offline Mode",
      "Please enter an active DGPL API key to enable autonomous cloud driving.",
      "Awaiting Input",
      "badge-neutral"
    );
    if (dgplWs) {
      try { dgplWs.close(); } catch(e){}
      dgplWs = null;
    }
    return { valid: false, reason: "EMPTY" };
  }

  updateTopbarPill("🟡 Verifying...", "pill-dot-idle");
  updateModalBanner(
    "idle",
    "Verifying Key...",
    `Connecting to ${DGPL_CONFIG.getEnvironmentLabel()} (${DGPL_CONFIG.getBaseUrl()})...`,
    "Verifying...",
    "badge-neutral"
  );

  try {
    const t0 = performance.now();
    const res = await fetch(DGPL_CONFIG.getApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DGPL-API-Key": key
      },
      body: JSON.stringify({
        task: "choice",
        state: "key_handshake_verification",
        candidates: ["v0", "v1"]
      }),
      signal: AbortSignal.timeout(4000)
    });

    const elapsed = Math.round(performance.now() - t0);

    if (res.ok) {
      const data = await res.json();
      isKeyValid = true;
      localStorage.setItem("dgpl_api_key", key);
      configured = true;
      
      const tierName = (data.key_tier || "Enterprise").toUpperCase();
      const envTag = DGPL_CONFIG.isLocal() ? "DGPL Local" : "DGPL Cloud";
      updateTopbarPill(`⚡ ${envTag} (${elapsed}ms)`, "pill-dot-live");
      updateModalBanner(
        "live",
        `⚡ ${DGPL_CONFIG.getEnvironmentLabel()} Connected`,
        `Active & Ready · Latency: ${elapsed}ms · Tier: ${tierName} · Endpoint: ${DGPL_CONFIG.getBaseUrl()}`,
        `Valid (${tierName})`,
        "badge-valid"
      );
      
      if (notify) toast(`⚡ ${DGPL_CONFIG.getEnvironmentLabel()} Connected! Verified in ${elapsed}ms. Autopilot Ready.`, "info");
      connectDGPLWebSocket();
      return { valid: true, latency: elapsed, tier: data.key_tier };
    } else {
      isKeyValid = false;
      let errDetail = "Invalid API key provided.";
      try {
        const errJson = await res.json();
        if (errJson.detail) errDetail = errJson.detail;
      } catch(e){}

      updateTopbarPill("❌ Invalid Key", "pill-dot-error");
      updateModalBanner(
        "error",
        "❌ Authentication Failed",
        `Server returned ${res.status}: ${errDetail}`,
        "Invalid Key",
        "badge-invalid"
      );
      
      if (notify) toast(`❌ Invalid DGPL API Key: ${errDetail}. Autopilot disabled.`, "error");
      
      if (dgplWs) {
        try { dgplWs.close(); } catch(e){}
        dgplWs = null;
      }
      return { valid: false, status: res.status, reason: errDetail };
    }
  } catch (err) {
    isKeyValid = false;
    updateTopbarPill("⚠️ Engine Offline", "pill-dot-offline");
    updateModalBanner(
      "error",
      `⚠️ ${DGPL_CONFIG.getEnvironmentLabel()} Unreachable`,
      `Network error connecting to ${DGPL_CONFIG.getBaseUrl()}: ${err.message}`,
      "Unreachable",
      "badge-invalid"
    );
    if (notify) toast(`⚠️ ${DGPL_CONFIG.getEnvironmentLabel()} is unreachable (${err.message})`, "error");
    return { valid: false, reason: err.message };
  }
}

// Engine Target Switching Logic
function setEngineTarget(target, autoValidate = true) {
  if (target === "local") {
    DGPL_CONFIG.setBaseUrl(DGPL_CONFIG.LOCAL_BASE_URL);
    const targetSelect = $("engine-target-select");
    if (targetSelect) targetSelect.value = "local";
    const localBtn = $("target-local-btn");
    const cloudBtn = $("target-cloud-btn");
    if (localBtn) localBtn.classList.add("active");
    if (cloudBtn) cloudBtn.classList.remove("active");
    const badge = $("brand-badge-text");
    if (badge) {
      badge.textContent = "DGPL Local";
      badge.className = "brand-badge";
    }
    
    const keyInput = $("dgpl-key-input");
    const currentKey = (keyInput ? keyInput.value : "") || localStorage.getItem("dgpl_api_key") || "";
    const effectiveKey = currentKey || "dgpl_adm_master_sovereign_2026";
    if (keyInput) keyInput.value = effectiveKey;
    
    if (autoValidate) {
      validateAndConnectKey(effectiveKey, true);
    }
  } else {
    DGPL_CONFIG.setBaseUrl(DGPL_CONFIG.CLOUD_BASE_URL);
    const targetSelect = $("engine-target-select");
    if (targetSelect) targetSelect.value = "cloud";
    const localBtn = $("target-local-btn");
    const cloudBtn = $("target-cloud-btn");
    if (localBtn) localBtn.classList.remove("active");
    if (cloudBtn) cloudBtn.classList.add("active");
    const badge = $("brand-badge-text");
    if (badge) {
      badge.textContent = "DGPL Cloud";
      badge.className = "brand-badge cloud";
    }
    
    const keyInput = $("dgpl-key-input");
    const currentKey = (keyInput ? keyInput.value : "") || localStorage.getItem("dgpl_api_key") || "";
    if (autoValidate) {
      validateAndConnectKey(currentKey, true);
    }
  }
}

if ($("engine-target-select")) {
  $("engine-target-select").onchange = (e) => setEngineTarget(e.target.value, true);
}

if ($("target-local-btn")) {
  $("target-local-btn").onclick = () => setEngineTarget("local", true);
}

if ($("target-cloud-btn")) {
  $("target-cloud-btn").onclick = () => setEngineTarget("cloud", true);
}

// API Key Dialog Event Listeners
if ($("key-modal-btn")) {
  $("key-modal-btn").onclick = () => {
    const currentKey = localStorage.getItem("dgpl_api_key") || (DGPL_CONFIG.isLocal() ? "dgpl_adm_master_sovereign_2026" : "");
    if ($("dgpl-key-input")) {
      $("dgpl-key-input").value = currentKey;
    }
    if (currentKey) {
      validateAndConnectKey(currentKey, false);
    } else {
      updateModalBanner(
        "offline",
        "Offline Mode",
        `Please enter an active DGPL API key to connect to ${DGPL_CONFIG.getEnvironmentLabel()}.`,
        "Awaiting Input",
        "badge-neutral"
      );
    }
    $("key-dialog").showModal();
  };
}

// Debounced Real-time input validation
if ($("dgpl-key-input")) {
  $("dgpl-key-input").oninput = () => {
    clearTimeout(keyDebounceTimer);
    const val = $("dgpl-key-input").value.trim();
    if (!val) {
      updateModalBanner(
        "offline",
        "Offline Mode",
        "Please enter an active DGPL API key to enable autonomous cloud driving.",
        "Awaiting Input",
        "badge-neutral"
      );
      updateTopbarPill("🔒 Connect API Key", "pill-dot-offline");
      return;
    }
    
    updateModalBanner(
      "idle",
      "Verifying...",
      "Validating key with DGPL Cloud inference gateway...",
      "Verifying...",
      "badge-neutral"
    );
    
    keyDebounceTimer = setTimeout(() => {
      validateAndConnectKey(val, false);
    }, 300);
  };
}

if ($("close-key-dialog")) {
  $("close-key-dialog").onclick = () => $("key-dialog").close();
}

if ($("save-key-btn")) {
  $("save-key-btn").onclick = async () => {
    const key = $("dgpl-key-input").value.trim();
    if (key) {
      const res = await validateAndConnectKey(key, true);
      if (res.valid) {
        $("key-dialog").close();
      }
    } else {
      await validateAndConnectKey("", true);
      $("key-dialog").close();
    }
  };
}

if ($("clear-key-btn")) {
  $("clear-key-btn").onclick = async () => {
    $("dgpl-key-input").value = "";
    await validateAndConnectKey("", true);
    $("key-dialog").close();
  };
}

if ($("test-key-btn")) {
  $("test-key-btn").onclick = async () => {
    const key = $("dgpl-key-input").value.trim();
    await validateAndConnectKey(key, true);
  };
}

// Auto-check URL parameters or local storage on boot
const initialKey = (urlApiKey || localStorage.getItem("dgpl_api_key") || "").trim();

if (initialKey) {
  validateAndConnectKey(initialKey, false);
} else {
  validateAndConnectKey("", false);
}

export { sim, scene };


