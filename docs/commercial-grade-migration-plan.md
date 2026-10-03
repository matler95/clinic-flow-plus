# Commercial-grade migration plan (Lovable → independently operated)

**Purpose:** move DentalHub out of Lovable-managed hosting without throwing away the working product or weakening its privacy boundaries. This is an implementation plan, not a claim of legal or regulatory compliance. Confirm contractual, security, and healthcare obligations with the clinics’ privacy/legal advisers before any real patient data is processed.

## Executive recommendation

Separate the move into two decisions: **who operates the application** and **who operates the data platform**. They do not need to change at the same time.

1. **First commercial release:** own the GitHub, domain, secrets, deployment pipeline, and app runtime. Run the app in an EEA location on a maintained Node.js 22 container platform/VM. Use separate development, staging, and production environments. Keep PostgreSQL, Supabase Auth, and private Storage on a **paid, independently owned Supabase project in an appropriate EEA region**, with the required backup/support terms. This is the least disruptive path because the current code already depends heavily on Supabase Auth, Postgres RPC/RLS, Realtime, and Storage.
2. **Do not self-host the whole Supabase stack just to avoid a subscription.** Supabase is open source, but production self-hosting adds responsibility for database/storage backups, upgrades, Auth email delivery, observability, incident response, and recovery. Consider it only when a named operator and tested recovery process exist, or a contractual requirement makes it necessary.
3. **Later, if there is a demonstrated need to reduce platform coupling:** migrate one service at a time (typically Storage, then database/auth only if required). An AWS EEA deployment (for example, managed containers + PostgreSQL + object storage) is a higher-control option but is a larger rewrite and has a higher operating cost. Treat self-hosted MinIO/Postgres/Auth as an explicit operations project, not a free-tier shortcut.

Provider shortlisting should compare EEA region availability, DPA/subprocessor terms, backup retention and restore support, security incident commitments, support response, exportability, and actual total cost. Do not select a “free tier” for production based on price alone; sleep/limit/backup restrictions can conflict with the product’s availability and retention guarantees. Re-check vendor terms and regions at procurement time.

### Implementation status — 2026-10-03

- **Completed:** CI uses Bun 1.4.2 and `bun install --frozen-lockfile`; the stale lockfile was regenerated. Typecheck, lint, unit tests, and build are blocking CI commands.
- **Completed:** removed the Lovable Vite wrapper and its package dependency. Vite/TanStack Start/React/Tailwind/Nitro are configured directly, with the existing custom server entry and import protection preserved.
- **Completed:** Nitro explicitly targets `node-server`; the built app was started with Node and the public home page was smoke-tested over HTTP.
- **Completed:** added a Node `start` script, a non-root multi-stage Dockerfile, a Docker context ignore file that excludes `.env`, and `/api/health`. CI now builds the image with dummy public configuration and smoke-tests the endpoint.
- **Verification limitation:** the local Docker CLI is installed, but its Docker Desktop Linux engine is unavailable in this session. The Node artifact and `/api/health` were verified outside Docker; the new hosted CI job will provide the image-level verification.
- **Known debt:** lint reports seven warnings but zero errors. Prettier formatting was removed from the ESLint gate because the existing CRLF/layout baseline generated thousands of formatting errors; formatting cleanup should be a separate, reviewable change.
- **Still pending:** Lovable preview-auth/error telemetry cleanup, provider-owned staging and production services, canonical database migrations, database-policy/E2E coverage, and production security/operations gates.

## What exists today

DentalHub is a React 19/TanStack Start PWA. The browser talks directly to Supabase for authenticated RLS-protected queries and uploads/downloads; trusted server functions use Supabase’s service-role key. The principal application flows and significant security architecture already exist: hashed one-time link tokens, short-lived signed upload/download URLs, server-side object size/signature checks, role-based RLS, transactional membership/item RPCs, an append-only audit log, content-free push notifications, and storage-first retention purge. The product documentation already calls out the pilot as synthetic-data-only.

The core implementation is therefore **not a blank-slate rebuild**. The main gap is that deployment, migrations, operational assurance, and some critical production controls are not yet independent or complete.

