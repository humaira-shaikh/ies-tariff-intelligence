"""
IES Bootcamp — FastAPI Backend
Port 9000: matches ONIX BAP callback config (routing-BAPReceiver.yaml)

Endpoints:
  POST /callback / /callback/{action}  ← ONIX BAP delivers on_* here
  GET  /api/dashboard/summary
  GET  /api/filing/list
  POST /api/filing/create
  GET  /api/tariff/policies
  GET  /api/tariff/fetch              ← full Beckn lifecycle
  POST /api/tariff/calculate

Run:
  cd C:\\ies-bootcamp\\backend
  python -m uvicorn main:app --port 9000 --reload
"""
import asyncio
import sys
from pathlib import Path

# Make `backend` importable when running from inside the backend/ dir
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.services import beckn
from backend.routers import callback, filing, tariff, dashboard, bpp, rde_consume, edx_consume

app = FastAPI(title="IES Bootcamp API", version="1.0.0")

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(callback.router)
app.include_router(filing.router)
app.include_router(tariff.router)
app.include_router(dashboard.router)
app.include_router(bpp.router)
app.include_router(rde_consume.router)
app.include_router(edx_consume.router)


@app.on_event("startup")
async def startup():
    """Give the Beckn service a reference to the running event loop."""
    beckn.set_event_loop(asyncio.get_event_loop())
    print("\n IES Bootcamp API running on port 9000")
    print("  BAP callback   : POST /callback")
    print("  BPP receiver   : POST /bpp/receiver/{select|init|confirm|status}")
    print("  Beckn gateway  : http://localhost:4030")
    print("  React frontend : http://localhost:5173\n")


@app.get("/health")
def health():
    return {"status": "ok", "port": 9000}
