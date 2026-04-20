"""
TI — Create Tariff (BPP Role)
RDE — Consume Filing (BPP Role)

Tumhara FastAPI = BPP Server
  Incoming: ONIX BPP -> POST /bpp/receiver/{action}
  Outgoing: POST bap_uri/on_{action}  (BAP ka callback URL)

Flow:
  Doosri team ka BAP
      -> ONIX BPP (8082)
      -> POST /bpp/receiver/select   (yahan aata hai)
      ← tumhara on_select response
      -> ONIX BPP signs
      -> Unka /callback
"""
import uuid
import httpx
from fastapi import APIRouter, Request, BackgroundTasks
from backend.services import beckn, data

router = APIRouter(prefix="/bpp/receiver", tags=["bpp"])


@router.post("")
@router.post("/")
async def bpp_root_dispatch(request: Request, bg: BackgroundTasks):
    """
    Catch-all — some teams POST to /bpp/receiver without /{action}.
    Route by context.action field.
    """
    body    = await request.json()
    ctx     = body.get("context", {})
    action  = ctx.get("action", "select")
    bap_uri = get_bap_uri(ctx)
    txn_id  = get_txn_id(ctx)

    print(f"\n[BPP] ROOT dispatch | action={action} | txn={txn_id[:8]} | from={bap_uri}")

    if action == "select":
        on_body = _build_on_select(body)
    elif action == "init":
        on_body = _build_on_init(body)
    elif action == "confirm":
        on_body = _build_on_confirm(body)
    elif action == "status":
        on_body = _build_on_status(body)
    else:
        return {"message": {"ack": {"status": "ACK"}}}

    bg.add_task(send_response, bap_uri, f"on_{action}", txn_id, on_body)
    # Include contract inline for BAPs that read the ACK body directly
    inline_contract = on_body.get("message", {}).get("contract", {})
    return {"message": {"ack": {"status": "ACK"}, "contract": inline_contract}}

# ── Helper: BAP ko on_* response bhejo ───────────────────────────────────────

async def send_response(bap_uri: str, on_action: str, txn_id: str, payload: dict):
    """POST on_{action} response to BAP's callback URL."""
    url = f"{bap_uri}/{on_action}" if not bap_uri.endswith(on_action) else bap_uri
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json=payload)
    except Exception as e:
        print(f"[BPP] Failed to send {on_action} to {url}: {e}")


def _build_on_select(body: dict) -> dict:
    ctx      = body.get("context", {})
    policies = data.load_policies()
    return {
        "context": make_on_context(ctx, "on_select"),
        "message": {"contract": {
            "id": "770f0611-a41d-53f6-c938-668877662411",
            "descriptor": {"name": "IES Tariff Policy Data Exchange",
                           "shortDesc": "Machine-readable tariff policies from SERC"},
            "status": {"code": "DRAFT"},
            "commitments": [{
                "id": f"commitment-policy-{p['policyID']}",
                "status": {"descriptor": {"code": "DRAFT"}},
                "resources": [{"id": f"ds-serc-{p['policyID'].lower()}",
                                "descriptor": {"name": p["policyName"],
                                               "shortDesc": f"{p['policyType']} | {p['programID']}"},
                                "quantity": {"unitText": "policy", "unitCode": "EA", "value": "1"}}],
                "offer": {"id": f"offer-{p['policyID'].lower()}",
                           "descriptor": {"name": f"{p['policyName']} - Inline Delivery"},
                           "resourceIds": [f"ds-serc-{p['policyID'].lower()}"]}
            } for p in policies]
        }}
    }


def _build_on_init(body: dict) -> dict:
    ctx      = body.get("context", {})
    contract = body.get("message", {}).get("contract", {})
    return {
        "context": make_on_context(ctx, "on_init"),
        "message": {"contract": {**contract, "status": {"code": "ACTIVE"},
            "commitments": [{**c, "status": {"descriptor": {"code": "ACTIVE"}}}
                            for c in contract.get("commitments", [])]}}
    }


