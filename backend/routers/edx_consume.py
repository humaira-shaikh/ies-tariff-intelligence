"""
EDX — Consume Telemetry (Consumer App Role)
AMISP se meter data receive karo → parse karo → analytics dikhao
"""
import hashlib, json, uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request
import httpx
from backend.services import beckn

router   = APIRouter(prefix="/api/edx", tags=["edx"])
_batches = []   # stored meter data batches

EDX_BPP = {
    "flockenergy.tech": "https://5c41-117-250-7-33.ngrok-free.app/bpp/receiver",
}


def now_ts():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Receive meter data callback ───────────────────────────────────────────────

@router.post("/receive")
async def receive_telemetry(request: Request):
    """Receive IES_Report meter data from AMISP via callback."""
    body = await request.json()
    ctx  = body.get("context", {})
    txn  = ctx.get("transactionId") or ctx.get("transaction_id", "?")

    contract    = body.get("message", {}).get("contract", {})
    performance = contract.get("performance", [])

    for perf in performance:
        attrs   = perf.get("performanceAttributes", {})
        payload = attrs.get("dataPayload")
        if not payload:
            continue

        # Handle IES_Report format
        report = payload if isinstance(payload, dict) else (payload[0] if isinstance(payload, list) else {})

        batch = {
            "id":          str(uuid.uuid4()),
            "txnId":       txn,
            "receivedAt":  now_ts(),
            "reportName":  report.get("reportName", "?"),
            "clientName":  report.get("clientName", "?"),
            "reportType":  report.get("@type", "?"),
            "programId":   report.get("programID", "?"),
            "raw":         report,
            "analytics":   _analyse(report),
        }
        _batches.append(batch)
        print(f"\n[EDX] Meter data received | txn={txn[:8]} | report={batch['reportName']}")

    return {"message": {"ack": {"status": "ACK"}}}


def _analyse(report: dict) -> dict:
    """Extract useful analytics from IES_Report."""
    intervals   = report.get("intervals", []) or report.get("meterReadings", []) or []
    descriptors = report.get("payloadDescriptors", [])

    total_kwh = 0.0
    count     = len(intervals)
    quality   = {"actual": 0, "estimated": 0, "missing": 0}

    for iv in intervals:
        val = iv.get("value") or iv.get("kWh") or 0
        try:
            total_kwh += float(val)
        except Exception:
            pass
        q = str(iv.get("quality", iv.get("qualityFlag", "actual"))).lower()
        if "estim" in q:
            quality["estimated"] += 1
        elif "miss" in q:
            quality["missing"] += 1
        else:
            quality["actual"] += 1

    return {
        "totalIntervals": count,
        "totalKWh":       round(total_kwh, 3),
        "avgKWh":         round(total_kwh / count, 3) if count else 0,
        "qualityFlags":   quality,
        "resources":      len(report.get("resources", [])),
        "descriptors":    [d.get("objectType", d.get("type", "?")) for d in descriptors],
    }


# ── Fetch from AMISP via Beckn ────────────────────────────────────────────────

@router.post("/fetch")
async def fetch_telemetry(request: Request):
    """Fetch meter data from AMISP BPP via Beckn."""
    body   = await request.json()
    bpp_id = body.get("bpp_id", "flockenergy.tech")
    bpp_uri= body.get("bpp_uri") or EDX_BPP.get(bpp_id, "")

    txn_id = str(uuid.uuid4())
    steps  = []

    contract = {
        "id": f"contract-edx-{txn_id[:8]}",
        "status": {"code": "DRAFT"},
        "commitments": [{
            "id": "commitment-meter-data-001",
            "status": {"descriptor": {"code": "DRAFT"}},
            "resources": [{"id": "ds-ies-meter-telemetry",
                           "descriptor": {"name": "AMI Meter Telemetry"},
                           "quantity": {"unitText": "readings", "unitCode": "EA", "value": "1"}}],
            "offer": {"id": "offer-meter-inline",
                      "descriptor": {"name": "Meter Data Inline Delivery"},
                      "resourceIds": ["ds-ies-meter-telemetry"]},
        }]
    }

    async with httpx.AsyncClient(timeout=30) as client:
        for action in ["select", "init", "confirm", "status"]:
            if action != "select":
                contract["status"]["code"] = "ACTIVE"
                contract["commitments"][0]["status"]["descriptor"]["code"] = "ACTIVE"

            req_body = {
                "context": {
                    "domain": "deg:ies", "action": action, "version": "2.0.0",
                    "bap_id": "bap.example.com",
                    "bap_uri": "https://appraiser-mascot-possible.ngrok-free.dev/callback",
                    "bpp_id": bpp_id, "bpp_uri": bpp_uri,
                    "transaction_id": txn_id, "message_id": str(uuid.uuid4()),
                    "timestamp": now_ts(), "networkId": "nfh.global/testnet-deg",
                },
                "message": {"contract": contract}
            }
            from backend.services.signing import make_auth_header
            auth = make_auth_header(req_body)
            try:
                r   = await client.post(f"{bpp_uri}/{action}", json=req_body,
                                        headers={"Authorization": auth}, timeout=15)
                ack = r.json().get("message", {}).get("ack", {}).get("status", "?")
                steps.append({"action": action.upper(), "status": ack})
            except Exception as e:
                steps.append({"action": action.upper(), "status": "ERROR", "error": str(e)})

            import asyncio
            await asyncio.sleep(1.5)

    # Check received batches
    received = [b for b in _batches if b["txnId"] == txn_id]
    return {
        "transactionId": txn_id,
        "becknFlow":     steps,
        "batchesReceived": len(received),
        "batches":       received,
    }


@router.get("/batches")
def get_batches():
    return {"total": len(_batches), "batches": list(reversed(_batches))}
