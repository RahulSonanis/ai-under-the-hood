# AI Under the Hood

**What really happens when you talk to an AI?** An interactive course that starts with you pressing *send* and works backwards: tokens, the model, the GPU serving your reply, the months of training before it, the datacenters underneath, and the software that turns a model into an agent.

Every chapter opens with a short animated film you can play, pause and step through, showing the machinery at work: packets crossing a datacenter, tokens flowing through layers, gradients flowing back, GPUs failing and restarting. Every idea is explained as a ladder that goes as deep as you want: **Age 5 → Curious → Engineer → Mathematician**. Every chapter is built around something you can play with, and every claim links to a primary source.

## The course

| Part | Chapter | What you play with |
|---|---|---|
| **1 · Press send** | 1. What happens when you press send? | Live request trace (gateway → queue → prefill → decode → stream) and a rewind timeline |
| | 2. How does text become numbers? | Watch a real BPE tokenizer learn merge by merge; embedding map with word arithmetic |
| | 3. How does a model pick the next word? | A real trigram language model with a spinning sampling wheel (temperature, top-k, top-p); "be the model" guessing game |
| | 4. What happens inside the model? | Clickable attention heads ("who is *it*?"); drag query/key vectors and watch softmax attention; parameter counter |
| | 5. How does it remember the conversation? | GPU memory map: reserved vs paged KV cache, prefix caching; KV calculator |
| | 6. How does one GPU serve many people? | Animated decode step (weights streaming vs compute); static vs continuous batching; roofline |
| **2 · Rewind** | 7. Where does the knowledge come from? | Data-cleaning funnel (language ID, quality rules, exact and MinHash dedup); packing and masking |
| | 8. How does a model learn? | Gradient descent on a loss landscape; train a real neural network in the browser (backprop + Adam) |
| | 9. How big, how long, how much? | Compute-budget splitter (Chinchilla); training cost vs DeepSeek-V3, Llama 3.1, SmolLM3 reports |
| | 10. How do thousands of chips train one model? | Step-through ring all-reduce; animated pipeline schedules and bubbles; memory-per-GPU calculator |
| | 11. What happens when chips break? | Keep a 16,384-GPU run alive using Meta's real Llama 3 failure rate and causes |
| | 12. How does a predictor become an assistant? | One prompt across base → SFT → RLHF; reward hacking and the KL leash |
| | 13. How do we know it's good and safe? | The noise machine (benchmark variance); significance calculator |
| **3 · The building** | 14. What is inside an AI datacenter? | Zoom from chip → tray → rack → cluster → gigawatt campus; power calculator; AWS, Google, Microsoft, OpenAI/Oracle, Anthropic and Meta case studies |
| **4 · Around the model** | 15. How does a chatbot become an agent? | Agent terminal with live context, compaction and prompt-caching accounting |
| | 16. Build it yourself | Hands-on follow-up projects, then 60 references |

Each chapter opens with a one-sentence answer and a step-by-step film, then has hands-on experiments, 2–3 concept ladders, optional engineer tools, and a two-question check. Progress is saved in your browser.

## View it

Open `docs/index.html` in any modern browser; no install needed.

**Publish on GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `/docs`. The site will appear at `https://<user>.github.io/ai-under-the-hood/`.

## Edit it

```
src/
  styles.css          design tokens (light + dark) and components
  shell-top.html      top bar and course outline
  chapters/NN-*.html  one file per chapter
  js/core.js          router, concept ladders, quizzes, progress, plotting helpers
  js/c00-scene.js     film engine: playback controls, camera, drawing kit (storyFilm)
  js/cNNa-film.js     each chapter's film (steps, captions at two depths, drawing)
  js/cNN-*.js         each chapter's hands-on experiments (initialised when first opened)
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