def _build_on_confirm(body: dict) -> dict:
    ctx      = body.get("context", {})
    contract = body.get("message", {}).get("contract", {})
    policies = data.load_policies()
    enriched = []
    for c in contract.get("commitments", []):
        resource_id = (c.get("resources") or [{}])[0].get("id", "")
        matched     = next((p for p in policies if p["policyID"].lower() in resource_id.lower()),
                           policies[0])
        enriched.append({**c, "status": {"descriptor": {"code": "ACTIVE"}},
            "commitmentAttributes": {
                "@context": beckn.SCHEMA_CONTEXT, "@type": "DatasetItem",
                "schema:identifier": resource_id, "schema:name": matched["policyName"],
                "dataset:accessMethod": "INLINE",
                "dataset:payloadHash": beckn.compute_hash(matched),
                "dataPayload": matched}})
    return {
        "context": make_on_context(ctx, "on_confirm"),
        "message": {"contract": {**contract, "status": {"code": "ACTIVE"},
                                  "commitments": enriched}}
    }


def _build_on_status(body: dict) -> dict:
    ctx      = body.get("context", {})
    contract = body.get("message", {}).get("contract", {})
    policies = data.load_policies()
    return {
        "context": make_on_context(ctx, "on_status"),
        "message": {"contract": {**contract, "status": {"code": "ACTIVE"},
            "performance": [{"id": f"perf-001", "status": {"code": "COMPLETE"},
                "performanceAttributes": {
                    "@context": beckn.SCHEMA_CONTEXT, "@type": "DatasetItem",
                    "dataset:accessMethod": "INLINE",
                    "dataset:payloadHash": beckn.compute_hash(policies),
                    "dataPayload": policies}}]}}
    }


def make_on_context(incoming_ctx: dict, on_action: str) -> dict:
    """Build on_* context from incoming context."""
    return {
        **incoming_ctx,
        "action":    on_action,
        "messageId": str(uuid.uuid4()),
        "message_id": str(uuid.uuid4()),
        "timestamp": beckn.now_ts(),
        # Swap BAP/BPP for response
        "bapId":  incoming_ctx.get("bapId") or incoming_ctx.get("bap_id"),
        "bapUri": incoming_ctx.get("bapUri") or incoming_ctx.get("bap_uri"),
        "bppId":  "bpp.example.com",
        "bppUri": "http://localhost:9000/bpp/receiver",
    }


def get_bap_uri(ctx: dict) -> str:
    return ctx.get("bapUri") or ctx.get("bap_uri", "")


def get_txn_id(ctx: dict) -> str:
    return ctx.get("transactionId") or ctx.get("transaction_id", str(uuid.uuid4()))


# ── SELECT — catalog bhejo ────────────────────────────────────────────────────

@router.post("/select")
async def on_select(request: Request, bg: BackgroundTasks):
    body = await request.json()
    ctx  = body.get("context", {})
    bap_uri = get_bap_uri(ctx)
    txn_id  = get_txn_id(ctx)

    print(f"\n[BPP] SELECT received | txn={txn_id} | from={bap_uri}")

    policies = data.load_policies()

    # Build on_select: catalog of available datasets
    on_select_body = {
        "context": make_on_context(ctx, "on_select"),
        "message": {
            "contract": {
                "id": "770f0611-a41d-53f6-c938-668877662411",
                "descriptor": {
                    "name": "IES Tariff Policy Data Exchange",
                    "shortDesc": "Machine-readable tariff policies from SERC"
                },
                "status": {"code": "DRAFT"},
                "commitments": [
                    {
                        "id": f"commitment-policy-{p['policyID']}",
                        "status": {"descriptor": {"code": "DRAFT"}},
                        "resources": [{
                            "id":  f"ds-serc-{p['policyID'].lower()}",
                            "descriptor": {
                                "name": p["policyName"],
                                "shortDesc": f"{p['policyType']} | Program: {p['programID']}"
                            },
                            "quantity": {
                                "unitText": "policy", "unitCode": "EA", "value": "1"
                            }
                        }],
                        "offer": {
                            "id": f"offer-{p['policyID'].lower()}",
                            "descriptor": {"name": f"{p['policyName']} - Inline Delivery"},
                            "resourceIds": [f"ds-serc-{p['policyID'].lower()}"]
                        }
                    }
                    for p in policies
                ]
            }
        }
    }

    # Send on_select back to BAP (in background)
    bg.add_task(send_response, bap_uri, "on_select", txn_id, on_select_body)
    print(f"[BPP] on_select queued -> {bap_uri}")

    return {"message": {"ack": {"status": "ACK"}}}


# ── INIT — contract draft ─────────────────────────────────────────────────────

