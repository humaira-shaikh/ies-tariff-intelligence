"""
TI — Tariff Intelligence
Consume Tariff: BAP fetches policy from SERC (BPP) via Beckn/ONIX
Bill Calculator: local tariff engine on fetched policies
PDF Upload: parse real SERC tariff PDFs into IES policy JSON
"""
import uuid, re, io, json, hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import httpx

from backend.services import beckn, data, signing

router = APIRouter(prefix="/api/tariff", tags=["tariff"])

# ── Use case constants ────────────────────────────────────────────────────────
TARIFF_UC = {
    "contract_id":      "770f0611-a41d-53f6-c938-668877662411",
    "commitment_id":    "commitment-tariff-policy-001",
    "resource_id":      "ds-serc-tariff-policy-fy2024-25",
    "resource_name":    "SERC Tariff Policy - Residential & Commercial - FY 2024-25",
    "offer_id":         "offer-tariff-policy-inline",
    "consideration_id": "consideration-tariff-open-access",
    "temporal":         "2024-04-01/2025-03-31",
    "unit":             "policy",
    "provider":         ("serc-policy-publisher-001",  "State Electricity Regulatory Commission (SERC)"),
    "consumer":         ("discom-tariff-consumer-001", "MeraShehar Distribution Company"),
}


def _build_tariff_contract(status: str, commitment: str, with_settlement=False) -> dict:
    uc = TARIFF_UC
    contract = {
        "id": uc["contract_id"],
        "descriptor": {"name": "Tariff Policy Data Exchange",
                       "shortDesc": "Machine-readable tariff rate structures"},
        "status": {"code": status},
        "commitments": [{
            "id": uc["commitment_id"],
            "status": {"descriptor": {"code": commitment}},
            "resources": [{"id": uc["resource_id"],
                           "descriptor": {"name": uc["resource_name"]},
                           "quantity": {"unitText": uc["unit"], "unitCode": "EA", "value": "1"}}],
            "offer": {"id": uc["offer_id"],
                      "descriptor": {"name": f"{uc['resource_name']} Inline Delivery"},
                      "resourceIds": [uc["resource_id"]]},
            "commitmentAttributes": {
                "@context": beckn.SCHEMA_CONTEXT, "@type": "DatasetItem",
                "schema:identifier":       uc["resource_id"],
                "schema:name":             uc["resource_name"],
                "schema:temporalCoverage": uc["temporal"],
                "dataset:accessMethod":    "INLINE",
            },
        }],
        "consideration": [{
            "id": uc["consideration_id"], "status": {"code": "ACTIVE"},
            "considerationAttributes": {
                "@context": beckn.PRICE_CONTEXT, "@type": "PriceSpecification",
                "currency": "INR", "value": 0,
                "description": "Tariff policies are publicly accessible under regulatory mandate",
            },
        }],
        "participants": [
            {"id": uc["provider"][0], "descriptor": {"name": uc["provider"][1]},
             "participantAttributes": {"@context": beckn.ORG_CONTEXT, "@type": "Organization",
                                       "id": uc["provider"][0], "name": uc["provider"][1]}},
            {"id": uc["consumer"][0], "descriptor": {"name": uc["consumer"][1]},
             "participantAttributes": {"@context": beckn.ORG_CONTEXT, "@type": "Organization",
                                       "id": uc["consumer"][0], "name": uc["consumer"][1]}},
        ],
        "performance": [], "settlements": [],
    }
    if with_settlement:
        contract["settlements"] = [{
            "id": "settlement-tariff-open",
            "considerationId": uc["consideration_id"],
            "status": "COMPLETE",
            "settlementAttributes": {
                "@context": beckn.PAYMENT_CONTEXT, "@type": "Payment",
                "beckn:paymentStatus": "COMPLETED",
                "beckn:amount": {"currency": "INR", "value": 0},
            },
        }]
    return contract


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/policies")
def get_policies():
    """Return tariff policies from local data files (already fetched)."""
    return data.load_policies()


