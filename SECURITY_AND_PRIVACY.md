# ScrapSense Security and Privacy Audit

- **Audit date:** 2026-11-01 (deletion controls update)
- **Scope:** backend, frontend, persistence configuration, and tracked documentation in this repository
- **Method:** code inspection, framework-internal inspection (`langgraph`, `deepagents`), dependency and secret-hygiene checks, and verification runs
- **Out of scope:** live provider data-handling terms, production infrastructure, database/backup encryption, and operational access control outside this repository

This report distinguishes **implemented behavior**, **documented limitations**, and **proposed policy**. The picker-facing deletion paths and the operator-invoked chat-retention command are implemented; automatic expiry for reports, memory, and raw text is not.

## 1. Executive summary

ScrapSense is a pseudonymous, account-linked data system, not an anonymous one. A report is stored against the Clerk `sub` claim, the raw picker message is stored in `reports.raw_text` and in LangGraph checkpoints, and chat messages are sent to the configured external model provider. The reviewer queue is identity-minimized, but the underlying rows still contain the picker id and raw text.

The earlier user-control gap around long-term memory is fixed with `DELETE /api/v1/chat/memory`. A later update adds three separate erasure paths: delete one owned report, delete all saved notes, and erase all application-managed account data. Each is ownership-scoped and returns `404` for another picker's resource. A report deletion hard-deletes the row so its numeric observation stops contributing to future estimates; past estimates are not rewritten because they are not persisted. Deleting a report removes the report's raw text from saved notes without deleting unrelated notes, and removes its source thread only when no other report still uses that thread. Account erasure removes every owned report, thread, checkpoint, and memory item, including checkpoints whose thread row is missing but whose metadata names the picker. A new operator-invoked chat-retention command deletes expired threads, their checkpoints, and orphan checkpoint threads that have no `chat_threads` row when `CHAT_RETENTION_DAYS` is set; no scheduler is installed. Report raw text still has no automatic expiry, and provider, log, and backup copies remain outside these controls.

The update also added a visible Privacy & data control to the chat UI, corrected the previous misleading "anonymous" wording, removed a picker id from an info-level log, and made thread repository writes user-scoped.

No changes were made to the price estimation algorithm, Tier 1/2/3 anomaly logic, original picker-message provenance, or Clerk attribution semantics.

## 2. Data inventory

| Data | Where it is stored | Identifier / linkage | Access path | Actual retention |
| --- | --- | --- | --- | --- |
| Clerk session token | Request `Authorization: Bearer` header; not persisted by this app | Clerk `sub`, `sid`, `azp` claims | Clerk SDK verification in `require_auth` | Provider/session policy |
| Picker id (Clerk `sub`) | `reports.picker_id`, `chat_threads.user_id`, memory store namespace, `reviewed_by` | Direct account link | Authenticated owner; admin review metadata | Until deleted or manually removed |
| Raw picker message | `reports.raw_text`; LangGraph checkpoints (`messages`, `original_message`); sent to xKiro | Linked to picker id and thread id | Owner, application code, model provider | Reports until report or account deletion; checkpoints until thread deletion, retention cutoff, or account deletion; no report-text expiry |
| Extracted report fields | `reports` row (material, price/kg, quantity, currency, city, area, observed_at, confidence, anomaly fields) | `picker_id` | Owner indirectly; reviewer projection; price aggregation | Until report or account deletion; no automatic expiry |
| Thread title | `chat_threads.title` (first 80 characters of the first message, or a default) | `user_id` | Owner's thread list | Until thread deletion, retention cutoff, or account deletion |
| Chat history | LangGraph checkpoints keyed by server-generated thread UUID | Thread id; ownership checked against `chat_threads` | Owner via history endpoint; agent | Until thread deletion, retention cutoff, or account deletion |
| Long-term agent notes | Postgres store namespace `(picker_id,)`, logical path `/memories/picker_notes.md` | Picker id | Agent at runtime; no read endpoint | Until `DELETE /api/v1/chat/memory` or account deletion; no automatic expiry |
| Reviewer decision | `reports.status`, `reviewed_at`, `reviewed_by` | Picker id and admin id | Admin-only review API | With the report row |
| Reviewer queue projection | API response only | None (omits picker id and raw text) | `ADMIN_USER_IDS` | Not persisted separately |
| Application logs | Deployment log sink | Report ids; picker id removed from the reviewed info log | Operators | Deployment-dependent |

