# Project Constitution & Engineering Guidelines

## 1. Core Mission & Principles
**Social Hub (Connect_Hub)** is a multi-platform publishing and media automation studio designed to download, format, schedule, and broadcast rich media to WhatsApp and Telegram without requiring commercial API keys or complex setups.

### Core Principles
1. **Preserve Working Code**: Existing working features are the bedrock of the application. Never rebuild or rewrite working modules from scratch.
2. **High-Fidelity Media**: Media must be transferred in original, uncompressed quality whenever possible (using document streams on Telegram and native media dispatch on WhatsApp).
3. **Responsive Feedback**: Every asynchronous background operation (downloads, speech transcription, scheduling, bulk broadcasting) must provide real-time visual progress indicators via WebSockets and toast notifications.
4. **Resilience & Fault Tolerance**: External failures on one platform (e.g. WhatsApp disconnect) must not block or impact operations on other platforms (e.g. Telegram).

---

## 2. Coding Standards
- **Module System**: Strict Node.js ES Modules (`"type": "module"` in `package.json`). Use standard `import` and `export` statements.
- **Asynchronous Logic**: Use standard `async/await` syntax. Avoid raw callback nesting or unhandled promise rejections.
- **Error Handling**: Every API route and background job must wrap operations in `try/catch` and return standardized error objects or broadcast failure events.
- **Code Documentation**: Retain all existing JSDoc comments. Document all new public functions and classes.

---

## 3. Architecture Rules
- **Separation of Concerns**:
  - `public/`: UI layout, styles, DOM manipulation, client-side NLP, and Web Speech API.
  - `modules/`: Platform drivers, media processing engines, persistence managers, and scheduler daemon.
  - `server.js`: Express routing, WebSocket broadcasting, and environment setup.
- **Unified WhatsApp Proxy**: All WhatsApp operations must route through the `wa` proxy dispatcher in `server.js`, dynamically invoking either `WhatsAppOpenWA` or `WhatsAppModule` (Baileys) based on `session_config.json`.
- **Zero-Locking Storage**: State and sessions are stored in `sessions/` as atomic JSON files.

---

## 4. Security Rules
- **Secret Management**: No tokens, API keys, or private session credentials may be hardcoded in source code. All secrets must resolve via `process.env` with fallback placeholders.
- **Upload Path Traversal Protection**: Uploaded files and downloaded filenames must be sanitized using `path.basename` and regex character filters (`[^a-zA-Z0-9._-]`).
- **Media Cleanup**: Downloaded media in `downloads/` must have an automatic cleanup TTL (30 minutes). Uploaded temp files in `uploads/` must only be deleted after all target dispatches have settled.

---

## 5. Testing Requirements
- **Test Suite**: Automated tests reside in `test/` and run via Node.js native test runner (`node --test`).
- **Zero Regression**: Every pull request or feature update must pass existing unit and integration tests before landing.
- **Component Mocking**: Platform modules (WhatsApp / Telegram network calls) must be testable with offline mocks.

---

## 6. UI/UX Principles
- **Design Aesthetic**: Premium glassmorphic dark theme using tailored CSS custom variables (`#0a0b10` background, `#a78bfa` / `#38bdf8` gradient accents, ethereal ambient animations).
- **Non-Blocking Publishing**: Large broadcasts must run asynchronously in the background while the UI displays per-target progress.
- **Mobile Responsiveness**: UI components must adapt gracefully to mobile and desktop viewports.

---

## 7. Database & Persistence Rules
- File writes to `sessions/*.json` must be wrapped in safe directory-ensuring routines.
- In-memory data must be synced to disk on state mutations.
- Corrupted JSON on disk must fall back to safe empty defaults without crashing the server.

---

## 8. API Conventions
- **REST Envelope**:
  ```json
  {
    "success": true,
    "data": {},
    "message": "Optional human-readable confirmation"
  }
  ```
- **Error Envelope**:
  ```json
  {
    "success": false,
    "error": "Descriptive error message"
  }
  ```
- **Standard HTTP Codes**:
  - `200 OK`: Successful operation.
  - `400 Bad Request`: Validation or missing parameter errors.
  - `404 Not Found`: Resource or file not found.
  - `500 Internal Server Error`: Platform runtime or unhandled failure.
  - `503 Service Unavailable`: Dependent engine (e.g. yt-dlp) initializing.