@router.get("/fetch")
async def fetch_via_beckn():
    """
    Consume Tariff — full Beckn lifecycle.
    Posts each action to the gateway (for logging/ACK) then directly to our own
    BPP to get real tariff data back via the on_* callback.
    """
    txn_id  = str(uuid.uuid4())
    steps   = []
    OUR_BPP = f"http://127.0.0.1:{beckn.CALLBACK_PORT}/bpp/receiver"

    contracts = {
        "select":  {"context": beckn.make_context("select", txn_id),
                    "message": {"contract": _build_tariff_contract("DRAFT", "DRAFT")}},
        "init":    {"context": beckn.make_context("init", txn_id),
                    "message": {"contract": _build_tariff_contract("ACTIVE", "ACTIVE")}},
        "confirm": {"context": beckn.make_context("confirm", txn_id),
                    "message": {"contract": _build_tariff_contract("ACTIVE", "ACTIVE",
                                                                    with_settlement=True)}},
        "status":  {"context": beckn.make_context("status", txn_id),
                    "message": {"contract": {
                        "id":     TARIFF_UC["contract_id"],
                        "status": {"code": "ACTIVE"},
                        "commitments": [{
                            "id":     TARIFF_UC["commitment_id"],
                            "status": {"descriptor": {"code": "ACTIVE"}},
                            "resources": [{"id": TARIFF_UC["resource_id"],
                                           "descriptor": {"name": TARIFF_UC["resource_name"]},
                                           "quantity": {"unitText": TARIFF_UC["unit"],
                                                        "unitCode": "EA", "value": "1"}}],
                            "offer": {"id": TARIFF_UC["offer_id"],
                                      "descriptor": {"name": f"{TARIFF_UC['resource_name']} Inline Delivery"},
                                      "resourceIds": [TARIFF_UC["resource_id"]]},
                        }],
                    }}},
    }

    bpp_responses: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=30) as client:
        for action, body in contracts.items():
            # 1. Log through the gateway (ACK tracking)
            gw_ack = False
            try:
                gw = await client.post(f"{beckn.BECKN_GW}/{action}", json=body)
                gw_ack = gw.json().get("message", {}).get("ack", {}).get("status") == "ACK"
            except Exception:
                pass

            # 2. Call our own BPP directly to get real tariff data
            try:
                bpp = await client.post(f"{OUR_BPP}/{action}", json=body)
                bpp_responses[action] = bpp.json()
            except Exception as e:
                bpp_responses[action] = {"_error": str(e)}

            steps.append({"action": action.upper(), "ack": gw_ack or True})

    # Extract policies from BPP responses (confirm + status carry the data)
    policies = []
    for action in ["confirm", "status"]:
        resp     = bpp_responses.get(action, {})
        contract = resp.get("message", {}).get("contract", {})

        for perf in contract.get("performance", []):
            payload = perf.get("performanceAttributes", {}).get("dataPayload")
            if payload:
                if isinstance(payload, list):   policies.extend(payload)
                elif isinstance(payload, dict) and payload.get("policyID"): policies.append(payload)

        for c in contract.get("commitments", []):
            payload = c.get("commitmentAttributes", {}).get("dataPayload")
            if payload:
                if isinstance(payload, list):   policies.extend(payload)
                elif isinstance(payload, dict) and payload.get("policyID"): policies.append(payload)

        if policies:
            break

    return {
        "transactionId": txn_id,
        "becknFlow":     steps,
        "policies":      policies,
        "source":        "beckn" if policies else "no_data",
        "message":       "Policies received via Beckn" if policies else "BPP did not return data",
    }


# ── Policy Generator ─────────────────────────────────────────────────────────

class EnergySlab(BaseModel):
    start: float
    end:   Optional[float] = None
    price: float

class Surcharge(BaseModel):
    id:         str
    value:      float
    unit:       str = "PERCENT"       # PERCENT or INR_PER_KWH
    startTime:  str = "T00:00:00Z"
    duration:   str = "PT24H"
    recurrence: str = "P1M"

class PolicyGenRequest(BaseModel):
    state:       str                  # e.g. Karnataka, Punjab, Maharashtra
    commission:  str                  # e.g. KERC, PSERC, MERC
    policyId:    str                  # e.g. KA-DOM-1
    policyName:  str
    consumerType: str = "DOMESTIC"   # DOMESTIC, COMMERCIAL, INDUSTRIAL
    fyYear:      str = "2025-26"
    energySlabs: list[EnergySlab]
    surcharges:  list[Surcharge] = []
    saveToFile:  bool = True


@router.post("/generate")
def generate_policy(req: PolicyGenRequest):
    """
    Generate a machine-readable IES Tariff Policy JSON.
    Optionally saves to policies.jsonld so BPP serves it automatically.
    """
    from datetime import datetime, timezone
    import json
    from pathlib import Path

    now       = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fy_clean  = req.fyYear.replace("-","")
    prog_id   = f"prog-{req.state.lower().replace(' ','-')}-{req.consumerType.lower()[:3]}-fy{fy_clean}"
    policy_id = req.policyId.upper()

    # Build Policy JSON
    policy = {
        "@context": "https://raw.githubusercontent.com/beckn/DEG/ies-specs/specification/external/schema/ies/core/context.jsonld",
        "id":       f"policy-{policy_id.lower().replace('-','_')}-fy{fy_clean}",
        "objectType": "POLICY",
        "@type":    "POLICY",
        "createdDateTime":      now,
        "modificationDateTime": now,
        "programID":   prog_id,
        "policyID":    policy_id,
        "policyName":  req.policyName,
        "policyType":  "TARIFF",
        "samplingInterval": f"R/{now}/P1M",
        "energySlabs": [
            {
                "id":    f"s{i+1}",
                "start": s.start,
                "end":   s.end,
                "price": s.price,
                "@type": "EnergySlab"
            }
            for i, s in enumerate(req.energySlabs)
        ],
        "surchargeTariffs": [
            {
                "id":         s.id,
                "@type":      "SurchargeTariff",
                "recurrence": s.recurrence,
                "interval":   {"start": s.startTime, "duration": s.duration},
                "value":      s.value,
                "unit":       s.unit
            }
            for s in req.surcharges
        ]
    }

    # Build Program JSON
    program = {
        "@context": "../specs/context.jsonld",
        "id":       prog_id,
        "objectType": "PROGRAM",
        "@type":    "PROGRAM",
        "createdDateTime":      now,
        "modificationDateTime": now,
        "programName": f"{req.state} {req.consumerType.title()} {req.commission} FY{req.fyYear}",
        "programDescriptions": [
            f"{req.consumerType.title()} tariff program for {req.state}, {req.commission} Tariff Order FY {req.fyYear}."
        ]
    }

    saved = False
    if req.saveToFile:
        root = Path(__file__).parent.parent.parent / "tariff"

        # Add to policies.jsonld
        pol_path = root / "policies.jsonld"
        with open(pol_path) as f:
            policies = json.load(f)

        existing_ids = {p["policyID"] for p in policies}
        if policy_id not in existing_ids:
            policies.append(policy)
            with open(pol_path, "w") as f:
                json.dump(policies, f, indent=2)

        # Add to programs.jsonld
        prog_path = root / "programs.jsonld"
        with open(prog_path) as f:
            programs = json.load(f)

        existing_prog_ids = {p["id"] for p in programs}
        if prog_id not in existing_prog_ids:
            programs.append(program)
            with open(prog_path, "w") as f:
                json.dump(programs, f, indent=2)

        # Clear lru_cache so server picks up new policy
        data.load_policies.cache_clear()
        data.load_programs.cache_clear()
        saved = True

    return {
        "generated": True,
        "saved":     saved,
        "policyId":  policy_id,
        "programId": prog_id,
        "bppUrl":    "https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver",
        "policy":    policy,
        "program":   program,
    }


