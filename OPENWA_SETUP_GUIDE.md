# 🚀 OpenWA WhatsApp API Gateway Integration Guide

This project integrates with **[rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA.git)** — a production-grade, self-hosted open-source WhatsApp API Gateway.

---

## 🌟 Why OpenWA?

* **Anti-Ban Safety**: Uses `whatsapp-web.js` browser engine or `baileys` multi-device engine with rate-limiting and humanized dispatch.
* **Multi-Session**: Run multiple WhatsApp numbers concurrently.
* **Persistent Sessions**: State is stored reliably in SQLite / PostgreSQL with automatic reconnection.
* **Pairing Code Linking**: Link your WhatsApp account with an 8-character code or QR scan.
* **Rich Media Dispatch**: Robust handling of images, video reels, voice notes, and PDF/document attachments.

---

## 🛠️ Quick Setup Options

### Option 1: Run OpenWA via Docker (Recommended)

Run the included Docker compose configuration:

```bash
docker compose -f docker-compose.openwa.yml up -d
```

* **API Endpoint:** `http://localhost:2785/api`
* **Swagger Docs:** `http://localhost:2785/docs`
* **Web Dashboard:** `http://localhost:2785`

---

### Option 2: Run OpenWA Directly from Source

1. Clone OpenWA:
   ```bash
   git clone https://github.com/rmyndharis/OpenWA.git
   cd OpenWA
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start OpenWA:
   ```bash
   npm run start:dev
   ```

---

## ⚙️ Connecting Social Hub to OpenWA

1. **Automatic Discovery**: By default, Social Hub connects to `http://localhost:2785/api`.
2. **Custom URL / Remote Server**:
   * You can configure the URL and API Key in the web dashboard by clicking **⚙️ OpenWA Settings** in the WhatsApp card.
   * Or set environment variables in your `.env`:
     ```env
     WHATSAPP_ENGINE=openwa
     OPENWA_API_URL=http://localhost:2785/api
     OPENWA_API_KEY=your-api-key-if-configured
     OPENWA_SESSION_NAME=social-hub
     ```

---

## 📱 Linking Your WhatsApp Account

1. Open Social Hub (`http://localhost:4000`).
2. Click **Connect WhatsApp** to display the QR Code.
3. Open WhatsApp on your phone → **Linked Devices** → **Link a Device** → Scan the QR Code.
4. Alternatively, use the **Pair with Phone Number** feature to link using an 8-digit code.