### Current blockers / material gaps

| Area | Current evidence | Production implication |
|---|---|---|
| Residual Lovable coupling | The Vite wrapper and package dependency have been removed; Vite plugins and Nitro target are now explicit. Preview auth, error reporting, and the `LOVABLE_CRON_SECRET` name remain Lovable-specific. | Finish removing preview-only behavior and production telemetry coupling; rename/rotate cron credentials before independent deployment. |
| Backend ownership | Source/configuration expects Lovable-connected Supabase settings and migration URL. `supabase/config.toml` only identifies a project. | Confirm whether the current live Supabase project is Lovable-managed or independently owned, what region/plan it uses, and who can export it. Create a destination project before scheduling a data move. |
| Migration source of truth | `drizzle/schema.ts` is intentionally blank; the SQL schema is in `drizzle/migrations/0000_base_schema_m0_m1_m2.sql`, while `drizzle.config.ts` points Drizzle at the blank schema. There is no populated Supabase migration directory. | A new environment cannot yet be reliably bootstrapped or migrated from a clean checkout. Establish one tested, versioned SQL migration workflow and stop relying on dashboard-only changes. |
| CI/reproducibility | CI now pins Bun 1.4.2, performs a frozen install, and makes typecheck/lint/test/build blocking. Lint currently has seven warnings and no errors; Prettier is intentionally outside this gate pending a separate formatting baseline cleanup. | Foundation checkpoint is verified. Keep the lockfile current with dependency changes and resolve warnings deliberately. |
| Runtime target | Nitro now explicitly emits `node-server`; a local Node start and HTTP home-page smoke test succeeded. Server code uses `process.env` and `node:crypto`. | Runtime target is established, but add container-level checks and exercise authenticated, upload, scheduled, and error paths in staging. |
| Operational entry points | A non-root Node image, `start` script, `/api/health`, and CI image smoke-test are now defined. The image could not be built locally because the Docker Desktop engine is unavailable. The purge still uses `LOVABLE_CRON_SECRET`. | Confirm the image job in hosted CI; add production deployment/rollback and a scheduler/secret lifecycle not named after Lovable. Verify failed and repeated jobs are safe. |
| Malware and uploads | Magic-byte allow-list and size checks are implemented; the actual AV scan remains a placeholder and records `unscanned`. A user can upload DICOM, PDF, and images. | Do not present files as malware-scanned. Before real patient data, quarantine objects and make access conditional on a clean verdict; test scanner outages and timeouts. File contents/metadata can themselves contain patient information. |
| Public endpoints / abuse | Drop links are high-entropy and bounded by optional use limits; the Gate 1 checklist still calls for daily limits and anti-bot protection. | Add layered abuse controls (per-link/org/IP rate limits, size and concurrency limits, alerts); an anti-bot control may be an additional layer, not the only quota enforcement. Avoid retaining raw IPs without a reviewed purpose/retention policy. |
| Invitations | `addMember` writes a pending invitation but logs a dummy-email message; signup is available from the login screen. | Commercial onboarding is incomplete. Implement and test invitation/verification emails, password recovery, domain and redirect configuration, spam controls, and the intended signup policy. |
| Telemetry | Runtime errors are forwarded to Lovable preview hooks; server errors mostly reach `console.error`. | Replace with production error/metric/uptime monitoring with sensitive-field scrubbing, alert ownership, and no file names, tokens, signed URLs, notes, or patient identifiers in logs. |
| Automated assurance | Vitest covers selected utility/security behavior; the E2E plan is manual. The documented plan asks for pgTAP/RLS and penetration testing. | Add database-policy tests and automated critical-flow tests before a real-data release. A passing TypeScript build is not evidence that RLS, RPC grants, storage policy, or retention work. |
| Deletion ordering | Explicit item deletion deletes the database row before removing Storage bytes in `src/lib/files.functions.ts`; the project rule requires storage deletion first for retention purge. | Make user deletion follow the same invariant: remove bytes first, keep the row and report failure if Storage deletion fails, then delete/audit. Add failure-injection tests. |
| Privacy/legal gate | The Gate 1 checklist already calls out contracts, retention, EEA backend, CSP, AV, rate limits, pgTAP, and penetration testing. | Keep this gate; additionally assess the full data flow, vendor terms, DPIA need, incident obligations, backup locations, and clinic instructions with qualified advisers. |

