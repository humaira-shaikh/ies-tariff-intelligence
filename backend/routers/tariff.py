"""
TI — Tariff Intelligence
Consume Tariff: BAP fetches policy from SERC (BPP) via Beckn/ONIX
Bill Calculator: local tariff engine on fetched policies
"""
import uuid
from fastapi import APIRouter, HTTPException
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
    Consume Tariff — full Beckn lifecycle via ONIX.
    select → init → confirm → status → receive TARIFF_INTELLIGENCE payload.
    """
    txn_id = str(uuid.uuid4())
    steps  = []

    async with httpx.AsyncClient(timeout=30) as client:
        kw = dict(client=client, txn_id=txn_id)

        on_select = await beckn.send_and_wait(
            **kw, action="select", timeout=20,
            body={"context": beckn.make_context("select", txn_id),
                  "message": {"contract": _build_tariff_contract("DRAFT", "DRAFT")}})
        steps.append({"action": "SELECT", "ack": on_select is not None})

        on_init = await beckn.send_and_wait(
            **kw, action="init", timeout=20,
            body={"context": beckn.make_context("init", txn_id),
                  "message": {"contract": _build_tariff_contract("ACTIVE", "ACTIVE")}})
        steps.append({"action": "INIT", "ack": on_init is not None})

        on_confirm = await beckn.send_and_wait(
            **kw, action="confirm", timeout=20,
            body={"context": beckn.make_context("confirm", txn_id),
                  "message": {"contract": _build_tariff_contract("ACTIVE", "ACTIVE",
                                                                  with_settlement=True)}})
        steps.append({"action": "CONFIRM", "ack": on_confirm is not None})

        on_status = await beckn.send_and_wait(
            **kw, action="status", timeout=25,
            body={"context": beckn.make_context("status", txn_id),
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
                  }}})
        steps.append({"action": "STATUS", "ack": on_status is not None})

    # Extract policies — check both on_confirm and on_status
    # Our BPP sends data in: performance[].performanceAttributes.dataPayload
    # Some BPPs send in:     commitments[].commitmentAttributes.dataPayload
    policies = []

    for response in [on_confirm, on_status]:
        if not response:
            continue
        contract = response.get("message", {}).get("contract", {})

        # Check performance (our BPP format)
        for perf in contract.get("performance", []):
            attrs   = perf.get("performanceAttributes", {})
            payload = attrs.get("dataPayload")
            if payload:
                if isinstance(payload, list):  policies.extend(payload)
                elif isinstance(payload, dict) and payload.get("policyID"): policies.append(payload)

        # Check commitments (other BPP format)
        for c in contract.get("commitments", []):
            attrs   = c.get("commitmentAttributes", {})
            payload = attrs.get("dataPayload")
            if payload:
                if isinstance(payload, list):  policies.extend(payload)
                elif isinstance(payload, dict) and payload.get("policyID"): policies.append(payload)

        if policies:
            break  # got data, stop

    return {
        "transactionId": txn_id,
        "becknFlow":     steps,
        "policies":      policies,
        "source":        "beckn" if policies else "no_data",
        "message":       "Policies received via Beckn" if policies else "BPP did not return tariff data in this session",
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
    bap_uri     = ("http://localhost:9001/callback"
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