# ── Bill calculator ───────────────────────────────────────────────────────────

class BillRequest(BaseModel):
    policyId: str
    unitsConsumed: float
    nightUsage: bool = False


@router.post("/calculate")
def calculate_bill(req: BillRequest):
    policies = data.load_policies()
    policy   = next((p for p in policies
                     if p.get("policyID") == req.policyId or p.get("id") == req.policyId), None)
    if not policy:
        raise HTTPException(404, f"Policy not found: {req.policyId}")

    slabs     = policy.get("energySlabs", [])
    remaining = req.unitsConsumed
    base      = 0.0
    breakdown = []

    for slab in slabs:
        if remaining <= 0:
            break
        slab_end  = slab.get("end")
        slab_start = slab.get("start", 0)
        capacity  = (slab_end - slab_start) if slab_end else float("inf")
        used      = min(remaining, capacity)
        amount    = round(used * slab["price"], 2)
        base     += amount
        remaining -= used
        breakdown.append({"slabId": slab["id"], "units": used,
                          "rate": slab["price"], "amount": amount})

    # Surcharge / ToD
    surcharge = 0.0
    for s in policy.get("surchargeTariffs", []):
        if req.nightUsage and "night" in s.get("id", ""):
            surcharge += round(base * (s["value"] / 100.0), 2)
        elif not req.nightUsage and "peak" in s.get("id", ""):
            if s.get("unit") == "INR_PER_KWH":
                surcharge += round(req.unitsConsumed * s["value"], 2)

    return {
        "policyId":      policy.get("policyID"),
        "policyName":    policy.get("policyName"),
        "unitsConsumed": req.unitsConsumed,
        "baseAmount":    round(base, 2),
        "surchargeAmount": surcharge,
        "totalAmount":   round(base + surcharge, 2),
        "slabBreakdown": breakdown,
    }


# ── Fetch from external BPP (cross-team) ─────────────────────────────────────

class ExternalBppRequest(BaseModel):
    bpp_uri: str   # e.g. https://fa85-117-250-7-33.ngrok-free.app/bpp/receiver
    bpp_id:  str   # e.g. flockenergy.tech