**Patient-data warning:** “no patient data” is a pilot operating rule, not a technical guarantee. Names or identifiers may be present in filenames, notes, scans, PDFs, DICOM headers, sender fields, backups, browser telemetry, and support exports. Use only synthetic fixtures until the release gate is approved, and design all systems as though uploads may contain sensitive health data.

## Target architecture

```text
Browser / PWA
  ├─ static app + same-origin TanStack Start server (EEA Node.js runtime)
  ├─ Supabase Auth + RLS-protected Postgres (independently owned, EEA)
  └─ private Supabase Storage (signed upload/download URLs; same EEA project)

GitHub Actions
  ├─ frozen install → typecheck → lint → unit + DB/RLS + E2E tests → build
  ├─ deploy immutable artifact to staging → smoke tests → production approval
  └─ scheduled retention job with a rotated, separately stored secret

Isolated AV worker (EEA)
  └─ quarantine object → scan → clean: publish item / infected or error: deny access + alert

Operations
  ├─ scrubbed error/metrics + external uptime checks + actionable alerts
  ├─ monitored backup and restore process; documented RPO/RTO
  └─ incident, access-review, retention, and change-management procedures
```

Keep the service-role credential server-only. Keep the upload bucket private and do not proxy large file bodies through the application server unless there is a deliberate, tested reason. Continue using short-lived signed URLs and validate authorization before issuing a download URL. Signed URLs are bearer credentials: never put them in analytics or logs.

For the first deployment, prefer an EEA Node container runtime on a vendor with an appropriate contract and reliable operations. A VM from an EEA provider can be economical, but the team then owns OS hardening, patching, firewalling, container lifecycle, backups, monitoring, and recovery. A managed container service may cost more but reduces that burden. Keep the app stateless and externalize durable state to Supabase. Avoid a globally distributed edge runtime until residency, logging, and runtime compatibility have been explicitly reviewed.

## Phased implementation

Effort is relative planning guidance, not a fixed quote. Run phases in order; do not combine the data cutover and first infrastructure experiment.

### Phase 0 — Ownership and release criteria (S, prerequisite)

- Inventory all Lovable organization/project access, GitHub remotes/branch protections, Supabase project owner/region/plan, DNS/domain registrar, email sender, VAPID keys, GitHub secrets, data exports, and scheduled tasks.
- Decide who is data controller/processor for each clinic, what data the product is allowed to process, retention/deletion rules, support access, and whether a DPIA or other assessment is required. Obtain reviewed DPAs and subprocessor terms before production health data.
- Set service targets with the first clinics: availability window, support/incident contact, backup frequency, proposed RPO/RTO, restore-test interval, and maintenance window. Start with achievable targets and document them; raise targets only when architecture supports them.
- Create an explicit release checklist and retain the POC/synthetic-data banner until every gate below passes.

**Exit:** named owners and access to all source systems; approved provider shortlist and target regions; written product/data scope; migration source and rollback owner identified.

### Phase 1 — Reproducible non-Lovable build (M)

- Replace the Lovable Vite wrapper with standard, pinned Vite/TanStack Start/Nitro configuration. Select a supported Node.js 22 LTS preset/runtime, rather than inheriting a Cloudflare default. Remove Lovable preview-session broker code from production auth storage; retain a local-only dev path if it is still useful. Replace Lovable error forwarding with an application telemetry adapter.
- Add explicit `build`, `start`, and health-check behavior; produce an immutable, non-root container image. Document CPU/memory limits, graceful shutdown, readiness, and deployment rollback. Verify server-only modules and environment variables cannot enter browser bundles.
- Select one package manager. Given the existing `bun.lock`, either standardize on Bun with a frozen-lock CI install or deliberately generate/commit npm’s lockfile and use `npm ci`; never install floating dependency trees in CI. Review the beta Nitro dependency and pin/update it deliberately.
- Add environment validation at startup and `.env.example` containing variable names only. Separate browser-publishable configuration from server-only secrets. Rename `LOVABLE_CRON_SECRET` to a provider-neutral `CRON_SECRET`, support rotation overlap only for a defined interval, then remove the old secret.
- Make lint/typecheck/tests/build blocking in CI. Protect `main` with required checks and reviewed changes; retain secret scanning. Add dependency/security update automation and artifact provenance as appropriate to team size.

