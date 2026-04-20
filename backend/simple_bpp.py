"""
Simple BPP — serves tariff policies to GNA team
No ONIX needed, direct HTTP
Run: python simple_bpp.py
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import json, requests, uuid, sys, threading
from datetime import datetime, timezone
from pathlib import Path

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle each request in a new thread."""
    pass

# GNA's callback URL
BAP_URI = "https://igloo-reproach-pushover.ngrok-free.dev/bap/receiver"

# Load our tariff policies
POLICIES_FILE = Path(__file__).parent.parent / "tariff" / "policies.jsonld"
with open(POLICIES_FILE, encoding="utf-8") as f:
    POLICIES = json.load(f)

print(f"Loaded {len(POLICIES)} policies:")
for p in POLICIES:
    print(f"  {p['policyID']} - {p['policyName']}")


def make_hash(data):
    import hashlib
    s = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(s.encode()).hexdigest()


class TariffBPP(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_POST(self):
        n      = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(n))
        ctx    = body.get("context", {})
        action = ctx.get("action", "")
        txn_id = ctx.get("transactionId") or ctx.get("transaction_id", str(uuid.uuid4()))
        bap_id = ctx.get("bapId") or ctx.get("bap_id", "")
        bpp_id = ctx.get("bppId") or ctx.get("bpp_id", "bpp.example.com")
        bpp_uri= ctx.get("bppUri") or ctx.get("bpp_uri", "")

        print(f"\n  Received: {action} from {bap_id} | TXN: {txn_id[:8]}")

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Build inline contract to include in the ACK response
        inline_contract = None
        if action == "confirm":
            inline_contract = {
                "id": "contract-tariff-001",
                "status": {"code": "ACTIVE"},
                "commitments": [
                    {"id": f"commitment-{p['policyID']}",
                     "status": {"descriptor": {"code": "ACTIVE"}},
                     "commitmentAttributes": {
                         "dataset:accessMethod": "INLINE",
                         "dataset:payloadHash": make_hash(p),
                         "dataPayload": p
                     }}
                    for p in POLICIES
                ]
            }
        elif action == "status":
            inline_contract = {
                "id": "contract-tariff-001",
                "status": {"code": "ACTIVE"},
                "performance": [{
                    "id": "perf-001",
                    "status": {"code": "DELIVERY_COMPLETE"},
                    "performanceAttributes": {
                        "dataset:accessMethod": "INLINE",
                        "dataset:payloadHash": make_hash(POLICIES),
                        "dataPayload": POLICIES
                    }
                }]
            }

        # ACK immediately — include contract inline for BAPs that read the body
        ack_body = {"message": {"ack": {"status": "ACK"}}}
        if inline_contract:
            ack_body["message"]["contract"] = inline_contract

        ack_bytes = json.dumps(ack_body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(ack_bytes)))
        self.end_headers()
        self.wfile.write(ack_bytes)

        def make_ctx(on_action):
            return {
                "networkId":     "nfh.global/testnet-deg",
                "version":       "2.0.0",
                "action":        on_action,
                "bapId":         bap_id,
                "bapUri":        BAP_URI,
                "bppId":         "bpp.example.com",
                "bppUri":        "https://appraiser-mascot-possible.ngrok-free.dev/bpp/receiver",
                "transactionId": txn_id,
                "messageId":     str(uuid.uuid4()),
                "timestamp":     now,
            }

        # Send callbacks in background thread (don't block ACK response)
        threading.Thread(target=self._send_callback, args=(action, make_ctx, txn_id, bap_id), daemon=True).start()

    def _send_callback(self, action, make_ctx, txn_id, bap_id):
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        def ctx(a): return make_ctx(a)

        # on_select — send catalog
        if action == "select":
            on_select = {
                "context": make_ctx("on_select"),
                "message": {"contract": {
                    "id": "contract-tariff-001",
                    "status": {"code": "DRAFT"},
                    "commitments": [
                        {"id": f"commitment-{p['policyID']}",
                         "status": {"descriptor": {"code": "DRAFT"}},
                         "resources": [{"id": f"ds-{p['policyID'].lower()}",
                                        "descriptor": {"name": p["policyName"]},
                                        "quantity": {"unitText": "policy", "unitCode": "EA", "value": "1"}}],
                         "offer": {"id": f"offer-{p['policyID'].lower()}",
                                   "descriptor": {"name": p["policyName"]},
                                   "resourceIds": [f"ds-{p['policyID'].lower()}"]}}
                        for p in POLICIES
                    ]
                }}
            }
            _send(BAP_URI, "on_select", on_select)

        # on_init — activate contract
        elif action == "init":
            on_init = {
                "context": make_ctx("on_init"),
                "message": {"contract": {
                    "id": "contract-tariff-001",
                    "status": {"code": "ACTIVE"},
                    "commitments": []
                }}
            }
            _send(BAP_URI, "on_init", on_init)

        # on_confirm — send policy data
        elif action == "confirm":
            on_confirm = {
                "context": make_ctx("on_confirm"),
                "message": {"contract": {
                    "id": "contract-tariff-001",
                    "status": {"code": "ACTIVE"},
                    "commitments": [
                        {"id": f"commitment-{p['policyID']}",
                         "status": {"descriptor": {"code": "ACTIVE"}},
                         "commitmentAttributes": {
                             "dataset:accessMethod": "INLINE",
                             "dataset:payloadHash": make_hash(p),
                             "dataPayload": p
                         }}
                        for p in POLICIES
                    ]
                }}
            }
            _send(BAP_URI, "on_confirm", on_confirm)

        # on_status — send ALL policies
        elif action == "status":
            on_status = {
                "context": make_ctx("on_status"),
                "message": {"contract": {
                    "id": "contract-tariff-001",
                    "status": {"code": "ACTIVE"},
                    "performance": [{
                        "id": "perf-001",
                        "status": {"code": "DELIVERY_COMPLETE"},
                        "performanceAttributes": {
                            "dataset:accessMethod": "INLINE",
                            "dataset:payloadHash": make_hash(POLICIES),
                            "dataPayload": POLICIES
                        }
                    }]
                }}
            }
            _send(BAP_URI, "on_status", on_status)


def _send(bap_uri, on_action, payload):
    """Try multiple callback paths."""
    paths = [
        f"{bap_uri}/{on_action}",   # /bap/receiver/on_status
        f"{bap_uri}",               # /bap/receiver
        f"{bap_uri.replace('/bap/receiver', '/api/bap-webhook')}/{on_action}",  # /api/bap-webhook/on_status
    ]
    for url in paths:
        try:
            r = requests.post(url, json=payload, timeout=8)
            print(f"  Sent {on_action} → {url} → {r.status_code}")
            if r.status_code == 200:
                return
        except Exception as e:
            print(f"  Failed {url}: {str(e)[:40]}")


if __name__ == "__main__":
    PORT = 8090
    print(f"\nTariff BPP running on port {PORT}")
    print(f"Serving {len(POLICIES)} policies to GNA")
    print(f"BAP callback: {BAP_URI}")
    print(f"\nTell GNA to call:")
    print(f"  bpp_uri: http://YOUR_IP:{PORT}")
    print(f"  Or expose with: ngrok http {PORT}\n")
    ThreadedHTTPServer(("", PORT), TariffBPP).serve_forever()