@router.post("/init")
async def on_init(request: Request, bg: BackgroundTasks):
    body = await request.json()
    ctx  = body.get("context", {})
    bap_uri = get_bap_uri(ctx)
    txn_id  = get_txn_id(ctx)

    print(f"\n[BPP] INIT received | txn={txn_id}")

    incoming_contract = body.get("message", {}).get("contract", {})

    on_init_body = {
        "context": make_on_context(ctx, "on_init"),
        "message": {
            "contract": {
                **incoming_contract,
                "status": {"code": "ACTIVE"},
                "commitments": [
                    {**c, "status": {"descriptor": {"code": "ACTIVE"}}}
                    for c in incoming_contract.get("commitments", [])
                ]
            }
        }
    }

    bg.add_task(send_response, bap_uri, "on_init", txn_id, on_init_body)
    print(f"[BPP] on_init queued -> {bap_uri}")

    return {"message": {"ack": {"status": "ACK"}}}


# ── CONFIRM — data attach karo ────────────────────────────────────────────────

@router.post("/confirm")
async def on_confirm(request: Request, bg: BackgroundTasks):
    body = await request.json()
    ctx  = body.get("context", {})
    bap_uri = get_bap_uri(ctx)
    txn_id  = get_txn_id(ctx)

    print(f"\n[BPP] CONFIRM received | txn={txn_id}")

    policies = data.load_policies()
    incoming_contract = body.get("message", {}).get("contract", {})

    # Attach actual policy data to each commitment
    enriched_commitments = []
    for c in incoming_contract.get("commitments", []):
        resource_id = (c.get("resources") or [{}])[0].get("id", "")
        matched = next(
            (p for p in policies if p["policyID"].lower() in resource_id.lower()),
            policies[0]
        )
        enriched_commitments.append({
            **c,
            "status": {"descriptor": {"code": "ACTIVE"}},
            "commitmentAttributes": {
                "@context": beckn.SCHEMA_CONTEXT,
                "@type":    "DatasetItem",
                "schema:identifier":       resource_id,
                "schema:name":             matched["policyName"],
                "schema:temporalCoverage": matched.get("samplingInterval", ""),
                "dataset:accessMethod":    "INLINE",
                "dataset:payloadHash":     beckn.compute_hash(matched),
                "dataPayload":             matched,
            }
        })

    response_contract = {
        **incoming_contract,
        "status": {"code": "ACTIVE"},
        "commitments": enriched_commitments,
    }
    on_confirm_body = {
        "context": make_on_context(ctx, "on_confirm"),
        "message": {"contract": response_contract},
    }

    bg.add_task(send_response, bap_uri, "on_confirm", txn_id, on_confirm_body)
    print(f"[BPP] on_confirm queued -> {bap_uri} (with policy data)")

    # Return contract inline so BAPs that read the ACK body get data immediately
    return {"message": {"ack": {"status": "ACK"}, "contract": response_contract}}


# ── STATUS — full payload + receipt ──────────────────────────────────────────

@router.post("/status")
async def on_status(request: Request, bg: BackgroundTasks):
    body = await request.json()
    ctx  = body.get("context", {})
    bap_uri = get_bap_uri(ctx)
    txn_id  = get_txn_id(ctx)

    print(f"\n[BPP] STATUS received | txn={txn_id}")

    policies = data.load_policies()
    incoming_contract = body.get("message", {}).get("contract", {})

    performance = [{
        "id":     f"perf-{txn_id[:8]}",
        "status": {"code": "COMPLETE"},
        "performanceAttributes": {
            "@context":             beckn.SCHEMA_CONTEXT,
            "@type":                "DatasetItem",
            "dataset:accessMethod": "INLINE",
            "dataset:payloadHash":  beckn.compute_hash(policies),
            "dataPayload":          policies,
        }
    }]

    response_contract = {
        **incoming_contract,
        "status":      {"code": "ACTIVE"},
        "performance": performance,
    }
    on_status_body = {
        "context": make_on_context(ctx, "on_status"),
        "message": {"contract": response_contract},
    }

    bg.add_task(send_response, bap_uri, "on_status", txn_id, on_status_body)
    print(f"[BPP] on_status queued -> {bap_uri} (with {len(policies)} policies)")

    # Return contract inline so BAPs that read the ACK body get data immediately
    return {"message": {"ack": {"status": "ACK"}, "contract": response_contract}}
