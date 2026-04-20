"""
IES Bootcamp — Discovery Demo
Dikhata hai: DeDi Lookup -> Beckn Flow -> Data Receive

Run: python demo_discovery.py
"""
import httpx, uuid, json, time, sys
sys.path.insert(0, "C:/ies-bootcamp")
from backend.services.signing import make_auth_header

# ── Config ────────────────────────────────────────────────────────────────────
NETWORK      = "nfh.global/testnet-deg"
DEDI_URL     = "https://fabric.nfh.global/registry/dedi"
OUR_CALLBACK = "https://appraiser-mascot-possible.ngrok-free.dev/callback"
OUR_BPP      = "https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver"

# Known teams (from bootcamp WhatsApp)
TEAMS = {
    "flockenergy.tech":    "https://fa85-117-250-7-33.ngrok-free.app/bpp/receiver",
    "bpp.renewalytics.in": "https://comma-appendage-deacon.ngrok-free.dev/bpp/receiver",
    "bpp.example.com":     OUR_BPP,
}


def line(char="=", n=58): print(char * n)
def header(title):
    print(); line()
    print(f"  {title}")
    line()


def step(num, title):
    print(f"\n  STEP {num}: {title}")
    print("  " + "-"*40)


# ── STEP 1: DeDi Discovery ────────────────────────────────────────────────────

def demo_dedi_lookup(subscriber_id: str) -> str:
    step(1, f"DeDi Discovery — {subscriber_id}")
    print(f"  Registry : {DEDI_URL}")
    print(f"  Looking up: {subscriber_id}")
    print()

    # Try DeDi
    try:
        r = httpx.post(
            f"{DEDI_URL}/lookup",
            json={"subscriber_id": subscriber_id, "network_id": NETWORK},
            timeout=8
        )
        if r.status_code == 200 and r.json():
            data = r.json()
            url  = data[0].get("subscriber_url", "")
            print(f"  [FOUND in DeDi]")
            print(f"  subscriber_url : {url}")
            print(f"  public_key     : {data[0].get('signing_public_key','?')[:30]}...")
            return url
    except Exception as e:
        print(f"  DeDi response : 404 (not registered yet)")

    # Fallback
    fallback = TEAMS.get(subscriber_id)
    if fallback:
        print(f"  [Fallback] URL from bootcamp network:")
        print(f"  BPP URL : {fallback}")
        return fallback

    print(f"  [NOT FOUND]")
    return None


# ── STEP 2-5: Beckn Lifecycle ─────────────────────────────────────────────────

def demo_beckn_flow(bpp_uri: str, bpp_id: str) -> dict:
    step(2, "Beckn Lifecycle — select -> init -> confirm -> status")
    print(f"  Our BAP  : {OUR_CALLBACK}")
    print(f"  Their BPP: {bpp_uri}")

    TXN = str(uuid.uuid4())
    print(f"  TXN ID   : {TXN}")

    contract = {
        "id": f"contract-{TXN[:8]}",
        "status": {"code": "DRAFT"},
        "commitments": [{
            "id": "commitment-001",
            "status": {"descriptor": {"code": "DRAFT"}},
            "resources": [{
                "id": "ds-serc-tariff-policy-fy2024-25",
                "descriptor": {"name": "Tariff Policy Dataset"},
                "quantity": {"unitText": "policy", "unitCode": "EA", "value": "1"}
            }],
            "offer": {
                "id": "offer-001",
                "descriptor": {"name": "Tariff Inline Delivery"},
                "resourceIds": ["ds-serc-tariff-policy-fy2024-25"]
            }
        }]
    }

    results = {}
    print()

    for action in ["select", "init", "confirm", "status"]:
        if action != "select":
            contract["status"]["code"] = "ACTIVE"
            contract["commitments"][0]["status"]["descriptor"]["code"] = "ACTIVE"

        body = {
            "context": {
                "domain": "deg:ies", "action": action, "version": "2.0.0",
                "bap_id": "bap.example.com", "bap_uri": OUR_CALLBACK,
                "bpp_id": bpp_id, "bpp_uri": bpp_uri,
                "transaction_id": TXN, "message_id": str(uuid.uuid4()),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "networkId": NETWORK,
            },
            "message": {"contract": contract}
        }

        # Sign
        auth = make_auth_header(body)
        print(f"  [{action.upper():8}]", end="", flush=True)

        try:
            r = httpx.post(
                f"{bpp_uri}/{action}", json=body,
                headers={"Authorization": auth, "Content-Type": "application/json"},
                timeout=15
            )
            data  = r.json()
            ack   = data.get("message", {}).get("ack", {}).get("status", "?")
            error = data.get("message", {}).get("error", {})

            if ack == "ACK":
                print(f" ACK received")
            else:
                msg = error.get("message", "NACK") if error else "NACK"
                print(f" NACK - {msg}")

            results[action] = ack

        except Exception as e:
            print(f" ERROR - {str(e)[:40]}")
            results[action] = "ERROR"

        time.sleep(1.5)

    return {"txn_id": TXN, "results": results}


