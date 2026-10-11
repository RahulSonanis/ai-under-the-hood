import asyncio, sys
from playwright.async_api import async_playwright
W, scheme = int(sys.argv[1]), sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": W, "height": 900}, color_scheme=scheme)
        errs = []; pg.on("pageerror", lambda e: errs.append(("page", str(e)))); pg.on("console", lambda m: errs.append(("console", m.text)) if m.type == "error" and "ERR_" not in m.text else None)
        await pg.goto("file:///home/claude/ai-under-the-hood/docs/index.html"); await pg.wait_for_timeout(800)
        ids = await pg.evaluate("[...document.querySelectorAll('section.chapter')].map(s=>s.id)")
        for i in ids:
            n = len(errs)
            await pg.evaluate(f"location.hash='{i}'"); await pg.wait_for_timeout(2500)
            y = await pg.evaluate("window.scrollY"); ov = await pg.evaluate("document.documentElement.scrollWidth > innerWidth")
            # exercise all controls
            await pg.evaluate("""() => { const s = document.getElementById(location.hash.slice(1)); s.querySelectorAll('.sim input[type=range]').forEach(r => { r.value = r.max; r.dispatchEvent(new Event('input', {bubbles:true})); }); s.querySelectorAll('.sim .seg button, .sim input[type=checkbox]').forEach(b => b.click()); }""")
            await pg.wait_for_timeout(2500)
            await pg.evaluate("""() => { const s = document.getElementById(location.hash.slice(1)); s.querySelectorAll('.sim input[type=range]').forEach(r => { r.value = r.min; r.dispatchEvent(new Event('input', {bubbles:true})); }); }""")
            await pg.wait_for_timeout(1500)
            print(i, "scrollY", y, "overflow", ov, "errors", errs[n:])
        await b.close()
asyncio.run(main())