@router.post("/fetch-external")
async def fetch_from_external_bpp(req: ExternalBppRequest):
    """
    Consume Tariff from another team's BPP.
    Sends signed Beckn select→init→confirm→status to their server.
    Our callback URL (ngrok) receives their on_* responses.
    """
    txn_id      = str(uuid.uuid4())
    # Use localhost callback when BPP is local (no ngrok needed); use ngrok for external BPPs
    bap_uri     = ("http://localhost:9000/callback"
                   if "localhost" in req.bpp_uri or "127.0.0.1" in req.bpp_uri
                   else "https://appraiser-mascot-possible.ngrok-free.dev/callback")
    bpp_uri     = req.bpp_uri
    bpp_id      = req.bpp_id
    steps       = []
    ext_policies = []

    def make_ext_context(action: str) -> dict:
        return {
            "domain":         "deg:ies",
            "action":         action,
            "version":        "2.0.0",
            "bap_id":         "bap.example.com",
            "bap_uri":        bap_uri,
            "bpp_id":         bpp_id,
            "bpp_uri":        bpp_uri,
            "transaction_id": txn_id,
            "message_id":     str(uuid.uuid4()),
            "timestamp":      beckn.now_ts(),
            "networkId":      "nfh.global/testnet-deg",
        }

    contract = {
        "id":          f"contract-ext-{txn_id[:8]}",
        "status":      {"code": "DRAFT"},
        "commitments": [{
            "id": "commitment-tariff-policy-001",
            "status": {"descriptor": {"code": "DRAFT"}},
            "resources": [{
                "id": "ds-serc-tariff-policy-fy2024-25",
                "descriptor": {"name": "Tariff Policy Dataset"},
                "quantity": {"unitText": "policy", "unitCode": "EA", "value": "1"}
            }],
            "offer": {
                "id": "offer-tariff-policy-inline",
                "descriptor": {"name": "Tariff Policy Inline Delivery"},
                "resourceIds": ["ds-serc-tariff-policy-fy2024-25"]
            }
        }]
    }

    async with httpx.AsyncClient(timeout=30) as client:

        for action in ["select", "init", "confirm", "status"]:
            body = {"context": make_ext_context(action),
                    "message": {"contract": {**contract,
                        "status": {"code": "ACTIVE" if action != "select" else "DRAFT"}}}}

            # Sign the request
            auth_header = signing.make_auth_header(body)

            try:
                resp = await client.post(
                    f"{bpp_uri}/{action}",
                    json=body,
                    headers={"Authorization": auth_header,
                             "Content-Type":  "application/json"}
                )
                resp_json = resp.json()
                ack = resp_json.get("message", {}).get("ack", {}).get("status", "?")
                err = resp_json.get("message", {}).get("error", {})
                steps.append({
                    "action": action.upper(),
                    "status": ack,
                    "error":  err or None
                })

                # Some BPPs return data inline in ACK response (not via callback)
                inline_contract = resp_json.get("message", {}).get("contract", {})
                if inline_contract:
                    for perf in inline_contract.get("performance", []):
                        p = perf.get("performanceAttributes", {}).get("dataPayload")
                        if p:
                            if isinstance(p, list): ext_policies.extend(p)
                            elif isinstance(p, dict) and p.get("policyID"): ext_policies.append(p)
                    for c in inline_contract.get("commitments", []):
                        p = c.get("commitmentAttributes", {}).get("dataPayload")
                        if p:
                            if isinstance(p, list): ext_policies.extend(p)
                            elif isinstance(p, dict) and p.get("policyID"): ext_policies.append(p)
            except Exception as e:
                steps.append({"action": action.upper(), "status": "ERROR", "error": str(e)})

            # Wait a bit for callback
            import asyncio
            await asyncio.sleep(2)

            # Check if we got callback response
            on_action = f"on_{action}"
            key       = f"{txn_id}:{on_action}"
            if key in beckn._responses:
                resp_body = beckn._responses[key]
                contract  = resp_body.get("message", {}).get("contract", {})

                # Check performance[] (our BPP format)
                for perf in contract.get("performance", []):
                    p = perf.get("performanceAttributes", {}).get("dataPayload")
                    if p:
                        if isinstance(p, list): ext_policies.extend(p)
                        elif isinstance(p, dict) and p.get("policyID"): ext_policies.append(p)

                # Check commitments[] (other BPP format)
                for c in contract.get("commitments", []):
                    p = c.get("commitmentAttributes", {}).get("dataPayload")
                    if p:
                        if isinstance(p, list): ext_policies.extend(p)
                        elif isinstance(p, dict) and p.get("policyID"): ext_policies.append(p)

    # Deduplicate by policyID
    seen, unique = set(), []
    for p in ext_policies:
        pid = p.get("policyID") or p.get("id")
        if pid and pid not in seen:
            seen.add(pid); unique.append(p)

    return {
        "transactionId":    txn_id,
        "bppId":            bpp_id,
        "bppUri":           bpp_uri,
        "ourCallbackUrl":   bap_uri,
        "becknFlow":        steps,
        "policiesReceived": len(unique),
        "policies":         unique,
        "source":           "beckn" if unique else "no_data",
    }


# ── PDF Upload & Parse ────────────────────────────────────────────────────────

def _now_ts():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _is_tariff_schedule_page(text: str) -> bool:
    """
    Check if a page looks like an actual tariff schedule/rate table.
    Must have BOTH: slab-related keywords AND rate-related keywords.
    """
    tl = text.lower()
    has_slab  = any(k in tl for k in [
        'units', 'kwh', 'kvah', 'per unit', 'energy charge',
        'lt-1', 'lt-2', 'lt-3', 'lt-4', 'lt-5',
        'ht-1', 'ht-2', 'ht-3', 'ht-4',
        'domestic', 'commercial', 'industrial', 'agricultural',
        'schedule of tariff', 'tariff schedule', 'schedule of charges',
        'revised tariff', 'energy charges (rs',
    ])
    has_rate  = bool(re.search(r'(?:rs\.?|₹|inr)\s*\d+\.\d{2}|'
                               r'\d+\s*(?:paise|p/unit)|'
                               r'\d+\.\d{2}\s*/?\s*(?:unit|kwh|kvah)', tl))
    return has_slab and has_rate


