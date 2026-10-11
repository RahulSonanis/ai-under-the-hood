# AI Under the Hood

**What really happens when you talk to an AI?** An interactive course you *play*. It starts with you pressing send and follows that moment all the way down: tokens, the model, the GPU serving your reply, what it costs, the datacenter underneath, the months of training before it, and the software that turns a model into an agent.

Every chapter is built around **one live simulation you drive**. Controls change it in real time, there is a goal to reach, the simulation tells you what just happened and why, a "Show me" tour can take over, and fun facts unlock as you explore. Then one short explanation for everyone, with optional "How it works" and "The maths" (in words, then with your own numbers, then in symbols). Every claim links to a primary source.

## The course

| Part | Chapter | Your goal in the simulation |
|---|---|---|
| **1 · How a model answers** | 1. What happens when you press send? | Get the first word of a 20-page report's summary on screen in under a second |
| | 2. How does text become numbers? | Train a tokenizer until "strawberry" is a single token |
| | 3. How does it pick the next word? | Write 40 words at high temperature without nonsense |
| | 4. How does it understand what "it" refers to? | Find the word where the model decides who "it" is |
| | 5. What do "thinking" models do differently? | Get 8 of 10 hard problems right without slow answers |
| | 6. How can a chatbot see a photo? | Read a pill bottle's label using 300 tokens or fewer |
| **2 · Serving millions** | 7. Why do long chats get slower and pricier? | Keep 30 people chatting on one GPU with nobody waiting |
| | 8. How does one GPU serve many people at once? | Serve 64 people fast enough and cheaply enough |
| | 9. What does one AI reply actually cost? | Run a fleet through a whole day for under $0.33 per 1,000 replies |
| | 10. What happens when something goes wrong in production? | Ship a new version without garbled replies reaching people |
| | 11. Why are AI companies building power plants? | Train a model on time within a power budget |
| **3 · Where the model comes from** | 12. Where does a model's knowledge come from? | Clean a slice of the web: keep the good pages, drop junk, copies and personal data |
| | 13. How does a model learn? | Train a real neural network in your browser without overfitting |
| | 14. How do thousands of chips train one model? | Plan a training run that hits a target quality within 60 days |
| | 15. How does a text predictor become a helpful assistant? | Make the model more helpful, and prove it |
| **4 · Around the model** | 16. How does a chatbot become an agent? | Fix a bug inside a token budget, as the harness |
| | 17. Can you trust what an AI reads, and what it says? | Block every prompt-injection attack in an inbox and still get the work done |
| **Finale** | Could you run an AI company for a day? | Finish the day in profit, fast, with no incident missed; then the end-to-end check |

Plus: a "Build it yourself" page with hands-on projects, a page of the fun facts you've unlocked, and the full reference list. Progress is saved in your browser.

## View it

Open `docs/index.html` in any modern browser; no install needed.

**Publish on GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `/docs`. The site will appear at `https://<user>.github.io/ai-under-the-hood/`.

## Edit it

```
src/
  styles.css          design tokens (light + dark) and components
  shell-top.html      top bar and course outline
  chapters/NN-*.html  one file per chapter (text, recall, predict, explain, quiz)
  refs/chNN.html      references added by each chapter
  js/core.js          router, sidebar, quizzes, progress, glossary
  js/kit.js           drawing kit for the dark simulation stage
  js/sim.js           live simulation engine: controls, goals, notices, facts, tours, live maths
  js/chNN-*.js        each chapter's simulation
  legacy/             the previous version, kept for reference
notes/                build and review notes
build.py              assembles src/ into docs/index.html
```

Run `python3 build.py` after editing. No dependencies beyond Python 3; the page uses plain HTML, CSS and JavaScript and loads only Google Fonts.

## Accuracy

- Facts are paraphrased from and linked to their sources (papers, company engineering blogs, vendor documentation). See the References chapter.
- Hardware specs, cluster sizes and compute deals change fast; figures carry their dates in the text.
- Simulations are deliberately simplified. Panels say when inputs are illustrative rather than measured.
- Found an error or a better source? Please open an issue or pull request with a link.

## Credits and licence

Designed and built with [Claude](https://claude.ai) (Anthropic) for Rahul's learning series. Code is MIT-licensed; written content is CC BY 4.0. Facts, figures and trademarks belong to their owners and are cited for educational use. See `LICENSE`.