**Exit:** clean checkout produces a reproducible image; image runs in a local/CI Node container; no Lovable package/plugin or production telemetry dependency is required; all required CI checks block merges.

### Phase 2 — Database and storage lifecycle (M–L)

- Make a canonical migration track. Recommended for the current stack: use Supabase CLI local development and checked-in `supabase/migrations/*.sql`, with `supabase db reset`/equivalent proving an empty database can be built. Move/adapt the current DDL and RPCs in reviewed, ordered migrations; do not leave the blank Drizzle schema and raw migration files as competing authorities. Keep generated Supabase types generated from the canonical local schema.
- Put all privileges, RLS policies, SECURITY DEFINER functions, `search_path` hardening, triggers, Realtime publication membership, Storage bucket policies, and seed fixtures under version control. Verify function `EXECUTE` grants explicitly. Use least-privilege application roles; isolate administrative/service-role code on the server.
- Add pgTAP or equivalent tests for every tenant/role boundary, inactive membership, anonymous drop-link behavior, invitation acceptance, assignment/transfer/offboarding, file signing, audit immutability, and expiry. Include negative tests (cross-organization read/write, forged IDs, expired/revoked token, role change during session).
- Add a migration pipeline: disposable local/test database → staging migration and smoke suite → reviewed production migration. Document forward-fix/rollback rules; schema rollback is not always safe. Do not run DDL automatically at web-app startup.
- Define and test a complete backup/restore runbook for database **and object bytes**, including auth users, SQL functions/policies, Storage objects, and required secrets. Verify provider backups cover the needed data and retention; schedule a restore drill and record measured recovery time.
- Correct explicit deletion to remove Storage bytes first. Add idempotent cleanup for failed uploads, failed scan objects, expired items, orphan objects, and rows whose object is missing. Make purge batch size/progress observable and safely resumable.

**Exit:** a fresh local/staging DB is created from migrations; policy tests pass; restore drill recovers DB plus private objects; failed Storage deletion demonstrably leaves the database record available for retry.

### Phase 3 — Production controls and operational readiness (L)

- **Scanning:** introduce a private quarantine state/area and an isolated ClamAV worker (or a reviewed commercial scanning service) in the selected region. Scan the exact stored bytes before making an item readable or notifying the recipient. Store verdict, engine/signature version, timestamps, and failures without storing file content in logs. Fail closed on timeout/unavailable scanner; define re-scan and false-positive handling. ClamAV is one layer, not proof of safety.
- **Abuse:** add server-side quotas/rate limits for token resolution, upload-init/complete, receipts, login/invite, and cron endpoints; cap concurrent uploads and total per-link/org bytes. Make limits atomic against races. Add bot friction (for example, a privacy-reviewed anti-bot service) only as an additional control. Alert on spikes without logging bearer tokens or sensitive IP data unnecessarily.
- **Auth and mail:** choose invite-only versus self-registration explicitly; require verified email; configure production Site URL and exact redirect allow-list; test recovery, expired links, and account offboarding. Implement invitation delivery (current email is a placeholder), verified sender DNS (SPF/DKIM/DMARC), bounce handling, and generic message content. Review all email provider location/retention terms.
- **Web security:** build a strict CSP from actual app behavior and test it against Supabase APIs, signed viewer URLs, DICOM/image blob sources, fonts, and PWA assets. Set security headers at the application and/or trusted edge, remove unsafe exceptions, and verify HTTPS/HSTS only on the production domain. Add CSRF/origin checks for all cookie/session-sensitive endpoints and test them in the deployed topology.
- **Telemetry:** add external uptime checks, structured server logs, request/trace IDs, error reporting, and metrics for upload, scan, notification, purge, auth, and database failures. Scrub request bodies, URL query strings, authorization headers, signed URLs, file names, free-text notes, email addresses, and identifiers. Set access control and short retention for operational logs.
- **Notification reliability:** implement a durable outbox/worker with retries, deduplication/idempotency, dead-letter/alert behavior, and provider result recording. Current attempts can be performed inline with request flows; ensure provider outages do not make a file inaccessible or silently lose a notification.
- **Operations:** finish incident and support runbooks; alert on purge/scan/backup failures; schedule access reviews and secret rotation; test PWA update behavior and browser/device coverage; complete an independent security review/penetration test and remediate findings.