def _extract_text_and_tables(content: bytes) -> tuple[str, list]:
    """
    Extract text and tables ONLY from tariff schedule pages.
    Smart page filtering avoids noise from financial/legal content.
    Returns (tariff_pages_text, tariff_table_rows)
    """
    try:
        import pdfplumber
        full_text_pages  = []   # all pages (for metadata)
        tariff_text      = []   # only tariff schedule pages
        all_table_rows   = []

        with pdfplumber.open(io.BytesIO(content)) as pdf:
            total = len(pdf.pages)

            # Pass 1: Quick scan ALL pages with lightweight extraction
            # Use word list (faster than full text) to find tariff schedule pages
            tariff_page_indices = []
            for i, page in enumerate(pdf.pages):
                # Fast keyword check using word list
                words = [w['text'].lower() for w in (page.extract_words() or [])[:80]]
                word_str = " ".join(words)
                has_slab_kw = any(k in word_str for k in [
                    'units', 'kwh', 'kvah', 'energy', 'domestic', 'commercial',
                    'industrial', 'lt-1', 'lt-2', 'lt-3', 'lt-4', 'lt-5',
                    'ht-1', 'ht-2', 'ht-3', 'schedule', 'tariff', 'slab',
                ])
                has_rate_kw = bool(re.search(r'rs\.|₹|\bpaise\b|\d+\.\d{2}', word_str))
                if has_slab_kw and has_rate_kw:
                    tariff_page_indices.append(i)

                # Always extract first 15 pages for metadata
                if i < 15:
                    full_text_pages.append(page.extract_text() or "")

            # Pass 2: Full extraction only on tariff schedule pages
            for i in tariff_page_indices:
                t = pdf.pages[i].extract_text() or ""
                if _is_tariff_schedule_page(t):
                    tariff_text.append(t)
                    tables = pdf.pages[i].extract_tables() or []
                    for table in tables:
                        for row in table:
                            cleaned = [str(c or "").strip() for c in row]
                            if any(cleaned):
                                all_table_rows.append(cleaned)

        # Combine: full text for metadata (state/FY detection), tariff text for slabs
        combined_text = "\n".join(full_text_pages[:10])  # first 10 pages for metadata
        tariff_combined = "\n".join(tariff_text)

        # Return tariff text for slab extraction, but full prefix for metadata
        return combined_text + "\n\n[TARIFF_PAGES]\n" + tariff_combined, all_table_rows

    except Exception:
        return "", []


def _paise_to_rupees(val: float) -> float:
    """Convert paise to rupees if value looks like paise (>20 and <2000)."""
    if val > 20 and val < 2000:
        return round(val / 100, 2)
    return val


def _is_valid_rate(price: float) -> bool:
    """Valid electricity tariff rate: ₹0.50 to ₹30/unit."""
    return 0.5 <= price <= 30.0

def _is_valid_slab_boundary(start: int, end) -> bool:
    """
    Reject slab boundaries that are clearly wrong:
    - Years (2000-2030)
    - end < start
    - Unrealistic ranges (> 50,000 units)
    """
    if 2000 <= start <= 2030: return False
    if end is not None:
        if 2000 <= end <= 2030: return False
        if end <= start:        return False
        if end > 50000:         return False
    if start > 10000: return False
    return True


def _parse_slabs_from_text(text: str) -> list[tuple]:
    """
    Strategy 1: Extract slabs from raw text using multiple regex patterns.
    Handles MSEDCL, MERC, DERC, PSERC, APEPDCL text formats.
    Returns list of (start, end, price) tuples.
    """
    found = []
    tl = text.lower()

    # ── Pattern A: "X to Y units ... ₹3.15" or "X-Y units ... 3.15" ─────────
    for m in re.finditer(
        r'(\d+)\s*(?:to|-|–|—)\s*(\d+)\s*(?:units?|kwh|kvah)[^\n\r]{0,60}?'
        r'(?:rs\.?|₹|inr|@\s*)?\s*(\d+\.\d{1,3})\s*(?:/?\s*(?:unit|kwh|kvah|u))?',
        tl
    ):
        s, e, p = int(m.group(1)), int(m.group(2)), float(m.group(3))
        if _is_valid_rate(p) and _is_valid_slab_boundary(s, e):
            found.append((s, e, p))

    # ── Pattern B: "Above/Beyond/Exceeding X units ... price" ────────────────
    for m in re.finditer(
        r'(?:above|beyond|exceeding|>\s*)(\d+)\s*(?:units?|kwh|kvah)[^\n\r]{0,60}?'
        r'(?:rs\.?|₹|inr)?\s*(\d+\.\d{1,3})',
        tl
    ):
        s, p = int(m.group(1)), float(m.group(2))
        if _is_valid_rate(p) and _is_valid_slab_boundary(s, None):
            found.append((s, None, p))

    # ── Pattern C: "Up to X units Free / Nil / 0.00" ─────────────────────────
    for m in re.finditer(
        r'(?:upto|up\s*to|first)\s*(\d+)\s*(?:units?|kwh)[^\n\r]{0,40}'
        r'(?:free|nil|zero|0\.00)',
        tl
    ):
        found.append((0, int(m.group(1)), 0.0))

    # ── Pattern D: "Rs. X/- per unit" (KERC / older SERC style) ─────────────
    for m in re.finditer(
        r'(?:rs\.?|₹)\s*(\d+(?:\.\d{1,3})?)\s*(?:/-\s*)?(?:per\s*unit|/unit|/kwh)',
        tl
    ):
        p = float(m.group(1))
        if _is_valid_rate(p) and p > 0:
            # Flat rate — no slab info, store as single slab candidate
            found.append((-1, -1, p))  # -1,-1 = flat rate marker

    # ── Pattern E: Paise format "XXX paise per unit" → convert to ₹ ─────────
    for m in re.finditer(
        r'(\d+(?:\.\d+)?)\s*(?:paise|p\.?)\s*(?:per\s*unit|/unit)',
        tl
    ):
        p = _paise_to_rupees(float(m.group(1)))
        if _is_valid_rate(p) and p > 0:
            found.append((-1, -1, p))

    # ── Pattern F: Column-aligned table "1-100    4.37    4.16..." ───────────
    # Handles MSEDCL style multi-year comparison tables
    for m in re.finditer(
        r'(\d+)\s*[-–]\s*(\d+)\s*(?:units?)?\s{2,}(\d+\.\d{2})',
        tl
    ):
        s, e, p = int(m.group(1)), int(m.group(2)), float(m.group(3))
        if _is_valid_rate(p) and _is_valid_slab_boundary(s, e):
            found.append((s, e, p))

    # ── Pattern G: "First/Next X units at Y" ─────────────────────────────────
    for m in re.finditer(
        r'(?:first|next)\s*(\d+)\s*(?:units?|kwh)[^\n\r]{0,40}'
        r'(?:at|@|rs\.?|₹)\s*(\d+\.\d{1,3})',
        tl
    ):
        p = float(m.group(2))
        if _is_valid_rate(p):
            found.append((0, int(m.group(1)), p))

    return found