## 3. Data flows and trust boundaries

1. **Authentication.** The frontend sends a Clerk bearer token. `require_auth` verifies it with the Clerk SDK and derives `ClerkUser.user_id` from `sub`. Admin routes additionally require the id to be in `ADMIN_USER_IDS`.
2. **Chat.** `POST /api/v1/chat` creates or loads an owned thread, passes the verbatim message to the deep agent, and persists LangGraph checkpoints under the thread UUID. The picker id is passed separately as `AgentContext.picker_id`.
3. **Report intake.** The subagent extracts structured fields, validates them deterministically, compares them with historical reports, and persists `raw_text` plus `picker_id` in `reports`.
4. **Long-term memory.** The agent may write notes through `StoreBackend` under namespace `(picker_id,)`. The logical path is `/memories/picker_notes.md`; after the composite backend strips the route prefix, the store key is `/picker_notes.md`.
5. **External model.** The raw message and extraction/review prompts are sent to the configured OpenAI-compatible xKiro endpoint. Provider-side retention and training use were not verified in this audit.
6. **Review.** Admins can read a projection that omits picker identity, Clerk identifiers, raw text, and thread information. The database row still contains those fields.
7. **Deletion.** Thread deletion removes that thread's checkpoints and its row; it does not remove reports or memory. Memory deletion removes only the picker's memory namespace. Report deletion hard-deletes one owned report, redacts the report's raw text from saved notes while keeping unrelated notes, and removes the source thread's checkpoints and row only when no other report still references that thread. Account-data erasure removes every owned report, thread, checkpoint (including picker-attributed checkpoints with no thread row), and memory item. All paths are scoped to the authenticated picker id and are idempotent. Account erasure and report deletion fix the order as checkpoints, then memory, then the database transaction; a storage failure returns an error rather than a partial success, and retrying is safe.

## 4. Findings

### F1. No long-term memory erasure path (High) — fixed

**Before:** `DELETE /api/v1/chat/threads/{thread_id}` called `checkpointer.adelete_thread(...)` and deleted the `chat_threads` row, but the per-picker namespace in `AsyncPostgresStore` was untouched. A picker could delete every conversation and still have `/memories/picker_notes.md` injected into the next chat.

**Now:** `DELETE /api/v1/chat/memory` erases every store item in the authenticated picker's namespace. The implementation is idempotent and does not touch other pickers or report rows.

- `backend/app/api/routes/chat.py:244` — authenticated memory-erasure route
- `backend/app/services/chat_memory.py:13` — namespace-scoped deletion
- `backend/app/agents/main_agent.py:48` — shared namespace helper
- Tests: `backend/tests/test_chat_memory.py`, `backend/tests/test_chat_api.py`

**Residual:** none for the deletion primitive. `tests/test_data_deletion.py` exercises the live `AsyncPostgresStore` with picker A/B namespaces and the live `AsyncPostgresSaver`. The chat API tests still use fakes for route wiring.

### F2. Misleading "anonymous" claims (High) — fixed

**Before:** the UI said "Reports are anonymous" and "Your name is never attached." That is inaccurate: `reports.picker_id` is the Clerk `sub` (a stable account identifier), and the raw message can contain a name, phone number, or precise address.

**Now:** the UI and documentation call the identifier **pseudonymous** and warn that raw messages may contain personal details.

- `frontend/src/components/chat/ChatView.tsx:211`
- `frontend/src/App.tsx:123`
- `PRODUCT.md`, `ScrapSense_Project_Overview.md`, `README.md`

### F3. Report and account erasure paths (High) - fixed

**Before:** `reports.raw_text` and `reports.picker_id` were retained indefinitely. There was no report-deletion or account-erasure endpoint. Deleting a thread or memory did not remove reports.

