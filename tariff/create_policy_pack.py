"""
Policy Pack Creator — Interactive Tool
Run: python create_policy_pack.py

Creates Program + Policy JSON files for IES Tariff Intelligence.
"""
import json, uuid
from datetime import datetime, timezone
from pathlib import Path

OUT_DIR = Path(__file__).parent
NOW     = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ask(prompt, default=None):
    if default:
        val = input(f"  {prompt} [{default}]: ").strip()
        return val or default
    val = input(f"  {prompt}: ").strip()
    return val


def ask_float(prompt, default=None):
    while True:
        try:
            raw = ask(prompt, str(default) if default else None)
            return float(raw)
        except ValueError:
            print("  [!] Number enter karo")


def create_program():
    print("\n=== PROGRAM (Scheme) ===")
    state  = ask("State code (e.g. PB, MH, KA, HR)").upper()
    type_  = ask("Type (e.g. domestic, commercial, industrial, agricultural)")
    year   = ask("FY Year (e.g. 202526)", "202526")
    name   = ask("Program name (e.g. Punjab Domestic Supply FY2025-26)")
    desc   = ask("Description")

    prog_id = f"prog-{state.lower()}-{type_[:3].lower()}-fy{year}"

    program = {
        "@context": "../specs/context.jsonld",
        "id":       prog_id,
        "objectType": "PROGRAM",
        "@type":    "PROGRAM",
        "createdDateTime":      NOW,
        "modificationDateTime": NOW,
        "programName":         name,
        "programDescriptions": [desc]
    }

    fname = f"prog-{state.lower()}-{type_[:2].lower()}-fy{year}.json"
    with open(OUT_DIR / fname, "w") as f:
        json.dump(program, f, indent=2)

    print(f"\n  Saved: {fname}")
    print(f"  Program ID: {prog_id}")
    return prog_id, fname


def create_slabs():
    slabs  = []
    print("\n  Energy Slabs (enter karo, blank = done):")
    print("  Example: 0-100 units = Rs.4.5/kWh")

    start = 0
    i     = 1
    while True:
        print(f"\n  Slab {i}:")
        end_raw = ask(f"    End units (blank = infinity/last slab)", "")
        price   = ask_float(f"    Price (Rs/kWh)")

        end = None if not end_raw else int(end_raw)
        slabs.append({
            "id":     f"s{i}",
            "start":  start,
            "end":    end,
            "price":  price,
            "@type":  "EnergySlab"
        })

        if end is None:
            break

        start = end + 1
        i    += 1
        more  = ask("    Add another slab? (y/n)", "y")
        if more.lower() != "y":
            # Make last slab go to infinity
            slabs[-1]["end"] = None
            break

    return slabs


def create_surcharges():
    surcharges = []
    print("\n  Surcharges / ToD (blank = skip):")

    while True:
        print(f"\n  Surcharge {len(surcharges)+1}:")
        sid = ask("    ID (e.g. peak-surcharge, night-rebate, fuel-surcharge, blank=done)", "")
        if not sid:
            break

        unit_options = "PERCENT / INR_PER_KWH"
        unit  = ask(f"    Unit ({unit_options})", "PERCENT")
        value = ask_float("    Value (negative = discount, e.g. -10 for 10% off)")

        print("    Time window (leave blank for all-day):")
        start_t  = ask("    Start time (e.g. T18:00:00Z)", "T00:00:00Z")
        duration = ask("    Duration (e.g. PT4H, PT8H, PT24H)", "PT24H")
        recur    = ask("    Recurrence (P1D=daily, P1M=monthly)", "P1M")

        surcharges.append({
            "id":         sid,
            "@type":      "SurchargeTariff",
            "recurrence": recur,
            "interval":   {"start": start_t, "duration": duration},
            "value":      value,
            "unit":       unit.upper()
        })

        more = ask("    Add another surcharge? (y/n)", "n")
        if more.lower() != "y":
            break

    return surcharges


def create_policy(prog_id):
    print("\n=== POLICY (Rate Card) ===")

    pid   = ask("Policy ID (e.g. PB-DOM-1, MH-COM-2)")
    name  = ask("Policy name (e.g. Punjab Domestic <=2kW FY2025-26)")
    slabs = create_slabs()
    surcharges = create_surcharges()

    policy = {
        "@context": "https://raw.githubusercontent.com/beckn/DEG/ies-specs/specification/external/schema/ies/core/context.jsonld",
        "id":       f"policy-{pid.lower().replace('-','_')}-fy202526",
        "objectType": "POLICY",
        "@type":    "POLICY",
        "createdDateTime":      NOW,
        "modificationDateTime": NOW,
        "programID":    prog_id,
        "policyID":     pid,
        "policyName":   name,
        "policyType":   "TARIFF",
        "samplingInterval": f"R/{NOW}/P1M",
        "energySlabs":       slabs,
        "surchargeTariffs":  surcharges
    }

    safe_pid = pid.lower().replace("-","_")
    fname    = f"policy-{safe_pid}-fy202526.json"
    with open(OUT_DIR / fname, "w") as f:
        json.dump(policy, f, indent=2)

    print(f"\n  Saved: {fname}")
    return policy, fname


def add_to_master(prog_id, policies_data):
    """Add new policies to policies.jsonld"""
    master = OUT_DIR / "policies.jsonld"
    with open(master) as f:
        existing = json.load(f)

    # Avoid duplicates
    existing_ids = {p["policyID"] for p in existing}
    added        = []

    for p in policies_data:
        if p["policyID"] not in existing_ids:
            existing.append(p)
            added.append(p["policyID"])

    with open(master, "w") as f:
        json.dump(existing, f, indent=2)

    return added


def main():
    print("=" * 50)
    print("  IES Policy Pack Creator")
    print("=" * 50)

    # Step 1: Program
    prog_id, prog_file = create_program()

    # Step 2: Policies
    policies_data = []
    while True:
        pol, pol_file = create_policy(prog_id)
        policies_data.append(pol)

        more = ask("\nAdd another policy to this program? (y/n)", "n")
        if more.lower() != "y":
            break

    # Step 3: Add to master
    add_choice = ask("\nAdd to policies.jsonld (serve via BPP)? (y/n)", "y")
    if add_choice.lower() == "y":
        added = add_to_master(prog_id, policies_data)
        print(f"\n  Added to policies.jsonld: {added}")

    # Summary
    print("\n" + "=" * 50)
    print("  POLICY PACK CREATED!")
    print("=" * 50)
    print(f"  Program : {prog_file}")
    for p in policies_data:
        safe = p["policyID"].lower().replace("-","_")
        print(f"  Policy  : policy-{safe}-fy202526.json")
    print(f"\n  Restart server to load new policies:")
    print(f"  BPP will serve them automatically!")
    print("=" * 50)


if __name__ == "__main__":
    main()
