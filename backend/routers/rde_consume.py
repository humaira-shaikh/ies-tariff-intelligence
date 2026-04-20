"""
RDE — Consume Filing (SERC Role)
DISCOM filing receive karo → hash validate karo → receipt bhejo
"""
import hashlib, json, uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, BackgroundTasks
import httpx
from backend.services import beckn

router     = APIRouter(prefix="/api/rde", tags=["rde"])
_receipts  = []   # in-memory store


def now_ts():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def verify_hash(payload, claimed_hash: str) -> bool:
    computed = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return computed == claimed_hash


async def send_receipt(bap_uri: str, txn_id: str, filing_id: str,
                       status: str, reason: str, payload_hash: str):
    body = {
        "context": {
            "action":         "on_status",
            "version":        "2.0.0",
            "transaction_id": txn_id,
            "message_id":     str(uuid.uuid4()),
            "timestamp":      now_ts(),
            "bpp_id":         "bpp.example.com",
            "bpp_uri":        "https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver",
        },
        "message": {
            "contract": {
                "id":     f"contract-{txn_id[:8]}",
                "status": {"code": "ACTIVE"},
                "performance": [{
                    "id":     f"receipt-{txn_id[:8]}",
                    "status": {"code": status},
                    "performanceAttributes": {
                        "@type":           "FilingReceipt",
                        "filingId":        filing_id,
                        "receiptStatus":   status,
                        "reason":          reason,
                        "payloadHash":     payload_hash,
                        "validatedAt":     now_ts(),
                        "validatedBy":     "SERC Automated Validation System",
                    }
                }]
            }
        }
    }
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(f"{bap_uri}/on_status", json=body)
    except Exception as e:
        print(f"[RDE] Receipt send failed: {e}")


# ── Receive filing from DISCOM ────────────────────────────────────────────────

@router.post("/receive")
async def receive_filing(request: Request, bg: BackgroundTasks):
    """
    SERC receives ARR filing from DISCOM via Beckn.
    Validates payload hash and stores receipt.
    """
    body = await request.json()
    ctx  = body.get("context", {})
    bap_uri = ctx.get("bapUri") or ctx.get("bap_uri", "")
    txn_id  = ctx.get("transactionId") or ctx.get("transaction_id", str(uuid.uuid4()))

    # Extract filing payload from commitments
    contract    = body.get("message", {}).get("contract", {})
    commitments = contract.get("commitments", [])

    filing_id    = None
    payload_hash = None
    data_payload = None
    hash_valid   = None

    for c in commitments:
        attrs = c.get("commitmentAttributes", {})
        if attrs.get("@type") == "DatasetItem":
            payload_hash = attrs.get("dataset:payloadHash")
            data_payload = attrs.get("dataPayload")

            if data_payload and payload_hash:
                hash_valid = verify_hash(data_payload, payload_hash)

            # Get filing ID
            if isinstance(data_payload, list) and data_payload:
                filing_id = data_payload[0].get("filingId", "unknown")
            elif isinstance(data_payload, dict):
                filing_id = data_payload.get("filingId", "unknown")

    status = "ACCEPTED" if hash_valid else "REJECTED" if hash_valid is False else "RECEIVED"
    reason = (
        "Payload hash verified — filing accepted" if hash_valid
        else "Hash mismatch — payload integrity check failed" if hash_valid is False
        else "Filing received — hash not provided"
    )

    receipt = {
        "id":          str(uuid.uuid4()),
        "txnId":       txn_id,
        "filingId":    filing_id,
        "receivedAt":  now_ts(),
        "status":      status,
        "hashValid":   hash_valid,
        "payloadHash": payload_hash,
        "bapUri":      bap_uri,
        "reason":      reason,
        "filingCount": len(data_payload) if isinstance(data_payload, list) else 1,
    }
    _receipts.append(receipt)

    print(f"\n[RDE] Filing received | txn={txn_id[:8]} | filing={filing_id} | {status}")

    # Send receipt back to DISCOM
    if bap_uri:
        bg.add_task(send_receipt, bap_uri, txn_id, filing_id or "?", status, reason, payload_hash or "")

    return {"message": {"ack": {"status": "ACK"}}, "receipt": receipt}


@router.get("/receipts")
def get_receipts():
    return {"total": len(_receipts), "receipts": list(reversed(_receipts))}
