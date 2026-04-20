"""
DeDi Registry — BPP Discovery Service

DeDi = Decentralised Directory
URL: https://fabric.nfh.global/registry/dedi

Flow:
  1. POST /lookup with subscriber_id
  2. Get back: subscriber_url, signing_public_key
  3. Use subscriber_url for Beckn calls
"""
import httpx
from typing import Optional

DEDI_BASE = "https://fabric.nfh.global/registry/dedi"
NETWORK   = "nfh.global/testnet-deg"

LOOKUP_PATHS = [
    "/lookup",
    "/subscribers/lookup",
    "/api/lookup",
    "/api/v1/lookup",
]


async def lookup(subscriber_id: str) -> Optional[dict]:
    """
    Look up a subscriber in DeDi registry.
    Returns subscriber info or None if not found.
    """
    payload = {
        "subscriber_id": subscriber_id,
        "network_id":    NETWORK,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        for path in LOOKUP_PATHS:
            try:
                url = f"{DEDI_BASE}{path}"
                r   = await client.post(url, json=payload,
                                        headers={"Content-Type": "application/json"})
                if r.status_code == 200:
                    data = r.json()
                    if data:
                        return {"url": url, "data": data}
            except Exception:
                continue

        # Also try publish.dedi.global
        for path in LOOKUP_PATHS:
            try:
                url = f"https://publish.dedi.global{path}"
                r   = await client.post(url, json=payload,
                                        headers={"Content-Type": "application/json"})
                if r.status_code == 200:
                    data = r.json()
                    if data:
                        return {"url": url, "data": data}
            except Exception:
                continue

    return None


async def list_all_bpps() -> list:
    """List all registered BPPs on the testnet."""
    payload = {"type": "BPP", "network_id": NETWORK}

    async with httpx.AsyncClient(timeout=10) as client:
        for path in LOOKUP_PATHS + ["/subscribers", "/list"]:
            try:
                url = f"{DEDI_BASE}{path}"
                r   = await client.post(url, json=payload,
                                        headers={"Content-Type": "application/json"})
                if r.status_code == 200:
                    return r.json()
            except Exception:
                continue
    return []
