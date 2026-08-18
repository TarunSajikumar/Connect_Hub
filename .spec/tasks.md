# Development Tasks & Backlog

This task breakdown organizes the remaining work into discrete, atomic, and testable tasks.

---

## Task 1: Spec-Driven Development Suite Initialization
- **Goal**: Initialize the complete `.spec/` directory containing all 7 specification documents.
- **Files**: `.spec/constitution.md`, `.spec/project_spec.md`, `.spec/gap_analysis.md`, `.spec/technical_plan.md`, `.spec/tasks.md`, `.spec/dependency_map.md`, `.spec/testing_plan.md`.
- **Acceptance Criteria**: All 7 files exist, adhere to the Project Constitution, and accurately document the project.

---

## Task 2: Config & Secret Hardening
- **Goal**: Remove hardcoded bot tokens and API keys from source files and resolve them via `process.env`.
- **Files**:
  - `bot.js`: Replace hardcoded token with `process.env.BOT_TOKEN`.
  - `modules/instagram_downloader.js`: Replace hardcoded RapidAPI key with `process.env.RAPIDAPI_KEY`.
  - `.env.example`: Add `RAPIDAPI_KEY` documentation.
- **Acceptance Criteria**: No hardcoded API keys in source files; system boots cleanly without errors if environment variables are not set.

---

## Task 3: Automated Testing Framework Baseline
- **Goal**: Create automated test suites using the Node.js native test runner (`node:test` and `node:assert`).
- **Files**:
  - `package.json`: Add `"test": "node --test test/*.test.js"`.
  - `test/history.test.js`: Test `HistoryManager` target recording, deduplication, and persistence.
  - `test/session_manager.test.js`: Test `SessionManager` configuration loading and updating.
  - `test/scheduler.test.js`: Test `SchedulerModule` job scheduling, validation, and cancellation.
  - `test/ai_captioner.test.js`: Test `AIAudioCaptioner` caption synthesis and style presets.
  - `test/emoji_generator.test.js`: Test `emoji_generator` keyword lookup and caching.
  - `test/api.test.js`: Test Express REST endpoints (`GET /api/status`, `GET /api/history`, `GET /api/schedule/jobs`, `GET /api/downloader/status`).
- **Acceptance Criteria**: Running `npm test` executes all unit and API tests with 100% pass rate.

---

## Task 4: Fix Upload Temp File Cleanup Race Condition
- **Goal**: Ensure uploaded temporary files are not unlinked prematurely during slow or large bulk dispatches.
- **Files**: `server.js` (`POST /api/upload`).
- **Acceptance Criteria**: Media file remains available on disk throughout the entire execution of `Promise.all(targets.map(...))`, and is safely deleted only after all dispatches settle.

---

## Task 5: Telegram Integration & Polling Hardening
- **Goal**: Prevent 409 polling conflicts when `bot.js` and `server.js` run concurrently.
- **Files**: `bot.js`, `modules/telegram.js`.
- **Acceptance Criteria**: Polling errors are handled gracefully without uncaught exceptions or crashing the Node.js process.

---

## Task 6: Large Media Memory Optimization
- **Goal**: Optimize file handling during media dispatch to avoid memory spikes.
- **Files**: `modules/whatsapp.js`, `modules/whatsapp_openwa.js`.
- **Acceptance Criteria**: Verify that media buffer creation does not block asynchronous event handling.

---

## Task 7: Verification & Spec Kit Walkthrough
- **Goal**: Run complete test suite and create comprehensive walkthrough artifact.
- **Files**: `walkthrough.md`.
- **Acceptance Criteria**: All automated tests pass, manual verification checklist succeeds, and walkthrough document is generated.
