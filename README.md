# Flat Climb Racing 🏎️💨

> **A Bauhaus-inspired endless 2D physics hill climb racing game with custom car nameplate engraving and live WebRTC multiplayer.**  
> **Made by Raghav Parashar**

[![Live Demo](https://img.shields.io/badge/Play%20Live-GitHub%20Pages-2B55FF?style=for-the-badge&logo=github)](https://noteforstudy1-tech.github.io/flat-climb-racing/)

---

## 🎨 Visual Aesthetic & Design Philosophy

Flat Climb Racing is inspired by classic geometric Bauhaus and Swiss flat poster design:
- **Bold Primary Palette**: High-contrast Royal Blue (`#2B55FF`), Coral Red (`#FF4742`), Marigold Yellow (`#FFB703`), and Emerald Green (`#00D06C`).
- **Geometric Vector Art**: Minimalist circular sun, rolling multi-octave hill silhouettes, rectangular signboards, and chunky racing wheels.
- **Neo-Brutalist Framing**: Thick borders, crisp drop shadows, and modern grotesque typography (`Space Grotesk` & `Outfit`).

---

## ⚡ Key Features

1. **✍️ Driver Sign-Up & Car Engraving System**:
   - Entering your name acts as your official racer registration.
   - Live interactive 60 FPS car visualizer renders your name laser-engraved onto the chassis plate in real-time.
   - Choose between 5 bespoke Bauhaus liveries: *Royal Speedster*, *Coral Blaze*, *Marigold Gold*, *Emerald Drift*, and *Stealth Onyx*.
   - Profile persisted in `localStorage`.

2. **🌐 Real-Time WebRTC Multiplayer via PeerJS**:
   - Zero-backend serverless peer-to-peer 1v1 racing over WebRTC DataChannels.
   - **Seed Synchronization**: Both players race on the exact same procedural endless hills, jumps, coins, and fuel canister placements.
   - **Live Opponent Car**: See your friend driving right next to you with their custom livery and **their name engraved on their car door**!
   - **Live Split-Tracker**: Real-time HUD showing opponent distance and lead delta (`+24m` / `-12m`).
   - **Screen-Edge Pointer**: If your opponent pulls ahead or falls behind off-screen, an directional indicator tracks them.
   - **Quick Emotes**: Send real-time speech bubble reactions (🏎️, 🔥, 💥, 🏆, 👋) during the race.
   - **1-Click Invite**: Generate a shareable room link (`?room=FLAT-XXXX`) or 4-letter room code.

3. **🏎️ 2D Hill Climb Physics Engine**:
   - Dual independent spring-damper suspension system.
   - All-wheel drive traction with wheel slip and surface normal reactions.
   - Iconic Hill Climb balance: Mid-air gas tilts car back for backflips (`+1000 pts`); brake tilts car forward for safe landings and frontflips (`+1500 pts`).
   - Realistic crash detection if the driver's helmet touches the terrain.
   - Fuel consumption system with roadside Jerrycan pickups.

4. **📱 Fully Mobile Responsive**:
   - Ergonomic on-screen flat touch pedals:
     - Left: **Brake / Lean Forward** (Coral Red)
     - Right: **Gas / Lean Back** (Emerald Green)
   - Multi-touch enabled with `pointerdown`/`pointerup` prevention of unwanted gestures.
   - Adapts to small mobile phones, tablets, and desktop ultra-wide monitors.

5. **🔊 Procedural Web Audio Synthesizer**:
   - Engine purr and revs dynamically modulated with throttle and RPM.
   - Crystalline dual-tone coin chimes, rising arpeggio fuel fanfare, stunt fanfare, and crash crunch.
   - Zero external audio files required.

---

## 🕹️ Controls

| Action | Desktop Controls | Mobile / Touch |
| :--- | :--- | :--- |
| **Accelerate / Lean Back** | `D`, `➔` (Right Arrow), `Spacebar` | Right Green Pedal (**GAS**) |
| **Brake / Lean Forward** | `A`, `⬅` (Left Arrow) | Left Red Pedal (**BRAKE**) |
| **Restart Race** | `R` | Play Again button |
| **Toggle Mute** | `M` or 🔊 button | 🔊 button |
| **Emotes** | Click emote dock | Tap emote dock |

---

## 🚀 Live Deployment on GitHub Pages

The game is hosted on GitHub Pages:  
👉 **[https://noteforstudy1-tech.github.io/flat-climb-racing/](https://noteforstudy1-tech.github.io/flat-climb-racing/)**

---

## 🛠️ Local Development

To run locally without a build step:
```bash
cd /Users/raghavparashar/Downloads/flat-climb-racing
# Start any static HTTP server, for example:
python3 -m http.server 8080
```
Open `http://localhost:8080` in your browser.

---

## 👨‍💻 Author

**Raghav Parashar**  
GitHub: [@noteforstudy1-tech](https://github.com/noteforstudy1-tech)
