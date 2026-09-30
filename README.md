# NyayaVault: Secure Digital Document Management System for legal and investigation documents 
**Smart India Hackathon 2026 — Problem Statement ID: SIH26190**  
**Team:** S.W.O.R.D.  
**Tagline:** Secure Evidence. Stronger Justice.

NyayaVault is a prototype. It is a court-ready evidence-document intelligence platform: encrypted off-chain storage, SHA-256 version integrity, an append-only audit trail, a tamper-evident hash chain (not a public blockchain), OCR, local AI summarization, and privacy-aware sharing. It is **not** a national ICJS/CCTNS replacement.

All people, stations, FIR numbers, and facts in the demo are **fictional**.

## Current phase

Most core features (identity, RBAC/ABAC, audit, upload, ledger UI, sharing, OCR, AI assistant, and court bundle export) are implemented and functional.

See `Docs/archive/IMPLEMENTATION_LOG_PHASE_0_TO_10.md` for the historical engineering record.

## 🛑 Important Notes Before Cloning

Before you clone and run this repository, please note the following to ensure a smooth setup:

1. **100% Offline AI:** The AI Legal Assistant runs entirely locally in your browser using a quantized ONNX model and WebGPU. Zero data is sent to the cloud.
2. **Standalone Architecture:** To make setup as frictionless as possible, we avoided complex Docker orchestration. The entire stack (Backend API, Frontend UI, SQLite Database, Local File Storage, and Local OCR) runs inside a **single Next.js process**.
3. **Pre-Seeded Data:** Running `npm run db:seed` will automatically populate the database with a fictional women-safety case, dummy documents, and the required role-based user accounts so you don't have to register from scratch.
4. **First-Run OCR Delay:** The very first time you upload an image for OCR, the local `tesseract.js` engine will download the required language models from the internet in the background. This can take a minute depending on your connection. Our frontend is configured to poll patiently during this phase without hitting rate limits!

## Quick start

Prerequisites: Node.js 20+ and npm.

## AI engine (100% Offline & Air-Gapped)
To comply with strict data privacy laws for sensitive legal documents, the AI Case Assistant has been completely isolated from the internet. 

It uses **Transformers.js (v3)** to run the `LaMini-Flan-T5-77M` model entirely inside your web browser. 
- It dynamically utilizes **WebGPU** hardware acceleration if your graphics card supports it, for lightning-fast inference.
- If no GPU is available, it silently falls back to CPU processing via WebAssembly (WASM).
Zero text or case data ever leaves the local machine.

### 🤖 Evaluator Note: AI Model Limitations (Proof of Concept)
The current local model (`LaMini-Flan-T5-77M`) is extremely small (~97 MB) so that it can run smoothly in any browser without requiring massive downloads. Because of its tiny size, **it may hallucinate or struggle with complex summaries**. 

**This is a Proof of Concept showing that 100% offline, air-gapped WebGPU AI is architecturally possible in the browser.** In a real-world production environment, police departments would deploy a much larger 8-Billion parameter model (like Llama-3) to a secure local server to get highly accurate legal summaries.

OCR and text extraction use local libraries (`pdf-parse` for PDFs, `tesseract.js` for images) — no cloud calls needed for document processing.

```bash
copy .env.example .env
npm install
npx prisma migrate dev --name phase1_init
npm run db:seed
node scripts/download-models.js
npm test
# (Optional) To enable the active malware scanning feature, start the ClamAV container:
# (Note: You must have Docker Desktop running in the background for this command to work)
# docker-compose up -d clamav
npm run dev
```

> [!WARNING]
> **Important Note for Evaluators:** During `npm install` and `prisma migrate dev`, Prisma will attempt to download its database engine binaries from its external CDN (`binaries.prisma.sh`). 
> If you are on a strict corporate network or VPN, this download may fail with a **403 Forbidden** error. If Prisma fails to initialize, the app will return a **global 500 Error** (even on the login page) due to the middleware architecture.
> **Fix:** Disconnect from your VPN/Proxy for the first run, or configure your terminal's `HTTP_PROXY` and `HTTPS_PROXY` variables.

Open http://localhost:3000

SQLite file: `prisma/dev.db`. Production path: change `DATABASE_URL` to PostgreSQL and keep the same Prisma schema.

## Demo credentials

Password for every account: `demo1234!`  
Demo MFA OTP: `000000`

