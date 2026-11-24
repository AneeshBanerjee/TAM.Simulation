# TAM.Simulation — Meridian Hale: The Copilot Paradox

Live site: https://aneeshbanerjee.github.io/TAM.Simulation/

A browser-based simulation for MBA and Executive MBA teaching on technology acceptance (TAM, UTAUT) and generative AI adoption. It accompanies the teaching case *Meridian Hale: The Copilot Paradox*.

Teams act as the AI Programme Board of Meridian Hale LLP, a fictional UK accounting and advisory firm. Weekly usage of the firm's AI assistant has stalled at 57%, partners are not using it, and a client has found fabricated sources in a report. Over four quarters of 2027, with a £2.4m budget, teams invest in enablement levers, set firm policy and respond to events. They are judged on a balanced scorecard: adoption, appropriate reliance, quality, value, risk and people.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Landing page: role, mechanics, scorecard |
| `case.html` | Case briefing with Exhibits 1–3 and the four options |
| `simulation.html` | The four-round simulation |
| `debrief.html` | Scorecard, charts, decisions, benchmark comparison, hidden weights reveal, downloads |
| `instructor.html` | Run sheet, teaching points, model documentation, class results loader |

## How it works

- Pure HTML, CSS and JavaScript. No build step, no server, no external libraries or tracking.
- Progress is stored in the browser's `localStorage`. Each team should use one browser on one device.
- Teams download a JSON result file at the end. The instructor loads all files on the instructor page to see a leaderboard, a usage-versus-quality scatter plot and the class's policy mix. Files are read locally and never uploaded.
- A **class code** seeds the random events, so teams with the same code face identical incidents.

The model is a UTAUT-style adoption model (grade-specific hidden weights on performance expectancy, effort expectancy, social influence and facilitating conditions) with an automation-bias quality layer (verification habits, review catch rates, escaped errors, client incidents) and a value-realisation layer. Full equations are on `instructor.html`.

## Files

```
index.html, case.html, simulation.html, debrief.html, instructor.html
assets/css/style.css
assets/js/data.js        grades, levers, policies, events, benchmarks, score weights
assets/js/model.js       simulation engine (pure functions; runs in browser and Node)
assets/js/ui.js          shared helpers and SVG charts
assets/js/sim.js         simulation page
assets/js/debrief.js     debrief page
assets/js/instructor.js  instructor page
tests/model.test.js      model tests (node tests/model.test.js)
.nojekyll                tells GitHub Pages to serve files as-is
```

## Deployment

Every push to `main` runs `.github/workflows/static.yml`, which publishes the repository to GitHub Pages. In **Settings → Pages**, *Source* must be set to **GitHub Actions**.

To try it locally, open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit `http://localhost:8000`.

## Customising

Edit `assets/js/data.js` to change grades, lever effects, policy costs, events, benchmark strategies or scorecard weights. Model constants are at the top of `assets/js/model.js`. Then run:

```bash
node tests/model.test.js
```

The tests check that the baseline reproduces the case (57% weekly usage, 11.1 escaped errors per 100 deliverables), that every benchmark fits the budget, and that the core teaching dynamics still hold.

## Notes

Meridian Hale LLP and all individuals are fictional. All data are constructed for teaching. Add a licence of your choice before publishing (for example CC BY-NC 4.0 for the teaching content and MIT for the code).
