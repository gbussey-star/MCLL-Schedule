# MCLL Schedule

A static site: no server, no Google Sheet, no build step. TeamLinkt is the source
of truth; this site shows the latest export and checks it.

## Where it lives

- GitHub repository: `gbussey-star/MCLL-Schedule` (upload everything in this
  folder to the root: `index.html` at the top level, plus `css/`, `js/`,
  `data/`, `docs/`, `tools/`, `_headers`, `.nojekyll`).
- Cloudflare Pages project: `mcll-schedule` -> `https://mcll-schedule.pages.dev`.
  Setup steps are in `docs/PROCESS.md`.
- `docs/PROCESS.md` - how the schedule stays current.
- `docs/GROKBOT.md` - the instructions to give the bot that pulls TeamLinkt.
- `tools/check_export.js` - checks a TeamLinkt export before it is published.

## Updating the schedule

`data/schedule.csv` is a TeamLinkt schedule export, unmodified. Replace that one
file and the site is updated for everyone.

- **By hand:** press *Import TeamLinkt* (or drop the export on the page), review
  what changed, apply, then *Download schedule.csv* and upload it to `data/`.
- **By bot:** anything that can write a file to the repo works - have it save the
  TeamLinkt export as `data/schedule.csv` and commit. No conversion needed.
  Visitors who already have the page open are shown what changed.

## Fields: permits and practices

Two more files in `data/` tell the site what MCLL holds and who is on it:

| File | What it is | Comes from |
| --- | --- | --- |
| `data/permits.csv` | every permitted window: Date, Field, Start, End, Use (Game or Practice), Program, Permit, Receipt | the ActiveMONTGOMERY / CUPF receipts and the City listing |
| `data/practices.csv` | every practice: Date, Field, Start, End, Team, Coach, Division, Program, Status | the practice draft |

With them the timeline shows each field's permit hours (hatched outside them),
practices as grey blocks, and **open** boxes wherever permitted time has nothing
on it. **Open fields** lists that open time over a date range; in Edit mode
any open box or row adds a game there. The rule check adds four rules: games
inside the permit window, fields permitted that day, games on game permits
(off by default), and games clear of practices. A program's games are only
held to permits when that program's permits are in the file (Program column;
blank means every program).

**Updating them:** *More -> Import permits* or *Import practices*, or drop the
file on the page. Either file can be dated rows, or the weekly form
(Field, Day, Start, End, First, Last - e.g. `Tu/Th`, `Mon-Fri`). The import screen
shows any field it could not match to a TeamLinkt location; add those spellings
to `fieldAliases` in `js/config.js`. Then *Download permits.csv* (or
practices.csv) and upload it to `data/`. Until it is published the browser that
imported it shows a banner.

## Files

| File | What it is |
| --- | --- |
| `index.html` | the page |
| `css/console.css` | styling (carried over from the Upper County console) |
| `js/config.js` | **settings**: program tabs, colours, lit fields, two-team coaches, field name aliases |
| `js/teamlinkt.js` | reads/writes TeamLinkt CSV and compares two schedules |
| `js/fields.js` | reads the permit and practice files, matches field names, works out open time |
| `js/rules.js` | the rule check |
| `js/app.js` | the interface |
| `data/schedule.csv` | the latest TeamLinkt export |
| `data/permits.csv` | permitted field time (Fall 2026: the Upper County permits) |
| `data/practices.csv` | practice assignments (Fall 2026: from the Upper County console) |

Programs are worked out from TeamLinkt's Group column
(`Sport - Division - Region`): Upper County, Lower County, Softball, and
All County (Intermediates, Juniors). A new division in TeamLinkt appears by itself.

## What lives only in a browser

Edits (drag, add, remove), ignored warnings and "mark lit" are saved in that
browser only. Edits are proposals: enter them in TeamLinkt, and they clear on
the next import. To make a lit field or a two-team coach permanent, add it to
`js/config.js`.