> **Note:** The shared demo password, fixed OTP (`000000`), and presentation role switcher are demo conveniences gated by `.env` flags (e.g., `DEMO_OTP`, `DEMO_ROLE_SWITCH`). They must be disabled in production. e-Sign signatures in the court bundle are simulated using HS256 JWT; production requires a CCA-licensed DSC or Aadhaar eSign.

| Role | Email | Assignment |
|---|---|---|
| Investigating Officer | `io.mehra@nyayavault.demo` | WS-2026-0001 |
| SHO / Supervisor | `sho.kapoor@nyayavault.demo` | WS-2026-0001 |
| Forensic Expert | `forensic.nair@nyayavault.demo` | WS-2026-0001 |
| Prosecutor | `pp.sharma@nyayavault.demo` | WS-2026-0001 |
| Judge / Auditor | `auditor.iyer@nyayavault.demo` | WS-2026-0001 |
| System Admin | `admin@nyayavault.demo` | No case bypass; cannot open WS-2026-0001 |
| Unauthorized IO | `io.unassigned@nyayavault.demo` | CY-2026-0099 only |

Use the unassigned IO and the dashboard “Attempt restricted case” link to show **denied access + audit log**.

## Architecture (short)

- **App:** Next.js App Router (UI + route handlers)
- **DB:** Prisma + SQLite (Postgres-ready schema)
- **Auth:** HttpOnly JWT cookie (Sliding idle timeout + 8h absolute cap), demo MFA OTP, presentation role switcher (audited)
- **AuthZ:** RBAC + case assignment + 5-Tier Classification ABAC on **server** routes and server-rendered pages
- **Audit:** append-only `AuditLog` rows for login, allow, and deny
- **Adapters:** filesystem storage, hash-chain ledger, local WebGPU AI models

Details: [`Docs/ARCHITECTURE.md`](Docs/ARCHITECTURE.md)

## Features vs phase

| Capability | Status |
|---|---|
| Demo login, MFA OTP, role switcher | Implemented |
| Cases dashboard, seeded women-safety case | Implemented |
| Server ABAC + denied-access audit | Implemented |
| Upload / encrypted versions / SHA-256 | Implemented |
| Hash-chain ledger UI, integrity, custody timeline | Implemented |
| OCR, search, document viewer / review | Implemented |
| Share, watermark, redaction | Implemented |
| Local AI Assistant (100% Offline AI) | Implemented |
| BNSS Section 63 Legal Certification | Implemented |
| Court bundle export | Implemented |

## Environment variables

See `.env.example`. Copy it to `.env` before your first run. No external API keys are required for the AI features since all inference runs locally on your machine.

## Security notes

- **Dynamic UI Navigation:** The application strictly enforces Role-Based Access Control (RBAC). Users will only see navigation tabs and features in the UI that they have explicitly been granted privileges for.
- Authorization is enforced in server code, not only the UI.
- Admin cannot silently skip case ABAC or the audit trail.
- Rate limiting is an in-memory placeholder.
- TLS 1.3 applies in deployment; local demo is HTTP.
- Ledger in the database is a **tamper-evident hash chain**. It is not Hyperledger Fabric.
- Mock adapters must not be described as live government integrations.
- **CERT-In Compliance (NTP Sync):** To comply with CERT-In directions for accurate audit logging and incident reporting, the host OS running this application must be configured to synchronize its clock with the Network Time Protocol (NTP) servers of the National Informatics Centre (NIC) or National Physical Laboratory (NPL). Ensure your deployment environments are configured to sync with `samay1.nic.in`, `samay2.nic.in`, or NPL's `time.nplindia.in`.

## Known Limitations (Out of Scope for MVP)

- **Production Integration**: No live CCTNS/ICJS/e-Courts API integration; responses are strictly mocked for demo purposes.
- **Digital Signatures**: e-Sign signatures and approvals are simulated using HS256 JWTs; production requires real Class-3 DSC/eSign PKI onboarding.
- **Advanced Forensics**: No handwritten text recognition (HTR) or deepfake/advanced forgery detection (requires dedicated ML pipelines).
- **Blockchain**: Ledger is a tamper-evident hash chain stored locally; it is not a public, multi-validator production blockchain network.
- **Enterprise Operations**: Full SIEM/SOC deployment and multi-language support (beyond English + 1 Indic language) are not included in the MVP.

## License

MIT — see `LICENSE`. Demo use only; do not load real investigative or victim data.

## Product specs

Product docs remain in [`Docs/`](Docs/) (`01_PRD.md` … `08_DEMO_AND_PITCH_GUIDE.md`).# NyayaVault
