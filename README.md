# eBay Hero — AI-Powered Collectibles Inventory & E-Commerce Platform

eBay Hero is a full-stack, modular AI-powered inventory management and e-commerce application designed for high-volume collectors and powersellers. It combines Gemini Multimodal Vision, Google Workspace (Drive & Photos), eBay Developer APIs, intelligent file renaming and directory restructuring, and domain-specialized collectibles plugins.

---

## 🌟 Key Architecture & Capabilities

### 1. Separate & Independent Image Sources
Replaces fragmented, improperly mapped picker logic with three dedicated, isolated import workflows:
* **Google Photos**: Integrates with Google's official **Photos Picker API** (`photospicker.googleapis.com/v1/sessions`). Uses user-authorized picker sessions, polling, and media item streaming. Third-party unrestricted library crawling (deprecated by Google on March 31, 2025) is cleanly replaced with the official picker session model.
* **Google Drive**: Dedicated hierarchical Google Drive v3 client supporting **My Drive**, **Shared Drives**, nested directories, breadcrumb navigation, and genuine Drive metadata (File ID, MIME type, modified time, size). Correctly distinguishes Drive API resources from locally mounted Google Drive for Desktop paths and "Computers" backup streams.
* **Local File Upload**: Drag-and-drop, directory traversal via the browser's File System Access API (`showDirectoryPicker`), recursive ingestion, format validation, and server-side magic-byte sniffing (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/tiff`, `image/bmp`, `image/heic`).

### 2. True Recursive Selection & Exclusion Engine
* Selection state is tracked using high-capacity **Selection Scopes** rather than naive client-side DOM checkboxes.
* Supports **Select All in Current Directory** and **Include Subdirectories** with individual deselection / exclusion tracking.
* Summarizes eligible file counts, directories traversed, estimated storage, unsupported formats, and duplicates before streaming ingest.

### 3. Server-Side AES-256-GCM Credential Vault
* All sensitive credentials (Google OAuth refresh tokens, eBay App ID / Cert ID, API keys) are stored on the backend in an encrypted-at-rest JSON vault (`data/*.enc.json`) using AES-256-GCM.
* Secret tokens are strictly blocked from client-side bundles, `localStorage`, and public diagnostic endpoints.
* CSRF protection is enforced on all state-changing API endpoints via custom header validation (`X-Requested-With: ebay-hero`).

### 4. Multimodal AI Appraisal Engine
* **Google Gemini Vision**: Supports `gemini-3.8-flash` (low latency, high volume) and `gemini-3.1-pro-preview` with High Thinking mode for inspecting micro-creases, centering, print lines, and surface wear.
* **Local AI**: Supports local vision models via **Ollama** (`qwen2.5-vl`, `llava`) and OpenAI-compatible vision chat endpoints.
* **Content-Addressed Caching**: Computes SHA-256 hashes of image buffers to prevent redundant API calls.

### 5. File Renaming, Directory Organization & Atomic Rollback
* Evaluates customizable templates (e.g., `{category}_{description}_{date}`, `{year}_{brand}_{player}_{grade}`).
* Enforces **Safe Path Bounds** (blocks directory traversal and unauthorized path escapes).
* Implements collision resolutions: `append_number` (`_001`, `_002`), `timestamp`, or `skip`.
* Generates an **Operation Manifest** and reverse rollback log; provides one-click rollback to restore original paths instantly.

### 6. eBay Developer & File Exchange CSV Engine
* Secure storage and connection testing for eBay Sandbox and Production developer accounts.
* Pre-configured listing templates for **Trading Cards**, **Postage Stamps**, and **General Collectibles**.
* Real-time pre-export validation: enforces strict 80-character title maximums, required categories, condition descriptors, and pricing rules.
* Official **eBay File Exchange / MIP CSV** export with dynamic `C:<ItemSpecific>` columns.

### 7. Modular Collectibles Plugins
* **Stamplicity** (Philatelic Stamps): Identifies Scott catalogue numbers, perforation measurements (e.g., 11x11), watermark varieties, gum conditions (MNH, MLH, Used), and centering grades.
* **CardOps** (Trading Cards): Identifies sports cards and TCG cards, detects PSA/BGS/CGC grading slabs, parses certification numbers, and categorizes parallels/refractors. Clarifies the technical reality that eBay's native card scanner is proprietary to the eBay mobile app, and provides Gemini multimodal vision as the open, cross-platform replacement.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
* **Backend**: Express.js, Node.js (v20+ / v24+), Native TypeScript execution
* **Security**: Node.js `crypto` (AES-256-GCM), Scrypt key derivation
* **AI & Cloud**: `@google/genai` (Google Gen AI SDK), Google Drive v3 API, Google Photos Picker v1 API, eBay REST APIs
* **Testing**: Vitest (Unit and integration test suite with 81 passing tests)

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js v20+ or v24+
* npm or pnpm

### 2. Installation
```bash
npm install --legacy-peer-deps
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```env
PORT=3000

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Google OAuth 2.0 Credentials (Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback

# Master Encryption Key (Optional, auto-generated if omitted)
EBAY_HERO_SECRET_KEY=your-32-character-or-hex-encryption-key
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running the Automated Test Suite
To run all 81 unit and integration tests across the Drive client, Photos client, secret store, accounts service, fileops organizer, eBay CSV engine, plugin registry, and HTTP routes:
```bash
node node_modules/vitest/vitest.mjs run
```

To run TypeScript compile checks:
```bash
node node_modules/typescript/bin/tsc --noEmit
```

---

## 📁 Project Structure

```
├── server.ts                       # Express server with Vite middleware integration
├── server/
│   ├── ai/                         # Multi-provider AI engine (Gemini, Ollama, OpenAI)
│   ├── ebay/                       # eBay Developer service, templates, CSV generator
│   ├── fileops/                    # Safe file renamer, directory builder, and rollback
│   ├── google/                     # Google OAuth, Drive v3 client, Photos Picker v1
│   ├── library.ts                  # Managed image library with magic byte sniffing
│   ├── plugins/                    # Modular plugins (Stamplicity, CardOps, registry)
│   ├── routes/                     # Extended REST API routes (/api/*)
│   └── security/                   # AES-256-GCM encrypted-at-rest credential vault
├── src/
│   ├── components/
│   │   ├── google/                 # Google account connections and diagnostics UI
│   │   ├── ebay/                   # eBay connection card
│   │   ├── pickers/                # Google Drive, Google Photos, Local File pickers
│   │   └── views/                  # Primary application views (Analyzer, eBay Studio, Plugins, etc.)
│   ├── context/                    # React global state (AppContext)
│   ├── lib/                        # Client-side selection scope model
│   ├── services/                   # Typed API client with CSRF and NDJSON parser
│   └── types/                      # Frontend TypeScript interfaces
└── tests/                          # 81 comprehensive Vitest test cases
```

---

## 🔒 Security Best Practices
1. **Never commit `.env` or `data/*.enc.json`** to public version control.
2. Ensure `X-Requested-With: ebay-hero` header is sent with all state-changing API requests.
3. The encryption master key should be backed up securely in production environments (`EBAY_HERO_SECRET_KEY`).
