# Comprehensive Testing Plan

This document outlines the testing strategy for verifying both existing and new functionality without introducing breaking changes.

---

## 1. Testing Framework
- **Test Runner**: Node.js Native Test Runner (`node --test`).
- **Assertion Library**: Node.js Built-in `node:assert/strict`.
- **Zero Additional Dependencies**: Leverages modern Node.js native testing capabilities to maintain a clean `package.json`.

---

## 2. Unit Test Coverage Matrix

### 2.1 `test/history.test.js`
- Tests `HistoryManager` instantiation and fallback when JSON is absent.
- Tests `recordTargets('whatsapp', ...)` and `recordTargets('telegram', ...)`.
- Tests deduplication by ID and sorting by `lastConnected`.
- Tests `removeTarget()` and `clearPlatformHistory()`.

### 2.2 `test/session_manager.test.js`
- Tests `SessionManager` defaults (`rememberMe: true`, `whatsappEngine: 'openwa'`).
- Tests `setRememberMe()` and `setWhatsappEngine()`.
- Tests `setWhatsappAutoConnect()` and `setTelegramAutoConnect()`.
- Tests `setOpenWaConfig()`.

### 2.3 `test/scheduler.test.js`
- Tests `SchedulerModule` job creation with valid future timestamp.
- Tests scheduled time validation (rejects past or NaN timestamps).
- Tests `cancelJob()` status update to `cancelled`.
- Tests job retrieval via `getJobs()`.

### 2.4 `test/ai_captioner.test.js`
- Tests `AIAudioCaptioner.generateCaption()` across styles (`smart`, `lyrical`, `viral`, `speech_summary`, `aesthetic`, `whatsapp`).
- Tests keyword detection (Song / Music detection and Promo detection).
- Tests hashtag generation (`generateHashtags()`).

### 2.5 `test/emoji_generator.test.js`
- Tests `fetchEmojisForKeyword()` with local fallback mapping.
- Tests `generateEmojiTitle()`.
- Tests `getCategoryEmojis()`.

---

## 3. Integration Test Matrix (`test/api.test.js`)
- `GET /api/status`: Returns `{ success: true, data: { whatsapp, telegram, engine } }`.
- `GET /api/session/config`: Returns `{ success: true, config }`.
- `GET /api/history`: Returns `{ success: true, history }`.
- `GET /api/schedule/jobs`: Returns `{ success: true, jobs }`.
- `GET /api/downloader/status`: Returns `{ success: true, available, hasCookies }`.
- `POST /api/ai/transcribe-caption`: Returns synthesized caption and hashtags.
- `GET /api/nonexistent`: Returns 404 with JSON error envelope.

---

## 4. Manual Regression Verification Checklist
- [ ] **Server Boot**: `npm start` starts server on port 4000 and prints local IP addresses.
- [ ] **Downloader**: Enter YouTube/Instagram URL, verify download progress, verify *Save to PC* and *Use in Upload* actions.
- [ ] **WhatsApp Connection**: Verify QR code generation and Phone pairing code generation.
- [ ] **Telegram Connection**: Enter bot token, verify admin chat detection.
- [ ] **Immediate Broadcast**: Select 1+ target, drag-and-drop media, verify per-target progress updates in WebSocket.
- [ ] **Scheduler**: Pick future time, schedule broadcast, verify job appears in queue, verify *Run Now* and *Cancel*.
- [ ] **AI Caption Studio**: Open modal, test speech recording or transcript input, verify style pills and apply to broadcast caption.