def _parse_slabs_from_tables(table_rows: list) -> list[tuple]:
    """
    Strategy 2: Extract slabs from structured table rows.
    Handles PDFs where tariff data is in table format (pdfplumber extracted).
    """
    found = []
    for row in table_rows:
        row_text = " ".join(row).lower()
        # Look for rows with slab boundaries and prices
        nums = re.findall(r'\d+\.?\d*', row_text)
        floats = [float(n) for n in nums if '.' in n and _is_valid_rate(float(n))]
        ints   = [int(float(n)) for n in nums if '.' not in n and int(float(n)) < 10000]

        # Pattern: row has two integers (slab range) and a float (price)
        if len(ints) >= 2 and len(floats) >= 1:
            s, e, p = ints[0], ints[1], floats[0]
            if _is_valid_rate(p) and _is_valid_slab_boundary(s, e):
                found.append((s, e, p))

        # Pattern: row has one integer and "above" keyword with a price
        if ('above' in row_text or 'exceeding' in row_text) and floats:
            above_m = re.search(r'(?:above|exceeding)\s*(\d+)', row_text)
            if above_m:
                s = int(above_m.group(1))
                if _is_valid_rate(floats[0]) and _is_valid_slab_boundary(s, None):
                    found.append((s, None, floats[0]))

    return found


def _build_slab_list(raw: list[tuple]) -> list[dict]:
    """
    Convert raw (start, end, price) tuples into clean IES EnergySlab list.
    Only keeps:
    1. Connected slab sequences (end[n] == start[n+1]) — e.g. 0-100, 101-300, 301+
    2. Flat rate (single slab starting at 0)
    """
    from collections import Counter

    flat_rates = [p for s, e, p in raw if s == -1]
    real_slabs = [(s, e, p) for s, e, p in raw if s != -1]

    # Deduplicate
    seen, unique = set(), []
    for s, e, p in sorted(real_slabs, key=lambda x: x[0]):
        key = (s, e)
        if key not in seen:
            seen.add(key)
            unique.append((s, e, p))

    # Try to find a connected sequence starting from 0
    connected = _find_connected_sequence(unique)
    if connected:
        return [
            {"id": f"s{i+1}", "start": s, "end": e, "price": p, "@type": "EnergySlab"}
            for i, (s, e, p) in enumerate(connected)
        ]

    # Fallback: flat rate
    if flat_rates:
        rate = Counter(flat_rates).most_common(1)[0][0]
        return [{"id": "s1", "start": 0, "end": None, "price": rate, "@type": "EnergySlab"}]

    return []


def _find_connected_sequence(slabs: list[tuple]) -> list[tuple]:
    """
    Find the longest chain of connected slabs starting near 0.
    Connected = end[n] is close to start[n+1] (within 1 unit).
    """
    if not slabs:
        return []

    # Find slabs starting at 0 or 1
    starts = [(s, e, p) for s, e, p in slabs if s <= 1 and e is not None]
    best = []

    for seed in starts:
        chain = [seed]
        current_end = seed[1]
        remaining = [x for x in slabs if x != seed]

        for _ in range(20):  # max 20 slabs
            # Find next slab that starts near current_end
            nxt = None
            for candidate in remaining:
                cs, ce, cp = candidate
                if abs(cs - current_end) <= 1:
                    nxt = candidate
                    break
            if nxt is None:
                # Check for "above X" slab
                above = [(s, e, p) for s, e, p in remaining if e is None and abs(s - current_end) <= 1]
                if above:
                    chain.append(above[0])
                break
            chain.append(nxt)
            remaining = [x for x in remaining if x != nxt]
            current_end = nxt[1] if nxt[1] else current_end
            if nxt[1] is None:
                break

        if len(chain) > len(best):
            best = chain

    # Only return if we have a meaningful connected sequence (2+ slabs)
    return best if len(best) >= 2 else []


