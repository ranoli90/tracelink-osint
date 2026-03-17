#!/usr/bin/env python3
"""
Fetch Render logs for the OSINT/spiderfoot service and print them to stdout.
"""

import os
import sys
import time
import json
from datetime import datetime, timedelta, timezone

import requests


BASE_URL = "https://api.render.com/v1"


def get_api_key_and_owner():
    api_key = os.getenv("RENDER_API_KEY")
    owner_id = os.getenv("RENDER_OWNER_ID")

    if not api_key or not owner_id:
        print(
            json.dumps(
                {
                    "error": "missing_render_credentials",
                    "detail": "RENDER_API_KEY and RENDER_OWNER_ID must be set in environment",
                }
            ),
            file=sys.stderr,
        )
        sys.exit(1)

    return api_key, owner_id


def get_headers(api_key: str):
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def find_osint_services(headers):
    resp = requests.get(f"{BASE_URL}/services", headers=headers)
    resp.raise_for_status()
    services = resp.json()

    osint_services = []
    for s in services:
        # API may return either flat objects or nested under 'service'
        data = s.get("service") if isinstance(s, dict) and "service" in s else s
        name = data.get("name", "")
        if not name:
            continue
        # include only OSINT/spiderfoot services, exclude jobhuntin variants
        lname = name.lower()
        if "spiderfoot" in lname or "osint" in lname:
            if "jobhunt" in lname or "job-hunt" in lname or "jobhuntin" in lname:
                continue
            osint_services.append(data)

    return osint_services


def fetch_logs_for_service(headers, owner_id: str, service_id: str, hours: int = 168):
    """
    Fetch logs for a single service for the last `hours` hours.
    Uses pagination via hasMore/nextStartTime/nextEndTime if available.
    Note: Render's public docs don't expose a deploy-scoped filter, so we use
    a wide time window to include failing + recovery deploys.
    """
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)

    all_logs = []
    cur_start = start_time
    cur_end = end_time

    while True:
        params = {
            "ownerId": owner_id,
            "startTime": cur_start.isoformat().replace("+00:00", "Z"),
            "endTime": cur_end.isoformat().replace("+00:00", "Z"),
            "limit": 1000,
        }
        r = requests.get(f"{BASE_URL}/logs", headers=headers, params=params)
        if r.status_code != 200:
            print(
                json.dumps(
                    {
                        "serviceId": service_id,
                        "error": "log_fetch_failed",
                        "status": r.status_code,
                        "body": r.text[:2000],
                    }
                ),
                file=sys.stderr,
            )
            break

        payload = r.json()
        logs = payload.get("logs", [])
        all_logs.extend(logs)

        if not payload.get("hasMore"):
            break

        next_start = payload.get("nextStartTime")
        next_end = payload.get("nextEndTime")
        if not next_start or not next_end:
            break

        # API returns RFC3339 timestamps
        try:
            cur_start = datetime.fromisoformat(next_start.replace("Z", "+00:00"))
            cur_end = datetime.fromisoformat(next_end.replace("Z", "+00:00"))
        except Exception:
            break
        # avoid hammering API
        time.sleep(0.2)

    return all_logs


def main():
    api_key, owner_id = get_api_key_and_owner()
    headers = get_headers(api_key)

    try:
        services = find_osint_services(headers)
    except Exception as e:
        print(json.dumps({"error": "service_discovery_failed", "detail": str(e)}))
        sys.exit(1)

    if not services:
        print(json.dumps({"error": "no_osint_services_found"}))
        sys.exit(1)

    result = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "ownerId": owner_id,
        "services": [],
    }

    for svc in services:
        sid = svc.get("id")
        name = svc.get("name")
        logs = fetch_logs_for_service(headers, owner_id, sid)
        result["services"].append(
            {
                "id": sid,
                "name": name,
                "logCount": len(logs),
                "logs": logs,
            }
        )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

