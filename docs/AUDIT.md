# eBay Hero – Audit, Architecture Plan, and Checklist

_Living document. Update the checklist as work lands._

## 1. Current architecture (as found)

| Area | Finding |
| --- | --- |
| Stack | React 19 + Vite 8 + Tailwind 4 SPA, served by a single Express `server.ts` (`tsx`). No DB; state lives in `localStorage` (`AppContext.tsx`). |
| AI | `server/gemini.ts` (Gemini only; Ollama only has a connectivity test endpoint). |
| Google | Firebase `signInWithPopup` in the browser (`src/services/googleAuth.ts`). Access token lives in React state. Drive/Photos/Sheets are called **directly from the browser** with that token. |
| Picker | `src/components/AddPhotosModal.tsx` (1,445 lines) mixes Drive, "Photos", local, and a synthetic "Computers" tree in one component. |
| eBay | `EbayStudioView` only generates drafts; no credentials, OAuth, CSV export. |
| Tests | None. No test runner. |
| Install | `npm install` fails with ERESOLVE; needs `--legacy-peer-deps` (`.npmrc` added). |

## 2. Root cause analysis – "strange folder names"

The strange names (_Enable Disable_, _Photo Viewer Restore_, …) are real folders from the user's
**Google Drive**, shown in places where the UI claimed they were something else. There is no single
bug; five independent defects combine:

1. **"Google Photos" was never Google Photos.** `googlePhotos.ts` calls the *Drive* API
   (`/drive/v3/files?q=mimeType contains 'image/'`). Photos "albums" are Drive **folders whose name contains
   `Photo`, `Album`, `Camera`, `Cards`, or `Collectibles`** (`fetchGooglePhotosAlbums`). A Drive folder named
   e.g. "Enable Disable Windows Photo Viewer" / "Photo Viewer Restore" matches `Photo` and is displayed as a
   Photos album. If the call fails, **hard-coded fake albums** are returned ("Trading Cards & Slabs", 45 items…).
2. **Drive folder listing is global, not hierarchical.** `fetchDriveFolders` lists *every* folder in the account
   (no `'<id>' in parents`), capped at one page of 100 with no pagination (`orderBy=name`), so the result is an
   arbitrary alphabetical slice of the account.
3. **Nested folders were relabelled as "Computers" backups.** In `fetchDriveCompleteHierarchy`, any folder
   whose parent is not My Drive root is pushed into `computerBackupChildren` and shown under
   *Computers → My Computer → Other Backed Up Folders*. Ordinary subfolders therefore appear as computer backups.
4. **Fabricated resources.** The tree hard-codes `F:\Backups\Images`, `F:\Images`, `Documents`, "My Computer", and a
   name-substring heuristic (`images|photos|backups`) picks a random real folder ID to back them. Clicking
   `F:\Images` runs a name-contains query (`IMG|image|photo|scan|card`). Drive API v3 exposes **no documented
   "Computers" root**; this section cannot be built from real API data.
5. **Wrong scopes / token model.** 15 scopes are requested (incl. `drive.scripts`, `drive.install`, `drive.meet.readonly`,
   deprecated `drive.photos.readonly`), via a Firebase token that cannot be refreshed (expires in ~1 h, dropped on reload).
   None of them grant Google Photos access: the Photos **Library API** read scopes were removed on 2025‑03‑31 and the
   supported way to read a user's photos is the **Google Photos Picker API** (`photospicker.mediaitems.readonly`).

Secondary defects found in the same code path
* Select All for Photos/Local selects only the loaded array; Drive Select All fetches ≤5000 flat results and has no
  folder/recursive concept and no exclusions.
* Import failure silently substitutes an **Unsplash stock photo** and a fake `2048000` byte size; local import hard-codes
  `image/jpeg`.
* `/api/drive/detect` returns fake `P:\My Drive` / `F:\Images` mounts when nothing is found.
* Previews are base64 strings stored in `localStorage` (quota failures with large batches).
* Tokens are accessible to any script in the page; no server-side secret storage.

