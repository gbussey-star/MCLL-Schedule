# MCLL schedule console

A static site: no server, no Google Sheet, no build step. TeamLinkt is the source
of truth; this site shows the latest export and checks it.

## Put it on GitHub

1. Upload everything in this folder to the root of the repository
   (`index.html` at the top level, plus `css/`, `js/`, `data/`, `.nojekyll`).
2. Repository **Settings -> Pages -> Deploy from a branch -> main / (root)**.
3. The site is at `https://<user>.github.io/<repo>/`.

## Updating the schedule

`data/schedule.csv` is a TeamLinkt schedule export, unmodified. Replace that one
file and the site is updated for everyone.

- **By hand:** press *Import TeamLinkt* (or drop the export on the page), review
  what changed, apply, then *Download schedule.csv* and upload it to `data/`.
- **By bot:** anything that can write a file to the repo works - have it save the
  TeamLinkt export as `data/schedule.csv` and commit. No conversion needed.
  Visitors who already have the page open are shown what changed.

## Files

| File | What it is |
| --- | --- |
| `index.html` | the page |
| `css/console.css` | styling (carried over from the Upper County console) |
| `js/config.js` | **settings**: program tabs, colours, lit fields, two-team coaches |
| `js/teamlinkt.js` | reads/writes TeamLinkt CSV and compares two schedules |
| `js/rules.js` | the rule check |
| `js/app.js` | the interface |
| `data/schedule.csv` | the latest TeamLinkt export |

Programs are worked out from TeamLinkt's Group column
(`Sport - Division - Region`): Upper County, Lower County, Softball, and
All County (Intermediates, Juniors). A new division in TeamLinkt appears by itself.

## What lives only in a browser

Edits (drag, add, remove), ignored warnings and "mark lit" are saved in that
browser only. Edits are proposals: enter them in TeamLinkt, and they clear on
the next import. To make a lit field or a two-team coach permanent, add it to
`js/config.js`.