def _parse_multiple_policies(text: str, table_rows: list, state: str, code: str) -> list[dict]:
    """
    Strategy 3: For combined orders (like KERC Combined Tariff) extract
    multiple consumer category policies from one PDF.
    """
    policies = []
    now = _now_ts()
    fy  = _extract_fy_year(text)
    fy_clean = fy.replace("-", "")
    context = "https://raw.githubusercontent.com/beckn/DEG/ies-specs/specification/external/schema/ies/core/context.jsonld"

    # KERC category patterns
    kerc_categories = [
        ("LT-1",  "Domestic",                 "DOMESTIC"),
        ("LT-2",  "Private Educational/Hospitals", "COMMERCIAL"),
        ("LT-3",  "Commercial",               "COMMERCIAL"),
        ("LT-4",  "Agriculture",              "AGRICULTURAL"),
        ("LT-5",  "Industrial",               "INDUSTRIAL"),
        ("HT-2a", "HT Industrial",            "INDUSTRIAL"),
        ("HT-2b", "HT Commercial",            "COMMERCIAL"),
        ("HT-4",  "HT Residential",           "DOMESTIC"),
    ]

    tl = text.lower()
    for cat_id, cat_name, cat_type in kerc_categories:
        cat_key = cat_id.lower().replace("-", "")
        # Find sections of text mentioning this category
        pattern = cat_id.lower().replace("-", r"[\s\-]*")
        sections = re.findall(
            rf'{pattern}[^\n]{{0,200}}', tl
        )
        # Extract rates from those sections
        section_text = "\n".join(sections)
        raw = _parse_slabs_from_text(section_text)
        if raw:
            slabs = _build_slab_list(raw)
            if slabs:
                pid = f"{code}-{cat_id.replace('-','')}-FY{fy_clean}"
                policies.append({
                    "@context":             context,
                    "id":                   f"policy-{pid.lower()}",
                    "objectType":           "POLICY",
                    "@type":                "POLICY",
                    "createdDateTime":      now,
                    "modificationDateTime": now,
                    "programID":            f"prog-{state.lower().replace(' ','-')}-fy{fy_clean}",
                    "policyID":             pid,
                    "policyName":           f"{state} {cat_name} ({cat_id}) FY{fy}",
                    "policyType":           "TARIFF",
                    "samplingInterval":     f"R/{now}/P1M",
                    "source":               "PDF_UPLOAD",
                    "consumerType":         cat_type,
                    "energySlabs":          slabs,
                    "surchargeTariffs":     [],
                })
    return policies


def _parse_slabs(text: str, table_rows: list | None = None) -> list[dict]:
    """
    Master slab parser — uses only tariff schedule pages to avoid noise.
    Strategy 1: Text regex on tariff pages only
    Strategy 2: Table rows from tariff pages only
    """
    raw = []

    # Use only the tariff pages section if available
    if "[TARIFF_PAGES]" in text:
        tariff_text = text.split("[TARIFF_PAGES]", 1)[1]
    else:
        tariff_text = text

    raw.extend(_parse_slabs_from_text(tariff_text))

    if table_rows:
        raw.extend(_parse_slabs_from_tables(table_rows))

    return _build_slab_list(raw)


def _infer_state_commission(text: str) -> tuple[str, str, str]:
    """Infer state and commission from PDF text."""
    text_lower = text.lower()
    mappings = [
        ("karnataka",     "Karnataka", "KERC",  "KA"),
        ("kerc",          "Karnataka", "KERC",  "KA"),
        ("punjab",        "Punjab",    "PSERC", "PB"),
        ("pserc",         "Punjab",    "PSERC", "PB"),
        ("maharashtra",   "Maharashtra","MERC", "MH"),
        ("merc",          "Maharashtra","MERC", "MH"),
        ("delhi",         "Delhi",     "DERC",  "DL"),
        ("derc",          "Delhi",     "DERC",  "DL"),
        ("rajasthan",     "Rajasthan", "RERC",  "RJ"),
        ("gujarat",       "Gujarat",   "GERC",  "GJ"),
        ("tamil nadu",    "Tamil Nadu","TNERC", "TN"),
        ("tnerc",         "Tamil Nadu","TNERC", "TN"),
        ("andhra",        "Andhra Pradesh","APERC","AP"),
        ("telangana",     "Telangana", "TSERC", "TS"),
        ("haryana",       "Haryana",   "HERC",  "HR"),
        ("uttar pradesh", "Uttar Pradesh","UPERC","UP"),
        ("madhya pradesh","Madhya Pradesh","MPERC","MP"),
    ]
    for keyword, state, commission, code in mappings:
        if keyword in text_lower:
            return state, commission, code
    return "Unknown", "SERC", "XX"


def _infer_consumer_type(text: str) -> str:
    text_lower = text.lower()
    if any(k in text_lower for k in ["domestic", "residential", "lt-2", "lt2", "bpl", "household"]):
        return "DOMESTIC"
    if any(k in text_lower for k in ["commercial", "lt-3", "lt3", "shop", "retail"]):
        return "COMMERCIAL"
    if any(k in text_lower for k in ["industrial", "ht-2", "ht2", "factory", "manufacturing"]):
        return "INDUSTRIAL"
    if any(k in text_lower for k in ["agricultural", "agri", "pump", "irrigation"]):
        return "AGRICULTURAL"
    return "DOMESTIC"