**Now:**

- `DELETE /api/v1/reports/{report_id}` hard-deletes one report owned by the authenticated picker. Foreign or missing ids both return `404`. The row's numeric observation stops contributing to future price estimates and anomaly baselines; historical estimates are not persisted, so none are rewritten. The report's raw text is redacted from saved notes without deleting unrelated notes, and the source thread's checkpoints and `chat_threads` row are removed only when no other report still references that thread.
- `DELETE /api/v1/account/data` erases all owned reports, threads, picker-attributed checkpoints (including orphans), and long-term memory. It returns counts only after every stage succeeds. A failure returns `503` with the stage that failed and can be retried safely.
- The report source thread is recorded in `reports.source_thread_id` (migration `0005`). Legacy rows without it keep their chat history when the report is deleted; account erasure still removes every owned thread and attributed checkpoint.

The API is covered by real-PostgreSQL tests in `backend/tests/test_data_deletion.py`, including foreign ownership, storage failure, partial account-erasure retry, and live LangGraph store/checkpointer deletion.

**Residual:** report raw text and picker ids still have no automatic expiry. A proposed policy is in Section 6.

### F4. Raw messages go to an external model provider (Medium) — disclosed, not mitigated

`POST /api/v1/chat` sends the picker's message verbatim to xKiro, and suspicious reports may send extraction/review prompts. No redaction, local-only mode, or provider-side data-processing agreement is configured or verified in this repository.

**Mitigation now:** UI and README warn users not to include names or phone numbers. **Open:** optional PII redaction, provider due diligence, and a documented retention/data-use agreement.

### F5. No rate limiting or durable abuse controls (Medium) — open

There is no rate limit, per-user quota, idempotency key, or LLM timeout/retry policy on the chat route. A retried request can create another thread or duplicate a report. Request body size is bounded by the chat schema, but repeated LLM calls can still be abused. This is an availability/cost risk and an indirect privacy risk through excessive data collection.

### F6. Picker id in an info-level log (Low) — fixed

`finalize_report_node` logged the picker id at info level. That is an account identifier in the operational log stream. The log now records only the report id.

- `backend/app/workflows/pipeline.py:614`

Other reviewed logs do not include raw message text: extraction logs the message length, not its content. Authentication logs the Clerk failure reason and the `azp` value, not the token. Deployment access logs and provider logs are outside this repository and were not audited.

### F7. Weak thread repository contracts (Low) — fixed

`touch_thread` and `delete_thread` previously accepted only a thread id and relied on the route's prior ownership check. They now require `user_id` and filter on it, so an internal caller cannot mutate another user's thread by id alone.

- `backend/app/services/chat_threads.py:57` and `:77`
- `backend/app/api/routes/chat.py:168` and `:239`

### F8. Secret hygiene (Informational) — verified

- Only `.env.example` files are tracked by git; local `.env` files are ignored.
- `XKIRO_API_KEY`, `CLERK_SECRET_KEY`, and `CLERK_JWT_KEY` are represented as `SecretStr` in settings.
- The local `backend/.env` has `CLERK_JWT_KEY` empty and `CLERK_SECRET_KEY` set; Clerk can verify with the secret key. No secret values were printed during this audit.
- `docker-compose.yml` contains development database credentials. Those are not production secrets but must not be reused in deployment.

### F9. Authentication, CORS, and ownership (Informational) — verified

- Chat, price, and memory routes require a Clerk bearer token.
- Reviewer routes require both authentication and membership in `ADMIN_USER_IDS`.
- Thread list/get/history/delete are ownership-scoped; foreign access returns `404`.
- CORS uses an explicit origin allowlist, `allow_credentials=False`, and only `Authorization`/`Content-Type` request headers.
- SQLAlchemy queries are parameterized.
- No public report endpoint exists.

### F10. Encryption at rest and backups (Medium) — open

