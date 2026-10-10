"""simshot.py <chapter> <sim-id> <width> <scheme> [seconds=6] [actions]
Loads a chapter, lets the simulation run, optionally applies actions, screenshots the whole chapter
viewport around the sim. actions: comma list of  set:control=value | click:control | tour | wait:N | shot:name"""
import asyncio, sys
from playwright.async_api import async_playwright
SP = "/tmp/claude-0/-home-claude-ai-under-the-hood/9f7e82d3-ea99-5405-a9bf-d9eb69cc2336/scratchpad/"
ch, sid, W, scheme = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
secs = float(sys.argv[5]) if len(sys.argv) > 5 else 6
acts = sys.argv[6].split(",") if len(sys.argv) > 6 else []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": W, "height": 1400}, color_scheme=scheme)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "ERR_" not in m.text else None)
        await pg.goto(f"file:///home/claude/ai-under-the-hood/docs/index.html#{ch}"); await pg.wait_for_timeout(800)
        el = await pg.query_selector(f"#{sid}"); await el.scroll_into_view_if_needed()
        await pg.wait_for_timeout(int(secs * 1000))
        n = 0
        for a in acts:
            if a.startswith("set:"):
                cid, v = a[4:].split("=")
                await pg.evaluate(f"document.getElementById('{sid}')._sim.set('{cid}', isNaN(+'{v}') ? ('{v}' === 'true' ? true : '{v}' === 'false' ? false : '{v}') : +'{v}')")
            elif a.startswith("click:"):
                await pg.click(f"#{sid}-{a[6:]}")
            elif a == "tour":
                await pg.click(f"#{sid} [data-a=tour]")
            elif a.startswith("wait:"):
                await pg.wait_for_timeout(int(float(a[5:]) * 1000))
            elif a.startswith("shot:"):
                await el.screenshot(path=f"{SP}sim-{sid}-{a[5:]}-{W}-{scheme}.png"); n += 1
        if n == 0: await el.screenshot(path=f"{SP}sim-{sid}-end-{W}-{scheme}.png")
        print(sid, "errors", errs)
        await b.close()
asyncio.run(main())