## 3. Fix strategy (Phase 3)

* **Server-side OAuth 2.0 authorization-code flow** (`server/google/*`). Refresh tokens encrypted at rest (AES‑256‑GCM);
  the browser never sees any Google token. Incremental, per-service consent: Drive (`drive.readonly`) and Photos Picker
  (`photospicker.mediaitems.readonly`) are connected independently. Firebase popup remains only for the legacy Sheets/manifest
  export, scopes reduced to `drive.file` + `spreadsheets`.
* **Drive**: real hierarchy only (`'<id>' in parents`, `sharedWithMe`, `drives.list`), full pagination, genuine metadata.
  Recursive enumeration with counts, bytes, and unsupported/skipped tallies.
* **Photos**: Picker API session flow (create session → user picks in Google UI → poll → list picked items → download with
  bearer token → delete session). Library browsing/albums are **not offered** because the API no longer supports it.
* **Computers (Drive for Desktop backups)**: not exposed as a browsable tree by Drive API v3. UI says so and offers: (a) local
  mounted folder import via the Local source, (b) files that were synced into Drive are found through search.
* **Selection model** (`src/lib/selection.ts`): scope-based (`include` scopes + explicit adds, exclusions) so "Select all in folder
  (recursive)" is one object, not N rows. Server enumerates on demand.
* **Managed library** (`server/library.ts`): imported bytes stored on disk with magic-byte validation; UI receives URLs, not base64.

## 4. Planned modules (Phases 4‑6)

`server/` gains: `ai/` (provider interface + Gemini/Ollama/OpenAI-compatible adapters + schema validation + cache),
`fileops/` (rename/organize planner, manifest, executor, rollback), `ebay/` (credential vault, OAuth, listing templates,
CSV engine), `plugins/` (registry, manifest validation, lifecycle) and `plugins/stamplicity`, `plugins/cardops`.
Persistence moves to SQLite (`node:sqlite`) with versioned migrations when Phase 4 starts; current `localStorage` data
is imported once, not discarded.

## 5. Checklist

Legend: ✅ done & verified · 🟡 partial · ⬜ not started

| # | Item | Status |
| --- | --- | --- |
| 1 | Audit + root cause analysis | ✅ |
| 2 | Server-side Google OAuth, encrypted token store, connection diagnostics | ✅ (live OAuth requires your client ID/secret) |
| 3 | Drive API integration (hierarchy, shared, shared drives, search, pagination, recursive enumeration) | ✅ unit-tested against mocked Drive API |
| 4 | Photos Picker API integration | ✅ unit-tested against mocked API |
| 5 | Scope-based selection model w/ exclusions | ✅ |
| 6 | New Drive/Photos picker UI + Google Connections page | see status in README |
| 7 | Local upload / directory import | ⬜ |
| 8 | AI image intelligence (provider-agnostic) | ⬜ |
| 9 | Approval-based rename + manifest + rollback | ⬜ |
| 10 | Organization engine | ⬜ |
| 11 | eBay credentials / OAuth / listing templates / CSV | ⬜ |
| 12 | Plugin system + Stamplicity + CardOps | ⬜ |
| 13 | Expanded settings, SQLite migration | ⬜ |

## 6. Known API limitations (verified against current docs when written)

* **Google Photos**: Library API can no longer read the user's whole library or albums created outside the app. Only the Picker API
  (user selects in Google's UI; no folder tree, no "select all library" programmatically). `baseUrl`s expire after ~60 min and
  require the `Authorization` header.
* **Drive `drive.readonly`** is a *restricted* scope: unverified OAuth clients are limited to test users (100) and show a warning.
* **Drive "Computers"** backups: no documented listing endpoint in Drive API v3.
* **eBay scan-a-card**: no public API; CardOps will use a replaceable `CardIdentifier` interface (Phase 6).