Application-level storage is unencrypted: report text, checkpoints, and memory are plaintext in PostgreSQL. Database encryption, volume encryption, backup encryption, and backup retention are deployment responsibilities and are not configured here. A database or backup compromise exposes chat history, notes, and raw report text.

### F11. In-app privacy controls (Low) - fixed

The chat sidebar now has a **Privacy & data** dialog. It can delete saved notes independently, and it can erase all application-managed account data after an explicit second confirmation. The dialog explains that deleting a conversation does not remove submitted reports, while account erasure does. Errors are shown in place and account erasure is retryable. The demo workspace does not expose these controls.

### F12. Thread titles can contain message content (Low) — accepted

The first 80 characters of the first message are stored as the thread title. Titles are visible only to the owner's thread list, but they can contain PII. This is a UX trade-off, not a cross-user leak. A future change could use a material/neutral title or a shorter summary.

### F13. Report deletion over-reached into shared memory and threads (High/Medium) — fixed

**Before:** deleting one report removed any saved-note item whose value contained the raw message. Because notes are a single freeform `/memories/picker_notes.md` document per picker, this could erase every note the picker had. Report deletion also always deleted the source conversation, even when the thread held other reports.

**Now:** report deletion redacts only the exact raw message from each note and keeps the entry unless nothing meaningful remains (`backend/app/services/chat_memory.py`). The source thread and its checkpoints are deleted only when no other report still references the thread; the thread row is locked while that decision is made so concurrent deletions cannot race (`backend/app/services/report_deletion.py`). A shared conversation keeps its history for the surviving reports; the deleted report's message may remain inside that conversation.

**Residual:** removing one message from a shared checkpoint history is not attempted. The alternative — deleting the whole thread — would destroy another report's history, so the shared conversation is preserved and this limitation is documented.

### F14. Orphan checkpoint threads escaped retention and erasure (Medium) — fixed

**Before:** retention enumerated `chat_threads`, and account erasure deleted checkpoints only for threads with a `chat_threads` row. Any checkpoint thread without that row was unreachable from the UI but was never deleted.

**Now:** `backend/app/services/checkpoint_threads.py` discovers checkpoint threads directly. Account erasure deletes checkpoints attributed to the picker by checkpoint metadata even when the thread row is missing. Retention deletes orphan checkpoint threads that have no `chat_threads` row; because thread ownership is checked against that table, such threads cannot be opened by any picker. Legacy checkpoints with no `picker_id` metadata cannot be proven to belong to a requester, so account erasure never guesses; retention still removes them as global stale data.

### F15. Legacy reports have no source thread (Medium) — accepted, documented

New reports record the server-generated thread UUID in `reports.source_thread_id` via the trusted run configuration, and the pipeline logs a warning if a report is persisted without a valid thread id. Rows created before migration `0005` keep `NULL`; the thread is never guessed or backfilled. Deleting such a report removes the row and redacts memory but leaves chat history untouched, and account erasure removes every owned thread regardless. See `backend/app/workflows/pipeline.py`, `backend/alembic/versions/0005_add_report_source_thread.py`.

## 5. Implemented changes

