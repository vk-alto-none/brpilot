# BRPilot — Real-Time Autonomous Driving Simulator & Telemetry Cockpit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-DGPL%20System--1-green.svg)](https://br.durbhasigurukulam.com/)
[![Status](https://img.shields.io/badge/Status-Active%20Production-success.svg)](https://br.durbhasigurukulam.com/)

> [!NOTE]
> ### 🌟 Original Creator & Foundation Attribution
> - **Original Project & Creator**: Originally created by **standard-agents** ([GitHub: @standard-agents/jevpilot](https://github.com/standard-agents/jevpilot)).
> - **System 1 Decision Engine Concept**: Inspired by **TypeSafe AI** ([typesafe.ai](https://typesafe.ai) · Diogo Almeida).
> - **Platform & Rebranding**: Enhanced, rebranded to **BRPilot**, and integrated into the **DGPL System-1 Real-Time Decision Engine** ecosystem by [Durbhasi Gurukulam Private Limited (DGPL)](https://durbhasigurukulam.com/).

---

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

BRPilot acknowledges and credits the pioneering open-source work by:
- **standard-agents** for the original [jevpilot](https://github.com/standard-agents/jevpilot) autonomous driving simulator codebase and 3D environment architecture.
- **TypeSafe AI** ([typesafe.ai](https://typesafe.ai)) for the original System-1 non-autoregressive decision model paradigm.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
