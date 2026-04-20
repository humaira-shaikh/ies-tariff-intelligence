"""
Complete Beckn Flow Test — Discover -> Select -> Init -> Confirm -> Status
Run: python test_full_flow.py
"""
import asyncio, httpx, uuid, json, time

API      = "http://localhost:9000"
NETWORK  = "nfh.global/testnet-deg"

# Known BPPs (from chat / DeDi)
KNOWN_BPPS = {
    "flockenergy.tech":    "https://fa85-117-250-7-33.ngrok-free.app/bpp/receiver",
    "itconsultancy.tech":  "https://tab5-117-290-7-33.ngrok-free.app/bpp/receiver",
    "bpp.renewalytics.in": "https://comma-appendage-deacon.ngrok-free.dev/bpp/receiver",
    "our-bpp":             "https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver",
}


def separator(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print('='*55)


async def step1_discover(subscriber_id: str):
    separator(f"STEP 1: DeDi Discover — {subscriber_id}")

    async with httpx.AsyncClient(timeout=10) as c:
        # Try DeDi registry
        try:
            r = await c.post(
                "https://fabric.nfh.global/registry/dedi/lookup",
                json={"subscriber_id": subscriber_id, "network_id": NETWORK},
            )
            if r.status_code == 200 and r.json():
                print(f"  FOUND in DeDi!")
                print(f"  Data: {r.json()}")
                return r.json()[0].get("subscriber_url")
        except Exception as e:
            print(f"  DeDi unreachable: {e}")

    # Fallback to known BPPs
    if subscriber_id in KNOWN_BPPS:
        url = KNOWN_BPPS[subscriber_id]
        print(f"  DeDi: Not registered yet")
        print(f"  Fallback: Using URL from chat: {url}")
        return url

    print(f"  NOT FOUND anywhere")
    return None


async def step2_to_5_beckn(bpp_uri: str, bpp_id: str):
    separator(f"STEP 2-5: Beckn Flow -> {bpp_id}")

    r = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: httpx.post(
            f"{API}/api/tariff/fetch-external",
            json={"bpp_uri": bpp_uri, "bpp_id": bpp_id},
            timeout=60,
        )
    )
    result = r.json()

    print(f"\n  Transaction ID: {result['transactionId']}")
    print(f"  Our Callback  : {result['ourCallbackUrl']}")
    print()
    print("  Beckn Flow:")
    for step in result.get("becknFlow", []):
        icon   = "OK" if step["status"] == "ACK" else "XX"
        err    = f" -> {step['error']['message']}" if step.get("error") else ""
        print(f"    {icon} {step['action']:10} {step['status']}{err}")

    print()
    if result["policiesReceived"] > 0:
        print(f"  Policies received: {result['policiesReceived']}")
        for p in result["policies"]:
            print(f"    -> {p.get('policyName','?')} | slabs={len(p.get('energySlabs',[]))}")
    else:
        print(f"  No policy dataPayload (check /api/dashboard/bpp-responses)")

    return result


async def step6_check_callbacks(txn_id: str):
    separator("STEP 6: Callbacks Received")

    async with httpx.AsyncClient(timeout=5) as c:
        r = await c.get(f"{API}/api/dashboard/bpp-responses")
        data = r.json()

    found = {k: v for k, v in data["responses"].items() if txn_id[:8] in k}
    print(f"  Total callbacks stored: {data['total']}")

    for key, v in found.items():
        print(f"\n  {v['action'].upper():15} contract={v['contractId']} status={v['status']}")
        if v.get("dataPayload"):
            p = v["dataPayload"]
            name   = p.get("policyName") or p.get("reportName") or "?"
            slabs  = len(p.get("energySlabs", []))
            print(f"    dataPayload: {name}" + (f" | {slabs} slabs" if slabs else ""))
        if v.get("perfPayload"):
            pp     = v["perfPayload"]
            rtype  = pp.get("@type", "?")
            rname  = pp.get("reportName") or pp.get("policyName") or "?"
            print(f"    perfPayload: {rtype} — {rname}")


async def main():
    print("\n  IES Bootcamp — Full Beckn Discovery + Flow Test")
    print(f"  Network: {NETWORK}\n")

    # Choose target
    TARGET = "bpp.renewalytics.in"

    # STEP 1: Discover
    bpp_url = await step1_discover(TARGET)
    if not bpp_url:
        print("  Cannot proceed — BPP not found")
        return

    # STEPS 2-5: Beckn lifecycle
    result = await step2_to_5_beckn(bpp_url, TARGET)

    # STEP 6: Show callbacks
    await step6_check_callbacks(result["transactionId"])

    separator("SUMMARY")
    print(f"  BPP              : {TARGET}")
    print(f"  URL              : {bpp_url}")
    print(f"  Beckn Flow       : select->init->confirm->status")
    all_ack = all(s["status"]=="ACK" for s in result.get("becknFlow",[]))
    print(f"  All ACK          : {'YES' if all_ack else 'NO'}")
    print(f"  Policies fetched : {result['policiesReceived']}")
    print(f"  Our BPP URL      : https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver")
    print()


if __name__ == "__main__":
    asyncio.run(main())
