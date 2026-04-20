"""
Beckn protocol service.

Flow (using ies-beckn-gateway as ONIX substitute):
  Our FastAPI (9000)
    → POST localhost:4030/{action}
        context.bap_uri = http://host.docker.internal:9000/callback
    → ies-beckn-gateway ACKs immediately
    → after ~1s: POST host.docker.internal:9000/callback  (on_* response)
    → asyncio.Event signals the waiting coroutine
"""
import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

# ── Gateway endpoint ──────────────────────────────────────────────────────────
BECKN_GW      = "http://localhost:4030"          # ies-beckn-gateway (running, ARM-safe)
CALLBACK_PORT = 9000
CALLBACK_URI  = "http://host.docker.internal:9000/callback"   # Docker → host

BAP_ID  = "bap.example.com"
BPP_ID  = "bpp.example.com"
BPP_URI = "http://sandbox-bpp:3002/api/webhook"

SCHEMA_CONTEXT  = "https://raw.githubusercontent.com/beckn/DDM/main/specification/schema/DatasetItem/v1/context.jsonld"
ORG_CONTEXT     = "https://raw.githubusercontent.com/beckn/schemas/refs/heads/main/schema/Organization/v2.0/context.jsonld"
PRICE_CONTEXT   = "https://raw.githubusercontent.com/beckn/schemas/refs/heads/main/schema/PriceSpecification/v2.1/context.jsonld"
PAYMENT_CONTEXT = "https://raw.githubusercontent.com/beckn/schemas/refs/heads/main/schema/Payment/v2.0/context.jsonld"

# ── In-memory event store (txn_id:on_action → Event + response) ──────────────
_events:    dict[str, asyncio.Event] = {}
_responses: dict[str, dict]          = {}
_loop:      Optional[asyncio.AbstractEventLoop] = None


def set_event_loop(loop: asyncio.AbstractEventLoop):
    global _loop
    _loop = loop


def register_callback(txn_id: str, action: str, body: dict):
    """Called by /callback when ies-beckn-gateway delivers an on_* response."""
    key = f"{txn_id}:{action}"
    _responses[key] = body
    if key in _events and _loop:
        _loop.call_soon_threadsafe(_events[key].set)


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def compute_hash(payload: object) -> str:
    s = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode()).hexdigest()


def make_context(
    action: str,
    txn_id: str,
    bpp_id: Optional[str] = None,
    bpp_uri: Optional[str] = None,
) -> dict:
    """
    Beckn context with bap_uri pointing to our callback.
    ies-beckn-gateway reads bap_uri to know where to send on_* responses.
    Pass bpp_id/bpp_uri to route to an external BPP instead of the sandbox.
    """
    return {
        "domain":         "deg:ies",
        "action":         action,
        "version":        "2.0.0",
        "bap_id":         BAP_ID,
        "bap_uri":        CALLBACK_URI,   # ← gateway delivers on_* HERE
        "bpp_id":         bpp_id or BPP_ID,
        "bpp_uri":        bpp_uri or BPP_URI,
        "transaction_id": txn_id,
        "message_id":     str(uuid.uuid4()),
        "timestamp":      now_ts(),
        # DDM extended fields
        "networkId":      "nfh.global/testnet-deg",
        "transactionId":  txn_id,
        "messageId":      str(uuid.uuid4()),
        "schemaContext": [SCHEMA_CONTEXT] if action != "status" else [],
    }


# ── Core send-and-wait ────────────────────────────────────────────────────────

async def send_and_wait(
    client: httpx.AsyncClient,
    action: str,
    txn_id: str,
    body: dict,
    timeout: float = 10.0,
) -> Optional[dict]:
    """
    POST to ies-beckn-gateway and wait for on_{action} callback on port 9000.
    """
    on_action = f"on_{action}"
    key       = f"{txn_id}:{on_action}"

    # Register event BEFORE sending (avoid race condition)
    evt = asyncio.Event()
    _events[key] = evt

    try:
        resp = await client.post(f"{BECKN_GW}/{action}", json=body)
        ack  = resp.json().get("message", {}).get("ack", {}).get("status", "?")
    except Exception as e:
        _events.pop(key, None)
        return {"_error": str(e)}

    if ack != "ACK":
        _events.pop(key, None)
        return None

    try:
        await asyncio.wait_for(evt.wait(), timeout=timeout)
        return _responses.get(key)
    except asyncio.TimeoutError:
        return None
    finally:
        _events.pop(key, None)
