"""
RDE — Regulatory Data Exchange
DISCOM (BAP) → ARR Filing → SERC (BPP) via Beckn/ONIX
"""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

from backend.services import beckn, data

router = APIRouter(prefix="/api/filing", tags=["filing"])

# ── Use case constants ────────────────────────────────────────────────────────
ARR_UC = {
    "contract_id":      "contract-arr-filing-001",
    "commitment_id":    "commitment-arr-filing-001",
    "resource_id":      "ds-bescom-arr-filing-fy2025-26",
    "resource_name":    "BESCOM ARR Filing - FY 2025-26",
    "offer_id":         "offer-arr-filing-inline",
    "consideration_id": "consideration-arr-regulatory-mandate",
    "temporal":         "2025-04-01/2026-03-31",
    "unit":             "filing",
    "provider":         ("aperc-regulator-001", "APERC - AP Electricity Regulatory Commission"),
    "consumer":         ("bescom-discom-001",   "BESCOM - Bangalore Electricity Supply Company"),
}


class FilingRequest(BaseModel):
    filing_id: Optional[str] = None


# ── Contract builder ──────────────────────────────────────────────────────────

def _build_contract(filing_payload: list, status: str, commitment: str,
                    with_settlement: bool = False) -> dict:
    uc   = ARR_UC
    hash_ = beckn.compute_hash(filing_payload)

    contract = {
        "id": uc["contract_id"],
        "descriptor": {"name": "ARR Filing Data Exchange",
                       "shortDesc": "ARR filing submission under regulatory mandate"},
        "status": {"code": status},
        "commitments": [{
            "id": uc["commitment_id"],
            "status": {"descriptor": {"code": commitment}},
            "resources": [{
                "id": uc["resource_id"],
                "descriptor": {"name": uc["resource_name"]},
                "quantity": {"unitText": uc["unit"], "unitCode": "EA", "value": "1"},
            }],
            "offer": {
                "id":          uc["offer_id"],
                "descriptor":  {"name": f"ARR Filing Inline Delivery"},
                "resourceIds": [uc["resource_id"]],
            },
            "commitmentAttributes": {
                "@context":                 beckn.SCHEMA_CONTEXT,
                "@type":                    "DatasetItem",
                "schema:identifier":        uc["resource_id"],
                "schema:name":              uc["resource_name"],
                "schema:temporalCoverage":  uc["temporal"],
                "dataset:accessMethod":     "INLINE",
                "dataset:payloadHash":      hash_,
                "dataPayload":              filing_payload,
            },
        }],
        "consideration": [{
            "id": uc["consideration_id"],
            "status": {"code": "ACTIVE"},
            "considerationAttributes": {
                "@context": beckn.PRICE_CONTEXT, "@type": "PriceSpecification",
                "currency": "INR", "value": 0,
                "description": "Mandatory regulatory filing — no commercial consideration",
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
        "performance": [],
        "settlements": [],
    }
    if with_settlement:
        contract["settlements"] = [{
            "id": "settlement-arr-regulatory",
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

@router.get("/list")
def list_filings():
    return data.load_arr_filings()


@router.post("/create")
async def create_filing(req: FilingRequest):
    filings = data.load_arr_filings()
    if req.filing_id:
        filings = [f for f in filings if f.get("filingId") == req.filing_id]
        if not filings:
            raise HTTPException(404, f"Filing not found: {req.filing_id}")

    txn_id  = str(uuid.uuid4())
    steps   = []

    async with httpx.AsyncClient(timeout=30) as client:
        kw = dict(client=client, txn_id=txn_id)

        # ── SELECT ────────────────────────────────────────────────────────────
        on_select = await beckn.send_and_wait(
            **kw, action="select", timeout=20,
            body={"context": beckn.make_context("select", txn_id),
                  "message": {"contract": _build_contract(filings, "DRAFT", "DRAFT")}})
        steps.append(_step("select", on_select))

        # ── INIT ──────────────────────────────────────────────────────────────
        on_init = await beckn.send_and_wait(
            **kw, action="init", timeout=20,
            body={"context": beckn.make_context("init", txn_id),
                  "message": {"contract": _build_contract(filings, "ACTIVE", "ACTIVE")}})
        steps.append(_step("init", on_init))

        # ── CONFIRM ───────────────────────────────────────────────────────────
        on_confirm = await beckn.send_and_wait(
            **kw, action="confirm", timeout=20,
            body={"context": beckn.make_context("confirm", txn_id),
                  "message": {"contract": _build_contract(filings, "ACTIVE", "ACTIVE",
                                                          with_settlement=True)}})
        steps.append(_step("confirm", on_confirm))

        # ── STATUS → Receipt ──────────────────────────────────────────────────
        on_status = await beckn.send_and_wait(
            **kw, action="status", timeout=25,
            body={"context": beckn.make_context("status", txn_id),
                  "message": {"contract": {
                      "id":     ARR_UC["contract_id"],
                      "status": {"code": "ACTIVE"},
                      "commitments": [{
                          "id":     ARR_UC["commitment_id"],
                          "status": {"descriptor": {"code": "ACTIVE"}},
                          "resources": [{"id": ARR_UC["resource_id"],
                                         "descriptor": {"name": ARR_UC["resource_name"]},
                                         "quantity": {"unitText": ARR_UC["unit"],
                                                      "unitCode": "EA", "value": "1"}}],
                          "offer": {"id": ARR_UC["offer_id"],
                                    "descriptor": {"name": "ARR Filing Inline Delivery"},
                                    "resourceIds": [ARR_UC["resource_id"]]},
                      }],
                  }}})
        steps.append(_step("status", on_status))

    # ── Final status ──────────────────────────────────────────────────────────
    confirmed = on_confirm is not None
    receipt_status = "CONFIRMED" if confirmed else "TIMEOUT"

    return {
        "transactionId":  txn_id,
        "contractId":     ARR_UC["contract_id"],
        "status":         receipt_status,
        "filingId":       filings[0].get("filingId") if filings else None,
        "licensee":       filings[0].get("licensee") if filings else None,
        "commission":     filings[0].get("regulatoryCommission") if filings else None,
        "payloadHash":    beckn.compute_hash(filings),
        "becknFlow":      steps,
        "receipt":        on_status,
    }


def _step(action: str, response: Optional[dict]) -> dict:
    if response is None:
        return {"action": action.upper(), "status": "TIMEOUT", "received": False}
    if response.get("_error"):
        return {"action": action.upper(), "status": "ONIX_UNREACHABLE",
                "received": False, "note": response["_error"]}
    contract = response.get("message", {}).get("contract", {})
    return {
        "action":   action.upper(),
        "status":   "ACK",
        "received": True,
        "contractStatus": contract.get("status", {}).get("code", "?"),
    }
