# IES Tariff Intelligence — IES Bootcamp 2026

Built during the **India Energy Stack (IES) Bootcamp** (15–17 April 2026) at REC World Headquarters, Gurugram.

---

## Use Case: Tariff Intelligence (Machine Readable Policies)

Tariff Intelligence enables automated, machine-readable access to electricity tariff policies published by State Electricity Regulatory Commissions (SERCs).

### What it does

- **Discovers** tariff policy packs from a mock Policy Registry via the Beckn/ONIX network and DeDi (Decentralised Directory)
- **Downloads & verifies** the `EffectivePolicyObject` — checking content hash integrity
- **Parses** tariff plans: energy slabs, demand charges, surcharges, ToD overlays
- **Executes** the tariff engine against meter data to compute bill breakdowns
- **Produces** an execution trace with clause-level traceability (which slab/rule was applied at each step)
- **Validates** outputs against IES-standard test vectors

### Architecture

```
Frontend (React)
    └── TIPanel / TariffPanel / PolicyDetail
          │
          ▼
Backend (FastAPI — port 9000)
    └── /api/tariff/*  ←→  Beckn BAP Adapter
                                │
                          ONIX Network
                                │
                     Mock Policy Registry (BPP)
                          (DeDi lookup → fetch catalog → download Policy Pack)

Tariff Policy Files (tariff/)
    └── JSON-LD policy packs for Karnataka, Punjab, Delhi DISCOMs
```

---

## Beckn Protocol

This project is built on the **Beckn Protocol** — an open, decentralised protocol that enables any two parties to perform trusted transactions without a central intermediary.

### Core Concepts

| Term | What it means in this project |
|---|---|
| **BAP** (Beckn Application Platform) | Our FastAPI backend — the consumer side that initiates requests to fetch tariff policies |
| **BPP** (Beckn Provider Platform) | The mock Policy Registry — the provider that serves tariff policy packs |
| **ONIX** | The Beckn network node that signs, routes, and delivers messages between BAP and BPP |
| **DeDi** | Decentralised Directory — used to discover BPP endpoints by `subscriber_id` |
| **CommonEnvelope** | Beckn's standard message wrapper with `context`, `message`, and `signature` |

### How the Tariff Intelligence flow works over Beckn

```
BAP (our backend)
  │
  ├── 1. DeDi Lookup  ──────────────────► DeDi Registry (publish.dedi.global)
  │        └── resolves subscriber_url of mock Policy Registry
  │
  ├── 2. /search  ──────────────────────► ONIX ──► BPP (mock Policy Registry)
  │        └── discovers available tariff policy catalogs
  │
  ├── 3. /on_search callback  ◄──────────  BPP returns catalog of policy packs
  │
  ├── 4. Download EffectivePolicyObject
  │        └── verify SHA-256 content hash  ✓
  │
  └── 5. Parse & Execute tariff engine locally
           └── bill breakdown + execution trace with clause traceability
```

### Beckn Message Lifecycle

Every message exchanged follows the Beckn async pattern:

```
BAP sends /search  ──►  BPP receives, processes
                   ◄──  BPP calls back /on_search to BAP's callback URL
```

All messages are **signed** by the ONIX node using the subscriber's private key registered in DeDi, ensuring end-to-end authenticity without a central authority.

### Why Beckn for Tariff Intelligence?

- **No central data broker** — SERCs publish policies directly as BPPs; anyone with a BAP can discover and fetch them
- **Signed & verifiable** — every policy pack download includes a content hash; tampering is detectable
- **Interoperable** — any Beckn-compliant client can consume IES tariff policies without custom integrations
- **Decentralised discovery** — DeDi replaces a central API registry; new SERCs can onboard by registering a namespace

---

## Project Structure

```
ies-bootcamp/
├── backend/
│   ├── main.py                  # FastAPI app entry point (port 9000)
│   ├── requirements.txt
│   ├── routers/
│   │   └── tariff.py            # TI API endpoints (search, fetch, bill calc)
│   └── services/
│       ├── beckn.py             # Beckn message builder
│       ├── discover.py          # DeDi lookup / catalog fetch
│       └── signing.py          # ONIX signing
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TIPanel.jsx      # Tariff Intelligence UI
│   │   │   └── TariffPanel.jsx  # Bill calculator UI
│   │   └── pages/
│   │       └── PolicyDetail.jsx # Policy pack detail view
│   └── package.json
└── tariff/
    ├── policy-ds-ds-1-fy202526.json   # Delhi DISCOM DS-1 tariff
    ├── policy-ds-ds-2-fy202526.json
    ├── policy-ds-ds-3-fy202526.json
    ├── policy-ka-lt2a-fy202526.json   # Karnataka LT-2A tariff
    ├── policy-ka-lt2b-fy202526.json
    ├── prog-karnataka-dom-fy202526.json
    ├── prog-punjab-ds-fy202526.json
    ├── policies.jsonld
    ├── programs.jsonld
    └── create_policy_pack.py          # Policy pack builder script
```

---

## Setup & Run

### Prerequisites

- Python 3.10+
- Node.js 18+
- Git

### 1. Clone this repo

```bash
git clone https://github.com/YOUR-USERNAME/ies-tariff-intelligence.git
cd ies-tariff-intelligence
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 9000
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`  
Backend API at: `http://localhost:9000`  
API docs at: `http://localhost:9000/docs`

---

## References

| Resource | Link |
|---|---|
| Beckn DEG Devkit | [github.com/beckn/DEG](https://github.com/beckn/DEG) |
| IES Docs & Specs | [github.com/India-Energy-Stack/ies-docs](https://github.com/India-Energy-Stack/ies-docs) |
| TI Implementation Guide | [ies-docs/implementation-guides/data_exchange](https://github.com/India-Energy-Stack/ies-docs/tree/main/implementation-guides/data_exchange) |
| DEG Data Exchange Devkit | [DEG/devkits/data-exchange](https://github.com/beckn/DEG/tree/main/devkits/data-exchange) |
| Beckn Documentation | [docs.beckn.io](https://docs.beckn.io/) |
| DeDi Registry | [publish.dedi.global](https://publish.dedi.global/) |

---

## Team

Built at the IES Bootcamp 2026 — REC Limited, Gurugram.
