"""Load JSON/JSONLD data files."""
import json
from functools import lru_cache
from pathlib import Path

_ROOT = Path(__file__).parent.parent.parent

@lru_cache
def load_arr_filings() -> list:
    with open(_ROOT / "filing" / "arr_filings.jsonld", encoding="utf-8") as f:
        return json.load(f)

@lru_cache
def load_policies() -> list:
    with open(_ROOT / "tariff" / "policies.jsonld", encoding="utf-8") as f:
        return json.load(f)

@lru_cache
def load_programs() -> list:
    with open(_ROOT / "tariff" / "programs.jsonld", encoding="utf-8") as f:
        return json.load(f)
