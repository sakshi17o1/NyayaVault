# NyayaVault architecture

Prototype for Smart India Hackathon. Complementary document-integrity layer — **not** a replacement for ICJS, CCTNS, e-Courts, e-Sakshya, e-Prosecution, or e-Forensics.

## Component diagram

```mermaid
flowchart TB
  subgraph clients [Users]
    IO[IO / SHO / Forensic]
    PP[Prosecutor]
    JA[Judge / Auditor]
    ADM[Admin]
  end

  subgraph next [Next.js App Router]
    UI[Role-aware UI]
    API[Route handlers]
    MW[Middleware: session JWT + rate-limit placeholder]
  end

  subgraph core [Server modules]
    ABAC[RBAC + case ABAC]
    AUDIT[Append-only audit]
    HASH[SHA-256 / versions]
    LEDGER[Hash-chain ledger]
    OCR[OCR Background Worker]
    AI[In-browser AI Worker]
  end

  subgraph data [Data]
    SQLITE[(SQLite via Prisma)]
    FS[Filesystem encrypted objects]
  end

  subgraph mocks [Mock adapters]
    CCTNS[CCTNS FIR]
    ICJS[ICJS case]
    EC[e-Courts ack]
    EF[e-Forensics / e-Prosecution]
    FAB[Fabric adapter stub]
  end

  IO --> UI
  PP --> UI
  JA --> UI
  ADM --> UI
  UI --> MW --> API
  API --> ABAC --> SQLITE
  API --> AUDIT --> SQLITE
  HASH --> FS
  HASH --> LEDGER --> SQLITE
  AI -.-> OCR
  API --> CCTNS
  API --> ICJS
  API --> EC
  API --> EF
  LEDGER -.-> FAB
```

## Runtime choice

A **single Next.js process** keeps `npm run dev` simple. Storage, OCR, LLM, search, and ledger are **adapter interfaces** so SQLite, MinIO, OpenSearch, Tesseract, a live model, or Fabric can be swapped later without claiming they are already live.

## Data flow (Authentication and Access)

1. User submits email/password. Failed logins are audited.
2. If `mfaEnabled`, a demo OTP (`DEMO_OTP`) is required.
3. Server sets an HttpOnly JWT cookie (`nv_session`) with `sub`, role, name, email. **Case assignments are not trusted from the client**; they are loaded from the database on each authorization check.
4. Case pages and `GET /api/cases/:id` call `authorizeCase`, which evaluates role, assignment, and classification, then writes `ACCESS_ALLOWED` or `ACCESS_DENIED`.
5. Role switcher (when `DEMO_ROLE_SWITCH=true`) issues a new session and writes `ROLE_SWITCH`.

## Data flow (Documents and AI)

Upload → ClamAV malware/MIME/size validation → encrypt to object store → immutable `DocumentVersion` → SHA-256 → hash-chain event → OCR/index (with PII redaction) → optional share/redact/certify → local AI summarization over authorized context. e-Sign signatures in the court bundle are simulated using HS256 JWT; production requires a CCA-licensed DSC or Aadhaar eSign.

## What is stored where

| Store | Contents |
|---|---|
| SQLite | Users, cases, assignments, policies, documents metadata, versions metadata, audit, ledger events |
| Object store | Encrypted file bytes |
| Hash chain | Hashes, event type, actor id, timestamps, proof id — **never** raw documents or PII |
| LLM | Full case context passed to local WebWorker model |

## Production path

SQLite + MinIO/S3 + TLS + KMS + real MFA + permissioned ledger adapter + official ICJS/CCTNS interfaces after authorization from NCRB/NIC.
