# BRPilot — Real-Time Autonomous Driving Simulator & Telemetry Cockpit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-DGPL%20System--1-green.svg)](https://br.durbhasigurukulam.com/)
[![Status](https://img.shields.io/badge/Status-Active%20Production-success.svg)](https://br.durbhasigurukulam.com/)

**BRPilot** is a high-performance, real-time 3D autonomous driving simulator and neural telemetry cockpit built with Three.js, Lucide Icons, and Vanilla CSS. It provides closed-loop driving benchmarks, route waypoint navigation, obstacle detection, and live telemetry streaming powered by the **DGPL System-1 Real-Time Decision Engine**.

---

## 🌟 Features

- **60 FPS Real-Time Simulation**: Smooth canvas rendering with physics modeling, curved road networks, and multi-vehicle traffic.
- **Dynamic HUD & Telemetry**: Live telemetry dashboard tracking velocity, steering angles, throttle/brake commands, and decision confidence.
- **DGPL System-1 API Integration**: Seamless connectivity to the ultra-low-latency decision engine endpoint (`https://br.durbhasigurukulam.com/`).
- **Telemetry Recording & JSON Export**: One-click flight data recorder export for offline analysis and benchmarking.
- **Modular Autonomy Modes**: Supports autonomous neural driving, baseline comparative agents, and manual keyboard override.

---

## 🚀 Quickstart

### Prerequisites
- Node.js (v18+ recommended)
- Modern web browser with WebGL support

### Installation & Local Run
```bash
# Clone the repository
git clone git@github.com:vk-alto-none/brpilot.git
cd brpilot

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:5173` to launch the simulator.

---

## 🏛️ Ecosystem & Platform

- **Live Production URL**: [https://br.durbhasigurukulam.com/](https://br.durbhasigurukulam.com/)
- **Core Platform**: [DGPL System-1 Decision Engine](https://github.com/vk-alto-none/dgpl-system1-decision-engine)
- **Organization**: [Durbhasi Gurukulam Private Limited (DGPL)](https://durbhasigurukulam.com/)

---

## 📜 Acknowledgements & Attribution

BRPilot builds upon and acknowledges the foundational architecture, concepts, and algorithms developed by the open-source autonomous simulation and decision intelligence research community, including initial simulation prototypes inspired by TypeSafe / Jev driving models.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