| Change | Files | Tests |
| --- | --- | --- |
| Added `DELETE /api/v1/chat/memory` | `backend/app/api/routes/chat.py` | `test_chat_api.py` |
| Added namespace-scoped memory deletion service | `backend/app/services/chat_memory.py` | `test_chat_memory.py` |
| Exposed shared memory store and namespace helper | `backend/app/agents/main_agent.py` | `test_main_agent.py`, `test_chat_memory.py` |
| Made thread touch/delete user-scoped | `backend/app/services/chat_threads.py`, `chat.py` | `test_chat_api.py` |
| Removed picker id from info log | `backend/app/workflows/pipeline.py` | Existing pipeline tests |
| Corrected pseudonymity and PII wording | `frontend/src/App.tsx`, `ChatView.tsx`, `README.md`, `PRODUCT.md`, `ScrapSense_Project_Overview.md`, `IMPLEMENTATION_STATUS.md` | Frontend build/lint |
| Added owned-report deletion with source-thread and targeted-memory cleanup | `backend/app/api/routes/reports.py`, `backend/app/services/report_deletion.py`, `backend/app/services/chat_memory.py` | `test_data_deletion.py` |
| Redacted only the report text from saved notes, preserving unrelated notes | `backend/app/services/chat_memory.py` | `test_data_deletion.py`, `test_chat_memory.py` |
| Kept chat threads shared by multiple reports | `backend/app/services/report_deletion.py` | `test_data_deletion.py` |
| Covered orphan checkpoint threads in retention and account erasure | `backend/app/services/checkpoint_threads.py`, `retention.py`, `account_erasure.py` | `test_data_deletion.py` |
| Added account-data erasure | `backend/app/api/routes/account.py`, `backend/app/services/account_erasure.py` | `test_data_deletion.py` |
| Recorded report source thread | `backend/app/models/report.py`, `migrations/0005_add_report_source_thread.py`, `workflows/pipeline.py` | Migration up/down; `test_data_deletion.py` |
| Added operator-invoked chat retention | `backend/app/services/retention.py`, `app/core/config.py`, `.env.example` | `test_data_deletion.py` |
| Added Privacy & data UI | `frontend/src/components/chat/ChatView.tsx`, `frontend/src/components/Chat.tsx`, `frontend/src/lib/api.ts` | `npm run lint`, `npm run build` |

## 6. Retention and deletion policy

Implemented:

- Users can delete one report, all saved notes, or all account data through the API. The Privacy & data dialog exposes note and account erasure; it does not list individual reports.
- An operator can set `CHAT_RETENTION_DAYS` and run `uv run python -m app.services.retention` from `backend/` to delete expired chat threads, their checkpoints, and orphan checkpoint threads with no thread row. `0` disables it. There is no scheduler in this repository; deployment must run it periodically.
- Report deletion is a hard delete. Existing estimates are not stored, so they are not rewritten; future estimates exclude the deleted observation.
- Thread deletion and chat retention intentionally do not touch long-term memory or reports.

Still proposed, **not implemented**:

| Data | Proposed retention | Proposed trigger / action |
| --- | --- | --- |
| Long-term memory | Until user deletes, or 180 days after last activity | Operator job to delete inactive picker namespaces |
| Raw report text | 90 days, or immediately after review when no longer needed | Clear `raw_text`; keep numeric fields for aggregates |
| Picker id on reports | Keep while needed for anomaly/trust | For account closure handled outside this app, replace rows with a non-reversible pseudonym; in-app erasure already deletes them |
| Application logs | 30 days | No raw text, tokens, or picker ids |
| Backups | 30 days, encrypted | Document restore and deletion limits |

Open policy questions: whether rejected/flagged raw text should have a shorter retention period, whether account erasure should retain de-identified numeric aggregates, and whether long-term memory needs automatic expiry.

## 7. Verification

Run from `backend/`:

```text
uv run pytest          -> 219 passed, including live checkpointer/store deletion tests
uv run ruff check .    -> All checks passed
uv run mypy app tests  -> Success: no issues found
```

Run from `frontend/`:

```text
npm run lint           -> 0 errors; 3 pre-existing react(set-state-in-effect) warnings
npm run build          -> success (tsc -b && vite build)
```

The PostgreSQL container was healthy and the integration tests ran. `backend/tests/test_data_deletion.py` now exercises the live `AsyncPostgresStore`, the live `AsyncPostgresSaver`, and real report/thread rows, including ownership isolation, shared-thread preservation, memory redaction, orphan-checkpoint cleanup, failure handling, account-erasure retry, and retention cleanup. Chat API route tests still use fakes where the agent is involved. No live provider call was executed in this audit.

## 8. Recommended next steps

1. Add an automatic scheduler for `app.services.retention` and decide whether memory, reports, and raw text should expire automatically.
2. Add PII redaction or a local-only mode before sending messages to the provider.
3. Add per-user rate limits, LLM timeouts/retries, and an idempotency key.
4. Configure encrypted backups and document the backup retention/deletion boundary.
5. Add a live-provider smoke test behind an explicit opt-in flag.