**Exit:** all uploaded items are inaccessible until clean scan; abuse limits and alerts are tested; invitations/recovery work; monitoring excludes sensitive payloads; a tabletop incident and recovery exercise is completed.

### Phase 4 — Staging rehearsal and data migration (M–L; only if migrating existing data)

- Provision separate destination projects/environments with production-like configuration but synthetic staging content. Confirm destination region, plan, DPA, backup settings, custom SMTP, auth redirects, private bucket policies, Realtime, SQL extensions, and service-role handling.
- Rehearse a migration from an export of the source into staging. Include table data, Auth users, identities, memberships, password behavior, RPCs/policies/triggers/grants, Storage objects, push subscriptions, audit history, and scheduled jobs. Preserve UUIDs where possible. Do not assume password hashes/identity providers can be moved unchanged; validate with test accounts and prepare a forced password reset/re-invitation path if required.
- Copy private objects with a controlled server-side tool and verify object count, size, and cryptographic checksums. Never make a bucket public to simplify copying. Keep signed URL expiration short; URLs created against the source will not be valid for the destination.
- Compare record counts and invariants (active memberships, item-to-object mapping, expiry dates, token hashes, audit rows, notification history), then test upload, download, receipt, offboarding, and purge end-to-end. Do not migrate synthetic POC data into production without a retention/business reason.
- Prepare a freeze/cutover script and rollback decision point. During cutover, pause writes and scheduled cleanup, take final database/object snapshots, apply the final delta, validate, switch secrets/config, and then change DNS. Keep the source read-only and available for a defined rollback window; do not allow two writable systems to diverge. Reconcile in-flight uploads before opening the new endpoint.
- Preserve the production domain if possible. If domain changes, update auth redirects, email links, PWA manifest/service worker, push subscription behavior, and clinic QR/bookmarked drop links. Test that old links fail safely or redirect only through an explicitly designed migration path.

**Exit:** staging rehearsal meets agreed downtime and recovery objectives; checksums and identity behavior are verified; rollback has been practiced; production cutover is approved by product, operations, and the privacy/security owner.

### Phase 5 — Controlled launch and ongoing service (S → continuous)

- Start with a small set of clinics under written agreement and named support contacts. Keep patient data disabled until all legal/privacy gates, scan controls, RLS tests, security review, and backup/recovery checks have signed evidence.
- Monitor error rate, latency, storage growth, scan backlog, upload rejection, email/push delivery, purge success, backup status, and cost. Review alerts daily during launch, then agree on a sustainable on-call/support cadence.
- Review membership and privileged access, dependency updates, region/subprocessor changes, retention configuration, security advisories, and restore results on a set schedule. Rehearse incident response and customer notification duties.
- Establish data export/deletion procedures for a clinic termination and a documented vendor-exit path. Keep audit and backup retention aligned with reviewed obligations; deletion from the live DB is not complete until object copies and backup lifecycle are addressed.

**Exit:** launch criteria remain met over an agreed pilot period; no unresolved critical/high security findings; operational owner accepts the service and cost model.

## Suggested environment and secret inventory

Create separate values for local, test, staging, and production. Never copy production secrets into CI logs or local developer machines.

