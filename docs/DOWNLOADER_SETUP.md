# 🛠️ Downloader Architecture & Setup Guide

This guide details the multi-provider media downloading engine in **Social Hub (Connect_Hub)**.

---

## 🏗️ Architectural Overview & Port Map

Social Hub uses a multi-tiered provider architecture with automatic health checking and failover:

```text
                  DOWNLOAD REQUEST
                         │
                         ▼
                  Provider Manager
                         │
      ┌──────────────────┼──────────────────┬──────────────────┐
      ▼                  ▼                  ▼                  ▼
1. yt-dlp + BGUTIL   2. Cobalt         3. Invidious       4. direct yt-dlp
  (PO Provider)        (Media API)       (Proxy API)        (Local binary)
  127.0.0.1:4416      127.0.0.1:9000     API endpoint       Local System
      │                  │                  │                  │
      └──────────────────┴──────────────────┴──────────────────┘
                                 │
                         Media Validator
                                 │
                                 ▼
                          Success / Failover
```

### Local Port & Service Mapping

| Service | Port / URL | Environment Variable | Role |
| :--- | :--- | :--- | :--- |
| **Social Hub** | `http://localhost:4000` | `PORT=4000` | Main Web Studio & WebSocket Server |
| **BGUTIL (PO Token Provider)** | `http://127.0.0.1:4416` | `BGUTIL_API_URL=http://127.0.0.1:4416` | Generates proof-of-origin tokens for yt-dlp |
| **Cobalt** | `http://127.0.0.1:9000` | `COBALT_API_URL=http://127.0.0.1:9000` | High-speed dedicated media downloader engine |
| **Invidious** | `https://inv.nadeko.net` | `INVIDIOUS_API_URL=https://...` | Anonymous public YouTube video proxy |

> [!IMPORTANT]
> Setting an environment variable **does NOT** automatically start or install a service. The corresponding service or Docker container must actually be running on your machine or network.

---

## 🚀 Setting Up Local Services

### 1. Setting Up BGUTIL (`yt-dlp + BGUTIL`)

BGUTIL is a lightweight HTTP service providing automated YouTube Proof-of-Origin (PO) tokens to allow `yt-dlp` to download media without sign-in or cookies.

**Option A: Run via Docker (Recommended)**
```bash
docker run -d \
  --name bgutil-provider \
  --restart unless-stopped \
  -p 4416:4416 \
  brainfucksec/bgutil-ytdlp-pot-provider:latest
```

**Option B: Verify BGUTIL Connectivity**
```bash
curl http://127.0.0.1:4416/
```
When running, BGUTIL responds with a JSON payload containing the latest `token` and `visitorData`.

---

### 2. Setting Up Cobalt (`Cobalt API`)

Cobalt is an open-source, cookie-free media downloader API.

**Option A: Run via Docker Compose**
```bash
docker compose -f docker-compose.cobalt.yml up -d
```

**Option B: Verify Cobalt Connectivity**
```bash
curl http://127.0.0.1:9000/
```
> [!WARNING]
> Do NOT set `COBALT_API_URL=http://localhost:4000`. Port 4000 is reserved for Social Hub itself. Cobalt must run on its own port (e.g. `9000`).

---

### 3. Setting Up Invidious (`Invidious Proxy`)

Invidious allows fetching YouTube metadata and streaming media via public or private Invidious API instances.

Set `INVIDIOUS_API_URL` in your `.env`:
```env
INVIDIOUS_API_URL=https://inv.nadeko.net
```
You can use any trusted public Invidious instance from [invidious.io](https://invidious.io) or your own self-hosted instance.

---

### 4. Direct yt-dlp & FFmpeg

If `yt-dlp` and `ffmpeg` are installed locally in your system PATH, Social Hub automatically detects them:

- **Windows**: `winget install yt-dlp.yt-dlp` and `winget install Gyan.FFmpeg`
- **macOS**: `brew install yt-dlp ffmpeg`
- **Linux**: `sudo apt install ffmpeg` and `sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp`

---

## 🔍 Provider Health & Diagnostics

### Checking Health via API
```bash
curl http://localhost:4000/api/downloader/status
```

Response:
```json
{
  "success": true,
  "available": true,
  "providers": {
    "bgutil": {
      "configured": true,
      "healthy": false,
      "status": "UNAVAILABLE",
      "endpoint": "http://127.0.0.1:4416"
    },
    "cobalt": {
      "configured": true,
      "healthy": true,
      "status": "READY",
      "endpoint": "http://127.0.0.1:9000"
    },
    "invidious": {
      "configured": true,
      "healthy": true,
      "status": "READY",
      "endpoint": "https://inv.nadeko.net"
    },
    "ytdlp": {
      "configured": true,
      "healthy": true,
      "status": "READY"
    }
  }
}
```

### Automatic Failover Behavior

When a download request arrives:
1. The system checks which providers are currently `READY`.
2. It attempts the highest priority ready provider:
   `yt-dlp + BGUTIL` → `Cobalt` → `Invidious` → `yt-dlp direct`.
3. If a provider fails or times out, it seamlessly falls back to the next available provider.
4. If all providers fail, a clean normalized error is returned:
   ```json
   {
     "success": false,
     "code": "ALL_DOWNLOAD_PROVIDERS_FAILED",
     "message": "The media could not be retrieved from the available download providers."
   }
   ```
5. No raw stderr, stack traces, private URLs, or credentials are ever exposed to users.
