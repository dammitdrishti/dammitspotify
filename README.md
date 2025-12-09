# 🎵 dammitspotifywrapped

**dammitspotifywrapped** is a custom Spotify Insights generator that acts as the "better half" of your Spotify Wrapped. It analyzes your long-term listening history to generate personalized insights and downloadable posters.

## ✨ Features

* **Your Eras:** A chronological journey through your top songs, separated into phases (Jan-Apr, May-Aug, Sep-Dec).
* **Gatekeeper Score:** Analyzes the popularity of your top tracks to determine how "underground" or "mainstream" your taste is (Royal, Common, or Light).
* **Sonic Aura:** Uses Spotify Audio Features (Valence, Energy, Danceability) to determine your musical vibe (e.g., Main Character, Villain Arc, Doomscrolling).
* **Downloadable Posters:** Generates high-quality, shareable images of your insights using `html2canvas`.
* **Custom UI:** Features a premium dark mode aesthetic with spotlight hover effects and glassmorphism.

## 🛠️ Tech Stack

* **Framework:** React + TypeScript (Vite)
* **Styling:** Tailwind CSS + Custom CSS
* **API:** Spotify Web API (Authorization Code Flow with PKCE)
* **Icons:** Lucide React
* **Export:** HTML2Canvas

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js installed on your machine.
* A [Spotify Developer Account](https://developer.spotify.com/dashboard).

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone [https://github.com/yourusername/dammitspotifywrapped.git](https://github.com/yourusername/dammitspotifywrapped.git)
cd dammitspotifywrapped
npm install