- Browser build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `APP_URL`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY_PKCS8`, `VAPID_SUBJECT`, `RESEND_API_KEY`, `EMAIL_FROM`.
- Deployment/ops: registry/deploy identity using short-lived OIDC where supported; telemetry DSN with reviewed settings; backup/export credentials kept separate from runtime credentials.
- Future scanner: private queue/worker credentials and quarantine configuration, isolated from public request handlers.

Run a secret scan on repository history and deployment settings before first production deployment. Rotate any credential that has appeared in client bundles, logs, issue trackers, shell history, or untrusted previews. The Supabase service-role key must never be prefixed with `VITE_` or otherwise shipped to browsers.

## Recommended release gates

**Gate A — independent deploy:** clean frozen build; Node container health/readiness; independent domain/TLS; secrets checked; Lovable-only code paths removed/disabled; staging smoke tests pass.

**Gate B — data platform:** clean migration bootstrap; pgTAP/RLS negative cases pass; private bucket access verified; AV quarantine fail-closed; purge and user deletion storage-first; DB + object restore drill recorded.

**Gate C — patient-data authorization:** legal/privacy review and required agreements complete; approved retention and support model; rate limits, CSP, telemetry redaction, invitation/recovery, security assessment, incident process, and pilot training complete. Only the responsible business/privacy owner can authorize this gate.

**Gate D — cutover:** rehearsal and rollback completed; final snapshot and object checksums verified; production approval; monitoring staffed; old system put read-only and retained for the agreed rollback period.

## Immediate next 10 actions

1. Confirm who owns the current Supabase project and whether it is Lovable-managed; record its region, plan, backups, current data volume, and export permissions.
2. Confirm that production remains synthetic-data-only; warn pilot users that files may embed patient identifiers even when UI fields do not.
3. [x] Pick Bun and make CI deterministic; make correctness lint blocking. (Completed; Prettier cleanup remains separate.)
4. [x] Replace the Lovable Vite wrapper with standard plugins, select explicit Node output, and smoke-test the built app. (Completed; container deployment remains.)
5. Replace Lovable-specific preview auth/error telemetry paths and rename the cron secret.
6. Establish a canonical Supabase CLI migration track and demonstrate a clean database reset from the repository.
7. Add pgTAP tests for tenant isolation and role changes; add critical-flow E2E coverage against disposable Supabase.
8. Fix storage-first explicit deletion; add upload/orphan/scan failure tests.
9. Provision independently owned EEA staging Supabase and app deployment; configure domain, auth/email, private storage, backups, and monitoring.
10. Implement quarantine scanning, rate limits, and production email; then run security/legal gates before any patient-data pilot.

## Repository references reviewed

- [AGENTS.md](../AGENTS.md) — security and data lifecycle invariants.
- [README.md](../README.md) — POC scope, stack, run instructions, and environment variables.
- [docs/gate1-checklist.md](gate1-checklist.md), [docs/threat-model.md](threat-model.md), [docs/e2e-test-plan.md](e2e-test-plan.md), [docs/runbook-incident.md](runbook-incident.md) — existing readiness and operational documentation.
- [vite.config.ts](../vite.config.ts), [package.json](../package.json), [Dockerfile](../Dockerfile), [.dockerignore](../.dockerignore), [drizzle.config.ts](../drizzle.config.ts), [drizzle/schema.ts](../drizzle/schema.ts), [supabase/config.toml](../supabase/config.toml) — independent Node build/container setup and migration/bootstrap mismatch.
- [.github/workflows/ci.yml](../.github/workflows/ci.yml), [.github/workflows/purge-expired.yml](../.github/workflows/purge-expired.yml), [src/routes/api/health.ts](../src/routes/api/health.ts) — CI, scheduled retention, and liveness smoke check.
- [src/integrations/supabase/client.ts](../src/integrations/supabase/client.ts), [src/integrations/supabase/client.server.ts](../src/integrations/supabase/client.server.ts), [src/integrations/supabase/previewAuthStorage.ts](../src/integrations/supabase/previewAuthStorage.ts), [src/lib/lovable-error-reporting.ts](../src/lib/lovable-error-reporting.ts) — client/server credentials and Lovable-specific behavior.
- [src/lib/drop.functions.ts](../src/lib/drop.functions.ts), [src/lib/files.functions.ts](../src/lib/files.functions.ts), [src/lib/tokens.server.ts](../src/lib/tokens.server.ts), [src/server.ts](../src/server.ts) — public upload flow, privileged operations, object validation, security headers, and deletion behavior.
