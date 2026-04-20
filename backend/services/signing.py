"""
Beckn Ed25519 request signing.
Keys loaded from backend/.env — never hardcode secrets in source.
"""
import base64
import hashlib
import json
import os
import time
from nacl.signing import SigningKey
from dotenv import load_dotenv

load_dotenv()

SUBSCRIBER_ID   = os.getenv("BECKN_SUBSCRIBER_ID", "bap.example.com")
KEY_ID          = os.getenv("BECKN_KEY_ID", "")
PRIVATE_KEY_B64 = os.getenv("BECKN_PRIVATE_KEY", "")

_signing_key = SigningKey(base64.b64decode(PRIVATE_KEY_B64))


def _digest(body: dict) -> str:
    raw    = json.dumps(body, separators=(",", ":")).encode()
    digest = hashlib.blake2b(raw, digest_size=64).digest()
    return "BLAKE-512=" + base64.b64encode(digest).decode()


def make_auth_header(body: dict, expires_in: int = 300) -> str:
    """
    Build Beckn Authorization header with Ed25519 signature.
    """
    created = int(time.time())
    expires = created + expires_in
    digest  = _digest(body)

    signing_string = (
        f"(created): {created}\n"
        f"(expires): {expires}\n"
        f"digest: {digest}"
    )

    signed    = _signing_key.sign(signing_string.encode())
    signature = base64.b64encode(signed.signature).decode()

    return (
        f'Signature keyId="{SUBSCRIBER_ID}|{KEY_ID}|ed25519",'
        f'algorithm="ed25519",'
        f'created="{created}",'
        f'expires="{expires}",'
        f'headers="(created) (expires) digest",'
        f'signature="{signature}"'
    )
