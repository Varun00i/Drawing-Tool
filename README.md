# Accuracy Sketch AI

> **Practice solo or compete live: sketch, submit, score.**

An Apple-inspired web application for practicing and competing at freehand sketch replication. Features AI-generated reference images, a server-side scoring pipeline, real-time multiplayer (up to 6 players), and gentle background music.

![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **Solo Practice** — Choose difficulty (Easy/Medium/Hard), get an AI-generated reference, sketch, and receive a detailed accuracy score
- **Multiplayer** — Create a room, invite up to 5 friends, sketch simultaneously, and see a ranked scoreboard
- **AI Reference Images** — OpenRouter text-to-image integration with caching and fallback placeholder generation
- **Server-Side Scoring** — Contour IoU, Keypoint matching, Local SSIM-like similarity → weighted composite score with heatmap
- **Drawing Tools** — Pencil (multiple sizes), eraser, opacity control, undo/redo, grid overlay
- **Reference View Modes** — Split pane or draggable floating window (resizable, semi-transparent)
- **Visual Comparison** — Side-by-side, overlay, and flicker modes with per-component heatmaps
- **Background Music** — Gentle bass + warm drums loop, programmatically generated (no external audio files needed)
- **Accessibility** — High contrast, reduce motion, large text, full keyboard navigation, audio disable
- **Production-Ready** — Docker, GitHub Actions CI/CD, Render deployment blueprint

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Zustand, Lucide Icons |
| Backend | Node.js + Express + TypeScript, Socket.IO (WebSocket) |
| Scoring | Jimp (image processing), custom Sobel edge/corner/SSIM pipeline |
| AI Images | OpenRouter T2I API (with caching) |
| Database | PostgreSQL (via Render managed) |
| Cache | Redis (pub/sub, ephemeral state) |
| Deployment | Docker, Render, GitHub Actions |

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### 1. Clone and install

```bash
git clone <repo-url>
cd accuracy-sketch-ai
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 2. Environment variables

```bash
cp .env.example .env
# Edit .env with your OpenRouter API key (optional — demo mode works without it)
```

### 3. Run development servers

```bash
npm run dev
```

This starts:
- **Server** on `http://localhost:3001`
- **Client** on `http://localhost:5173` (with API proxy to server)

### 4. Open in browser

Navigate to `http://localhost:5173`

---

## Docker

### Build and run with Docker Compose

```bash
docker-compose up --build
```

Access at `http://localhost:3001`

### Build standalone

```bash
docker build -t accuracy-sketch-ai .
docker run -p 3001:3001 accuracy-sketch-ai
```

---

## Deploy to Render

1. Push to GitHub
2. Connect repo in [Render Dashboard](https://dashboard.render.com)
3. Use the `render.yaml` Blueprint for automatic setup
4. Set `OPENROUTER_API_KEY` environment variable in Render

---

## Project Structure

```
├── client/                  # React + TypeScript frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   │   ├── HomePage       # Landing page
│   │   │   ├── SoloGame       # Single-player mode
│   │   │   ├── MultiplayerGame # Real-time multiplayer
│   │   │   ├── Toolbar         # Drawing tools
│   │   │   ├── Scoreboard      # Results & comparison
│   │   │   ├── SettingsPanel   # Audio & accessibility
│   │   │   ├── Onboarding      # First-time tutorial
│   │   │   ├── GridOverlay     # NxN grid
│   │   │   ├── FloatingReference # Draggable ref window
│   │   │   └── AudioController  # Background music
│   │   ├── hooks/            # useCanvas, useAudio
│   │   ├── services/         # API client, Socket.IO
│   │   ├── store/            # Zustand state management
│   │   └── types/            # TypeScript interfaces
│   └── ...config files
├── server/                  # Node.js + Express backend
│   ├── src/
│   │   ├── routes/           # REST API endpoints
│   │   ├── scoring/          # Image comparison engine
│   │   ├── services/         # OpenRouter integration
│   │   ├── websocket/        # Socket.IO room management
│   │   └── types/            # Shared types
│   └── ...config files
├── .github/workflows/       # CI/CD pipeline
├── Dockerfile               # Production build
├── docker-compose.yml       # Full stack with Postgres + Redis
├── render.yaml              # Render deployment blueprint
└── README.md
```

---

## Scoring Pipeline

1. **Preprocess** — Resize to 512×512, convert to grayscale
2. **Edge Detection** — Sobel filter to extract contours
3. **Binarization** — Threshold to binary edge maps
4. **Contour IoU** — Intersection-over-union of edge pixels
5. **Keypoint Matching** — Harris corner detection + nearest-neighbor matching
6. **Local Similarity** — Patch-based SSIM-like metric
7. **Composite Score** — Weighted by difficulty:

| Component | Easy | Medium | Hard |
|-----------|------|--------|------|
| Contour IoU | 60% | 50% | 40% |
| Keypoints | 25% | 30% | 35% |
| Local Detail | 15% | 20% | 25% |

---

## Multiplayer

- Host creates a room with difficulty, timer, and grid settings
- Room code is generated (6 characters) for sharing
- Up to 6 players join
- Synchronized countdown → timer starts
- Each player sketches independently and submits
- Server scores all submissions → descending scoreboard
- Rematch option for the host

---

## Audio Design

- **Background Music**: Gentle programmatically-generated loop (soft bass + warm drums), 500ms fade in/out
- **Submit Chime**: Short upward sine sweep (muted by default)
- **Match Complete**: Two-tone sting (muted by default)
- **No tap/click sounds** anywhere
- All controllable via Settings (per-channel volume, mute, master toggle)

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3001) | No |
| `OPENROUTER_API_KEY` | OpenRouter API key for T2I | No (demo mode) |
| `OPENROUTER_MODEL` | Model identifier | No |
| `DATABASE_URL` | PostgreSQL connection string | For production |
| `REDIS_URL` | Redis connection string | For production |
| `CLIENT_URL` | Frontend URL for CORS | For production |

---

## License

MIT
