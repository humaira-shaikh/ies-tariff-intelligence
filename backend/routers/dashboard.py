from fastapi import APIRouter, Query
from backend.services import data, beckn, discover

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary():
    filings  = data.load_arr_filings()
    policies = data.load_policies()
    programs = data.load_programs()

    submitted = sum(1 for f in filings if f.get("status") == "SUBMITTED")

    return {
        "totalFilings":    len(filings),
        "submittedFilings": submitted,
        "totalPolicies":   len(policies),
        "totalPrograms":   len(programs),
        "becknNetwork":    "nfh.global/testnet-deg",
        "onixBap":         "http://localhost:4030",
        "callbackPort":    9000,
        "status":          "ONLINE",
    }


@router.get("/bpp-responses")
def bpp_responses():
    """Show all on_* responses received by /callback — debug endpoint."""
    result = {}
    for key, payload in beckn._responses.items():
        txn_id, action = key.rsplit(":", 1)
        ctx         = payload.get("context", {})
        contract    = payload.get("message", {}).get("contract", {})
        commitments = contract.get("commitments", [])
        performance = contract.get("performance", [])

        # Extract dataPayload from confirm
        data_payload = None
        for c in commitments:
            attrs = c.get("commitmentAttributes", {})
            if "dataPayload" in attrs:
                data_payload = attrs["dataPayload"]

        # Extract dataPayload from status
        perf_payload = None
        for p in performance:
            attrs = p.get("performanceAttributes", {})
            if "dataPayload" in attrs:
                perf_payload = attrs["dataPayload"]

        result[key] = {
            "action":      action,
            "txnId":       txn_id,
            "contractId":  contract.get("id"),
            "status":      contract.get("status", {}).get("code"),
            "commitments": len(commitments),
            "dataPayload": data_payload,
            "perfPayload": perf_payload,
        }
    return {"total": len(result), "responses": result}


@router.get("/discover")
async def discover_bpp(subscriber_id: str = Query(..., description="e.g. flockenergy.tech")):
    """
    DeDi Registry Lookup — find a BPP by subscriber_id.
    Step 1 of Beckn flow before calling select/init/confirm/status.
    """
    result = await discover.lookup(subscriber_id)
    if result:
        return {
            "found":          True,
            "subscriber_id":  subscriber_id,
            "registry_url":   result["url"],
            "data":           result["data"],
        }
    return {
        "found":         False,
        "subscriber_id": subscriber_id,
        "note":          "Not found in DeDi — may need registration at publish.dedi.global",
    }


@router.get("/discover/all")
async def discover_all_bpps():
    """List all BPPs registered on nfh.global/testnet-deg."""
    bpps = await discover.list_all_bpps()
    return {"network": "nfh.global/testnet-deg", "count": len(bpps), "bpps": bpps}


@router.get("/visitors")
async def who_is_accessing():
    """Real-time monitor — who is hitting our BPP server."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get("http://localhost:4040/api/requests/http")
            reqs = r.json().get("requests", [])
    except Exception:
        return {"error": "ngrok inspector not available at localhost:4040"}

    # Group by IP
    visitors = {}
    for req in reqs:
        ip     = req.get("remote_addr", "?").split(":")[0]
        method = req.get("request", {}).get("method", "?")
        uri    = req.get("request", {}).get("uri", "?")
        status = req.get("response", {}).get("status_code", "?")

        if ip not in visitors:
            visitors[ip] = {"ip": ip, "requests": [], "count": 0}
        visitors[ip]["requests"].append({"method": method, "path": uri, "status": status})
        visitors[ip]["count"] += 1

    # Known IPs
    known = {
        "117.250.7.33": "flockenergy.tech",
        "127.0.0.1":    "localhost (you)",
    }

    result = []
    for ip, v in sorted(visitors.items(), key=lambda x: -x[1]["count"]):
        name = known.get(ip, "unknown")
        paths = list(dict.fromkeys(r["path"] for r in v["requests"]))
        result.append({
            "ip":       ip,
            "team":     name,
            "total_requests": v["count"],
            "paths_visited":  paths,
        })

    return {
        "total_unique_visitors": len(result),
        "our_ngrok_url": "https://appraiser-mascot-possible.ngrok-free.dev",
        "visitors": result,
    }