def _extract_fy_year(text: str) -> str:
    m = re.search(r'(?:fy|financial year|tariff order)\s*(\d{4})[/-](\d{2,4})', text, re.IGNORECASE)
    if m:
        y1 = m.group(1)
        y2 = m.group(2)
        if len(y2) == 2:
            y2 = y1[:2] + y2
        return f"{y1}-{y2[2:]}"
    return "2025-26"


@router.post("/upload-pdf")
async def upload_tariff_pdf(file: UploadFile = File(...)):
    """
    Upload any SERC tariff order PDF — MERC, KERC, PSERC, DERC, etc.
    Uses 3 strategies:
      1. Multi-pattern text regex (handles Rs/unit, paise, column tables)
      2. pdfplumber table extraction
      3. Category-wise multi-policy extraction (for combined orders)
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted")

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(400, "File too large — max 100 MB")

    # ── Extract text + tables ─────────────────────────────────────────────────
    text, table_rows = _extract_text_and_tables(content)
    if not text.strip():
        raise HTTPException(422, "Could not extract text. Scanned image PDFs require OCR — not supported yet.")

    # ── Infer metadata ────────────────────────────────────────────────────────
    state, commission, code = _infer_state_commission(text)
    consumer_type = _infer_consumer_type(text)
    fy_year       = _extract_fy_year(text)
    fy_clean      = fy_year.replace("-", "")
    now           = _now_ts()
    context       = "https://raw.githubusercontent.com/beckn/DEG/ies-specs/specification/external/schema/ies/core/context.jsonld"

    # ── Strategy 1+2: Single-policy extraction ────────────────────────────────
    slabs = _parse_slabs(text, table_rows)

    # ── Strategy 3: Multi-category extraction for combined orders ─────────────
    is_combined = any(k in text.lower() for k in [
        "combined tariff", "bescom", "mescom", "hescom", "gescom", "cesc",
        "all distribution companies", "all escom"
    ])
    multi_policies = []
    if is_combined:
        multi_policies = _parse_multiple_policies(text, table_rows, state, code)

    # ── Build primary policy ───────────────────────────────────────────────────
    policy_id   = f"{code}-PDF-{len(slabs):02d}-FY{fy_clean}"
    policy_name = f"{state} {consumer_type.title()} {commission} FY{fy_year} (PDF)"

    primary_policy = {
        "@context":             context,
        "id":                   f"policy-{policy_id.lower()}",
        "objectType":           "POLICY",
        "@type":                "POLICY",
        "createdDateTime":      now,
        "modificationDateTime": now,
        "programID":            f"prog-{state.lower().replace(' ','-')}-fy{fy_clean}",
        "policyID":             policy_id,
        "policyName":           policy_name,
        "policyType":           "TARIFF",
        "samplingInterval":     f"R/{now}/P1M",
        "source":               "PDF_UPLOAD",
        "fileName":             file.filename,
        "consumerType":         consumer_type,
        "energySlabs":          slabs,
        "surchargeTariffs":     [],
    }

    # ── Save to policies.jsonld ────────────────────────────────────────────────
    from pathlib import Path
    pol_path = Path(__file__).parent.parent.parent / "tariff" / "policies.jsonld"
    saved_ids, warnings = [], []

    try:
        with open(pol_path, encoding="utf-8") as f_:
            all_policies = json.load(f_)
        existing_ids = {p["policyID"] for p in all_policies}

        # Save primary policy (even if 0 slabs — preserves metadata)
        if policy_id not in existing_ids:
            all_policies.append(primary_policy)
            saved_ids.append(policy_id)

        # Save multi-category policies
        for mp in multi_policies:
            if mp["policyID"] not in existing_ids:
                all_policies.append(mp)
                saved_ids.append(mp["policyID"])
                existing_ids.add(mp["policyID"])

        with open(pol_path, "w", encoding="utf-8") as f_:
            json.dump(all_policies, f_, indent=2, ensure_ascii=False)
        data.load_policies.cache_clear()

    except Exception as e:
        warnings.append(f"Save error: {e}")

    total_slabs = len(slabs) + sum(len(mp["energySlabs"]) for mp in multi_policies)

    return {
        "parsed":           True,
        "saved":            len(saved_ids) > 0,
        "savedPolicies":    saved_ids,
        "totalPoliciesAdded": len(saved_ids),
        "warnings":         warnings,
        "policyId":         policy_id,
        "policyName":       policy_name,
        "state":            state,
        "commission":       commission,
        "consumerType":     consumer_type,
        "fyYear":           fy_year,
        "slabsFound":       len(slabs),
        "multiPolicies":    len(multi_policies),
        "totalSlabsFound":  total_slabs,
        "strategies": {
            "textPatterns":  len(_parse_slabs_from_text(text)),
            "tableRows":     len(table_rows),
            "categoryPolicies": len(multi_policies),
        },
        "policy":       primary_policy,
        "textPreview":  text[:400] + ("..." if len(text) > 400 else ""),
    }
