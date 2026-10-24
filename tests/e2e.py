"""Browser acceptance tests. Run preview, then python3 tests/e2e.py.

Requires the optional Python Playwright package and a Chromium browser.
Uses a fresh browser context; existing personal records are never modified.
"""

import argparse
import json
import os
import shutil
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default=os.environ.get("E2E_BASE_URL", "http://localhost:4173/90day-fitness/"))
BASE = parser.parse_args().base_url
RESULTS = Path(__file__).resolve().parents[1] / "test-results"
KEY = "90day-fitness:v1"


def run():
    RESULTS.mkdir(exist_ok=True)
    checks = []
    errors = []
    with sync_playwright() as playwright:
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=executable,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1100}, accept_downloads=True)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))

        def action(name):
            return page.locator(f'[data-action="{name}"]').first

        def nav(name):
            page.locator(f'nav [data-page="{name}"]').click()

        def stored():
            return page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)

        page.goto(BASE)
        expect(page.get_by_role("heading", level=1)).to_contain_text("今天也向前一点")
        action("profile").click()
        form = page.locator("#profile-form")
        form.locator('[name="name"]').fill("测试伙伴")
        for key, value in {"age": "30", "height": "170", "weight": "75", "targetWeight": "68"}.items():
            form.locator(f'[name="{key}"]').fill(value)
        form.locator('button[type="submit"]').click()
        expect(page.locator("#profile-form")).to_have_count(0)
        assert stored()["profile"]["name"] == "测试伙伴"
        checks.append("create personalized plan")

        action("water").click()
        date = page.evaluate("new Date().toLocaleDateString('en-CA')")
        assert stored()["records"][date]["water"] == 250
        nav("nutrition")
        action("meal").click()
        form = page.locator("#meal-form")
        form.locator('[name="name"]').fill("鸡肉杂粮饭")
        form.locator('[name="meal"]').select_option("lunch")
        form.locator('[name="calories"]').fill("520")
        form.locator('[name="protein"]').fill("32.5")
        form.locator('button[type="submit"]').click()
        expect(page.locator(".meal-item")).to_contain_text("鸡肉杂粮饭")
        assert stored()["records"][date]["meals"][0]["protein"] == 32.5
        checks.append("water and nutrition records")

        nav("progress")
        action("measurement").click()
        form = page.locator("#measurement-form")
        for key, value in {"weight": "74.5", "waist": "85", "steps": "8000", "sleep": "7.5", "notes": "今天精神很好"}.items():
            form.locator(f'[name="{key}"]').fill(value)
        form.locator('button[type="submit"]').click()
        expect(page.locator("tbody")).to_contain_text("74.5 kg")
        expect(page.locator("tbody")).to_contain_text("今天精神很好")
        assert stored()["records"][date]["sleep"] == 7.5
        checks.append("body measurements and trends")

        nav("plan")
        expect(page.locator(".day-card")).to_have_count(30)
        page.locator('[data-action="phase"][data-phase="3"]').click()
        expect(page.locator(".day-card").first).to_have_attribute("data-day", "61")
        action("workout").click()
        expect(action("complete")).to_be_disabled()
        action("close-modal").click()
        page.locator('[data-action="phase"][data-phase="1"]').click()
        page.locator('[data-action="select-day"][data-day="1"]').click()
        action("workout").click()
        initial_time = page.locator("#timer-time").inner_text()
        action("timer-toggle").click()
        expect(page.locator("#timer-toggle")).to_contain_text("暂停")
        page.wait_for_timeout(1200)
        assert page.locator("#timer-time").inner_text() != initial_time
        action("timer-toggle").click()
        action("timer-next").click()
        expect(page.locator("#timer-count")).to_contain_text("步骤 2")
        action("complete").click()
        assert stored()["records"][date]["completed"] is True
        checks.append("90-day phase navigation, future-day protection, timer and check-in")

        page.reload()
        assert stored()["records"][date]["completed"] is True
        assert stored()["records"][date]["meals"][0]["name"] == "鸡肉杂粮饭"
        checks.append("records survive reload")

        nav("settings")
        with page.expect_download() as download_event:
            action("export").click()
        backup_path = RESULTS / "acceptance-backup.json"
        download_event.value.save_as(backup_path)
        backup = json.loads(backup_path.read_text())
        assert backup["records"][date]["water"] == 250
        before = stored()
        page.locator("#import-file").set_input_files({"name": "invalid.json", "mimeType": "application/json", "buffer": b'{"version":99}'})
        expect(page.locator("#toast")).to_contain_text("版本不兼容")
        assert stored() == before
        page.locator("#import-file").set_input_files(str(backup_path))
        expect(page.locator("#confirm-import")).to_be_visible()
        page.locator("#confirm-import").click()
        assert stored() == before
        checks.append("JSON export, valid restore and invalid-import protection")

        nav("today")
        page.screenshot(path=str(RESULTS / "desktop.png"), full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        nav("nutrition")
        expect(page.locator(".meal-item")).to_contain_text("鸡肉杂粮饭")
        page.screenshot(path=str(RESULTS / "mobile.png"), full_page=True)
        checks.append("mobile layout and navigation")

        page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null", timeout=15000)
        context.set_offline(True)
        page.reload()
        expect(page.get_by_role("heading", level=1)).to_be_visible()
        expect(page.locator("#connection-badge")).to_contain_text("离线模式")
        action("water").click()
        assert stored()["records"][date]["water"] == 500
        nav("progress")
        expect(page.locator("tbody")).to_contain_text("74.5 kg")
        context.set_offline(False)
        checks.append("offline app-shell reload, writing and navigation")
        assert not errors, f"Browser errors: {errors}"
        checks.append("no uncaught browser errors")
        browser.close()
    for check in checks:
        print(f"PASS {check}")
    print(f"{len(checks)} browser acceptance checks passed; screenshots: {RESULTS}")


if __name__ == "__main__":
    run()
