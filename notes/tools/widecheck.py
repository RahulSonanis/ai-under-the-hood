"""Open every <details> in every chapter at 390 px and report pages wider than the viewport."""
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 390, "height": 900})
        await pg.goto("file:///home/claude/ai-under-the-hood/docs/index.html"); await pg.wait_for_timeout(800)
        ids = await pg.evaluate("[...document.querySelectorAll('section.chapter')].map(s=>s.id)")
        for i in ids:
            await pg.evaluate(f"location.hash='{i}'"); await pg.wait_for_timeout(900)
            await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); await pg.wait_for_timeout(300)
            w = await pg.evaluate("document.documentElement.scrollWidth")
            wide = await pg.evaluate("""(()=>{const s=document.getElementById(location.hash.slice(1));return [...s.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>392&&getComputedStyle(e).position!=='fixed').slice(0,3).map(e=>e.className||e.tagName)})()""")
            if w > 392 or wide: print(i, w, wide)
        await b.close()
asyncio.run(main())
