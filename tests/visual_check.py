from pathlib import Path
from playwright.sync_api import sync_playwright

checks = [
    ("/cuhksz/", "港中深资源站", ".hero"),
    ("/cuhksz/map/", "校园地图", ".map-layout"),
    ("/cuhksz/checklist/", "入学清单", ".sl-markdown-content"),
    ("/cuhksz/material/", "重要资料", ".sl-markdown-content"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    for path, expected_title, selector in checks:
        response = page.goto(f"http://127.0.0.1:4321{path}")
        page.wait_for_load_state("networkidle")
        assert response and response.ok, f"页面无法访问: {path}"
        assert expected_title in page.title(), f"标题异常: {path}"
        assert page.locator(selector).count() == 1, f"缺少关键区域: {path}"
        if path == "/cuhksz/":
            assert page.locator("a[href='/cuhksz/map/']").count() >= 1
        if path == "/cuhksz/checklist/":
            assert "证件档案类物品" in page.locator("main").inner_text()
        if path == "/cuhksz/map/":
            assert page.locator("iframe").count() == 0
            assert page.locator(".vr-preview").count() == 1
        if path == "/cuhksz/material/":
            image = page.locator("main img").first
            assert image.evaluate("element => element.complete && element.naturalWidth > 0")
    page.goto("http://127.0.0.1:4321/cuhksz/")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/cuhksz-home.png", full_page=True)
    browser.close()
    assert not errors, "浏览器控制台错误: " + " | ".join(errors)
print("4 个核心页面通过浏览器验收，控制台无错误")
