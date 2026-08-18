# Project Specification — Social Hub (Connect_Hub)

## 1. System Overview
Social Hub is an all-in-one media downloader, formatter, scheduler, and multi-platform publisher for WhatsApp and Telegram.

---

## 2. Core Functional Specifications

### 2.1 Media Downloader Studio
- **Supported Sources**: YouTube (standard, shorts, music) and Instagram (posts, reels, stories).
- **Zero-Cookie Engine**: Primary download utilizes `yt-dlp` with rotating player client profiles (`ios,android,mweb,web_safari,tv`).
- **Zero-Cookie Fallback Scraper**: If `yt-dlp` encounters bot challenges, `InstagramDownloader` evaluates up to 8 candidate scrapers (GraphQL, Cobalt API, SaveIG, FastDL, Publer, RapidAPI, Meta Proxies, embed HTML parser).
- **Client Actions**:
  - *Save to PC*: Triggers direct browser download.
  - *Use in Upload*: Instantly transfers downloaded media into the Publish Command Center.
- **Cookies Accordion**: Allows optional `cookies.txt` upload for age-restricted content.

### 2.2 Dual-Engine WhatsApp Dispatcher
- **Engine 1: OpenWA Gateway (`whatsapp_openwa.js`)**:
  - Communicates with self-hosted OpenWA REST server.
  - Supports 8-digit phone pairing codes or QR code scanning.
  - Dispatches images, videos, audio notes, and documents.
- **Engine 2: Baileys WebSocket (`whatsapp.js`)**:
  - Direct local multi-device connection via `@whiskeysockets/baileys`.
  - Scans and persists auth keys in `sessions/whatsapp/`.
  - Auto-discovers participating groups and newsletters.
- **Channel / Newsletter Handling**:
  - Auto-detection from chat sync.
  - Manual link adder (`https://whatsapp.com/channel/...`) with JID resolution.

### 2.3 Telegram Bot Dispatcher & Community Automation
- **Bot Authentication**: Validates bot tokens with Telegram Bot API (`getMe()`).
- **Chat Discovery**: Scans and registers all groups and channels where the bot is configured as Administrator.
- **Original Quality Dispatch**: Sends videos as native videos or documents to prevent lossy compression.
- **Community Automation**:
  - Auto-responds to `/start` in DMs with channel join button.
  - Listens for `chat_join_request` events to auto-approve new members and send welcome DMs.

### 2.4 Publish Command Center & Drag-and-Drop Dropzone
- **File Ingestion**: Accepts images, videos, audio clips, and documents up to 500MB.
- **Target Selection**: Multi-select interface combining WhatsApp groups, WhatsApp channels, and Telegram channels.
- **Immediate Dispatch (`POST /api/upload`)**: Dispatches media to all selected targets in parallel with real-time WebSocket progress updates (`upload_progress` and `upload_complete`).

### 2.5 Broadcast Scheduling Engine
- **Custom Calendar & Time Picker Studio**: Interactive date selector with month navigation, 12-hour AM/PM time selector, and quick preset buttons (+15m, +30m, +1h, Tonight 9 PM, Tomorrow 9 AM).
- **Background Daemon**: 5-second interval timer checking for due jobs in `sessions/scheduled_jobs.json`.
- **Queue Management**: Supports *Run Now* (immediate execution) and *Cancel* actions from the Scheduled Broadcasts panel.

### 2.6 AI Audio / Speech-to-Text Studio
- **Microphone Recording**: Web Speech API speech-to-text with real-time waveform visualization.
- **Language Detection**: Auto-detects Malayalam, English, Hindi, Tamil, Arabic, and Spanish.
- **Contextual Formatting**: 6 distinct styles:
  - *Smart Match*: Balances engagement, summary, and formatting.
  - *Song / Lyrics Vibe*: Formatting for musical reels and WhatsApp status.
  - *Viral Hook*: High-engagement call-to-action hooks.
  - *Speech Highlights*: Bulleted key takeaways.
  - *Aesthetic*: Minimalist aesthetic fonts and symbols.
  - *WhatsApp Broadcast*: Clean bold headers and structured details.

### 2.7 Text Styler & Smart Emoji Suite
- **Formatting Ribbon**: Bold, Italic, Strikethrough, Monospace, Quote block, and Bullet list inserters.
- **Live NLP Emoji Suggestion**: Analyzes text in real-time across 200+ keyword categories to recommend matching emoji pills.
- **Categorized Emoji Picker**: Searchable grid covering Hot, Music, Faces, Hands, Promo, Ideas, and Symbols.
- **Fancy Unicode Font Generator**: Real-time conversion into Mathematical Bold, Italic, Script, Double-Struck, Monospace, and Circled styles.

### 2.8 Target History & Analytics
- **History Tracking**: Automatically saves target metadata to `sessions/target_history.json`.
- **Audience Reach Metrics**: Calculates aggregate audience size across all connected channels.

---

## 3. Non-Functional Specifications
- **Performance**: Event loop non-blocking file streaming.
- **Cross-Platform Compatibility**: Windows, Linux, and macOS supported.
- **Network Resilience**: Automatic 3-second WebSocket reconnect; DNS fallback for ISP-level API blocks.