# ── STEP 3: Check Callbacks ───────────────────────────────────────────────────

def demo_callbacks(txn_id: str):
    step(3, "Callbacks Received at Our Server")
    print(f"  Callback URL: {OUR_CALLBACK}")
    time.sleep(3)

    try:
        r = httpx.get("http://localhost:9000/api/dashboard/bpp-responses", timeout=5)
        data = r.json()
        found = {k: v for k, v in data["responses"].items() if txn_id[:8] in k}

        if found:
            print(f"  Responses received: {len(found)}")
            print()
            for k, v in found.items():
                icon = "OK" if v["status"] else "--"
                print(f"  [{icon}] {v['action'].upper():15} status={v['status']}")
                if v.get("perfPayload"):
                    pp = v["perfPayload"]
                    print(f"       Data type : {pp.get('@type','?')}")
                    print(f"       Report    : {pp.get('reportName') or pp.get('policyName','?')}")
                if v.get("dataPayload"):
                    dp = v["dataPayload"]
                    print(f"       Policy    : {dp.get('policyName','?')}")
                    slabs = dp.get('energySlabs', [])
                    if slabs:
                        print(f"       Slabs     : {len(slabs)}")
        else:
            print(f"  Callbacks not yet received")
            print(f"  (Check http://localhost:4040 for incoming requests)")

    except Exception:
        print(f"  (Server not running on :9000)")


# ── STEP 4: Our BPP Info ──────────────────────────────────────────────────────

def demo_our_bpp():
    step(4, "Our BPP — Serving Karnataka + Punjab Policies")
    print(f"  URL     : {OUR_BPP}")
    print(f"  BPP ID  : bpp.example.com")
    print(f"  Network : {NETWORK}")
    print()

    try:
        r = httpx.get("http://localhost:9000/api/tariff/policies", timeout=5)
        policies = r.json()
        print(f"  Policies served: {len(policies)}")
        for p in policies:
            slabs = len(p.get("energySlabs", []))
            print(f"    -> {p['policyID']:12} {p['policyName'][:40]}")
    except Exception:
        print("  (Start server: python -m uvicorn backend.main:app --port 9000)")


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    header("IES Bootcamp — Beckn Discovery Demo")
    print(f"  Network  : {NETWORK}")
    print(f"  Protocol : Beckn DDM v2.0")
    print(f"  Signing  : Ed25519")

    # Choose target
    print("\n  Available teams:")
    teams = list(TEAMS.keys())
    for i, t in enumerate(teams, 1):
        print(f"    {i}. {t}")

    choice = input("\n  Select team (1/2/3) or enter subscriber_id: ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(teams):
        target = teams[int(choice)-1]
    else:
        target = choice

    # STEP 1: Discover
    bpp_url = demo_dedi_lookup(target)
    if not bpp_url:
        print("\n  Cannot proceed — BPP not found")
        return

    # STEP 2-5: Beckn flow
    flow = demo_beckn_flow(bpp_url, target)

    # STEP 3: Callbacks
    demo_callbacks(flow["txn_id"])

    # STEP 4: Our BPP
    demo_our_bpp()

    # Summary
    header("DEMO COMPLETE")
    all_ok = all(v == "ACK" for v in flow["results"].values())
    print(f"  Target BPP   : {target}")
    print(f"  Discovery    : DeDi lookup + fallback")
    print(f"  Beckn Flow   : select -> init -> confirm -> status")
    print(f"  All ACK      : {'YES' if all_ok else 'NO'}")
    print(f"  Our BPP URL  : {OUR_BPP}")
    line()


if __name__ == "__main__":
    main()
