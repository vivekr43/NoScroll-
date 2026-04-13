# NOscroll

NOscroll is a lightweight, Vanilla JavaScript Chrome Extension designed to break the cycle of doomscrolling. 

We built this project to reclaim our attention and build better digital habits. By detecting endless scrolling behaviors on highly addictive platforms like Instagram Reels and YouTube Shorts, NOscroll interrupts the user at critical moments to bring them back to reality. 

## 🌟 Why We Made This
Social media platforms use algorithms designed to maximize time-on-app through endless short-form video feeds. Users often fall into a trap of "doomscrolling" out of boredom, avoidance, or late-night fatigue. 

NOscroll was created with the idea to:
- **Detect** when doomscrolling boundaries are crossed (based on swipe count or specific time spent).
- **Classify** the underlying behavior (e.g., Avoidance, Boredom, Late-night scrolling).
- **Trigger** personalized, AI-generated nudges delivered via a full-screen interrupt shield. 
- Give users the chance to pause, reflect, and actively choose whether to continue.

## ✨ Features
- **Platform Monitoring:** Watches activity smoothly on Instagram Reels and YouTube Shorts.
- **Dynamic Limits:** Users can choose threshold limits (e.g. 15, 30, 60 minutes) or set a custom time.
- **Behavior Classifier:** Analyzes patterns (how often you reopen the app, the time of day, etc.) to give relevant context to the interruption.
- **Glassmorphism UI:** A sleek, minimal popup Dashboard that shows daily stats: 'Reels Watched', 'Time Lost', 'Current Streak', and more.
- **Mindful Moments:** The popup contains hourly-rotating motivational quotes to inspire presence over consumption.
- **Chrome manifest V3 Compliant:** Runs securely using vanilla JS without relying on external CDN libraries.

## 🚀 Installation 
1. Clone this repository to your local machine.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `NOscroll` folder.
5. The extension is now active. Pin it to your toolbar to check your daily stats and adjust limits!

## 🛠️ Built With
- HTML, CSS (Vanilla, Glassmorphism aesthetic)
- Vanilla JavaScript
- Chrome Extension API (Manifest V3)
