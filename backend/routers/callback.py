"""
/callback — receives on_* responses from ies-beckn-gateway.

ies-beckn-gateway reads context.bap_uri and POSTs on_{action} to:
  http://host.docker.internal:9000/callback/on_{action}
  OR
  http://host.docker.internal:9000/callback

Both routes are handled here.
"""
from fastapi import APIRouter, Request
from backend.services import beckn

router = APIRouter()


@router.post("/callback")
@router.post("/callback/{action}")
async def receive_callback(request: Request, action: str = None):
    body   = await request.json()
    ctx    = body.get("context", {})

    # ies-beckn-gateway sends: context.action = "on_select" etc.
    # Also support ONIX style: context.action field
    act    = ctx.get("action") or (f"on_{action}" if action else "unknown")

    # Support both camelCase (ONIX) and snake_case (ies-beckn-gateway)
    txn_id = ctx.get("transactionId") or ctx.get("transaction_id", "?")

    beckn.register_callback(txn_id, act, body)
    return {"message": {"ack": {"status": "ACK"}}}
