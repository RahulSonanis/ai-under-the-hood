"""pageshot.py <chapter> <width> <scheme> <wait>: full-page screenshot of a chapter (details opened) + a view at the sim"""
import asyncio, sys
from playwright.async_api import async_playwright
SP = "/tmp/claude-0/-home-claude-ai-under-the-hood/9f7e82d3-ea99-5405-a9bf-d9eb69cc2336/scratchpad/"
ch, W, scheme, wt = sys.argv[1], int(sys.argv[2]), sys.argv[3], float(sys.argv[4])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": W, "height": 1000}, color_scheme=scheme)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_" not in m.text else None)
        await pg.goto(f"file:///home/claude/ai-under-the-hood/docs/index.html#{ch}"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#%s .sim').scrollIntoView({block:'center'})" % ch); await pg.wait_for_timeout(int(wt * 1000))
        await pg.evaluate("document.querySelector('#%s .sim').scrollIntoView({block:'start'}); window.scrollBy(0,-80)" % ch); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SP}view-{ch}-{W}-{scheme}.png")
        await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        await pg.screenshot(path=f"{SP}page-{ch}-{W}-{scheme}.png", full_page=True)
        print("errors", errs); await b.close()
asyncio.run(main())
