"""Warm the public kingdom map through its normal UI before importing the API.

No account cookies, API credentials, private endpoints or anti-bot workarounds.
"""
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import time

MAP_URL = "https://mightpulse.com/map?kid=2399"
WAIT_SECONDS = 300
REPORT_PATH = Path("artifacts/mightpulse-map/report.json")


class MapRefreshError(ValueError):
    pass


def guard(page):
    text = page.locator("body").inner_text()
    if re.search(r"verify (?:that )?you are human|checking your browser|captcha|access denied|unusual traffic", text, re.I):
        raise MapRefreshError("MightPulse requires verification; no bypass was attempted.")


def location_age_seconds(text):
    match = re.search(r"last location update\s*(.*?)\s*last shield update", text, re.I | re.S)
    if not match:
        return None
    value = match[1].strip().lower()
    if value in {"just now", "now"}:
        return 0
    parts = re.findall(r"(\d+)\s*(days?|d|hours?|h|minutes?|m|seconds?|s)\b", value)
    if not parts:
        return None
    factors = {"d": 86400, "h": 3600, "m": 60, "s": 1}
    return sum(int(number) * factors[unit[0]] for number, unit in parts)


def warm_map(page, pause=time.sleep, clock=time.monotonic):
    response = page.goto(MAP_URL, wait_until="domcontentloaded", timeout=60000)
    if response is None or response.status >= 400:
        raise MapRefreshError("MightPulse map could not be opened.")
    guard(page)
    page.locator("#mapOverlay").wait_for(state="hidden", timeout=60000)
    button = page.locator("#btnUpdateMap")
    button.wait_for(state="visible", timeout=30000)
    before = page.locator("#mapFreshness").inner_text()
    label = button.inner_text().strip()
    action = "existing refresh or cooldown"
    if button.is_enabled() and "ready" in label.lower():
        button.click()
        action = "Update Map clicked"
    # Keep the browser page alive throughout the requested five minutes.
    started = clock()
    deadline = started + WAIT_SECONDS
    while clock() < deadline:
        pause(min(30, deadline - clock()))
        guard(page)
    after = page.locator("#mapFreshness").inner_text()
    final_label = button.inner_text().strip()
    banner = page.locator("#mapUpdateBanner")
    banner_text = banner.inner_text() if banner.is_visible() else ""
    report = {"url": MAP_URL, "checked_at": datetime.now(timezone.utc).isoformat(),
              "action": action, "waited_seconds": round(clock() - started),
              "before": before, "after": after, "button": final_label, "banner": banner_text}
    if re.search(r"queued|updating|waiting to start|in progress|refreshing", final_label + " " + banner_text, re.I):
        raise MapRefreshError("Kingdom refresh is still pending after five minutes; API import skipped.")
    if re.search(r"error|failed|try again|denied|blocked", final_label + " " + banner_text, re.I):
        raise MapRefreshError("MightPulse reported a refresh error; API import skipped.")
    if re.search(r"last location update\s*[—–-]\s*(?:last shield update|$)", after, re.I):
        raise MapRefreshError("MightPulse did not provide a location freshness time; API import skipped.")
    age = location_age_seconds(after)
    maximum_age = 600 if action == "Update Map clicked" else 1800
    if age is None or age > maximum_age:
        raise MapRefreshError("Map location data is not confirmed recent; API import skipped.")
    return report


def main():
    from playwright.sync_api import sync_playwright
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                page = browser.new_page(locale="en-US")
                report = warm_map(page)
                page.screenshot(path=str(REPORT_PATH.with_name("map.png")))
            finally:
                browser.close()
        REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")
        print("Kingdom map preflight complete; five-minute wait finished.")
        print(report["after"])
        return 0
    except MapRefreshError as error:
        REPORT_PATH.write_text(json.dumps({"error": str(error), "url": MAP_URL}, indent=2) + "\n")
        print(str(error), file=sys.stderr)
    except Exception:
        REPORT_PATH.write_text(json.dumps({"error": "Map browser preflight failed", "url": MAP_URL}) + "\n")
        print("Map browser preflight failed; API import skipped. Check the map manually.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
