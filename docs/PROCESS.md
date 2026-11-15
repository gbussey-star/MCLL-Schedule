# MCLL Schedule: how it stays current

TeamLinkt is the source of truth for games. This site only displays and checks
what TeamLinkt exports. Nothing is ever typed into the site to change a game.

## The pieces

| Piece | What it is | Who changes it |
| --- | --- | --- |
| TeamLinkt | where games are created, moved and cancelled | commissioners, schedulers, admins |
| `data/schedule.csv` | the latest full TeamLinkt schedule export, unmodified | the bot (or a person, by hand) |
| `data/permits.csv` | permitted field time | fields lead, once or twice a season |
| `data/practices.csv` | practice assignments | after the practice draft |
| GitHub repo `gbussey-star/MCLL-Schedule` | holds the site files | the bot commits; admins upload |
| Cloudflare Pages project `mcll-schedule` | publishes the repo as the website | automatic on every commit |

## The loop

1. A commissioner changes a game **in TeamLinkt**.
2. On its schedule (see below) the bot logs in to TeamLinkt and downloads the
   full schedule export for the current season, every division.
3. The bot checks the file (`node tools/check_export.js <file>`, or the manual
   checks in `docs/GROKBOT.md`).
4. If the check says OK TO PUBLISH, the bot saves the file as
   `data/schedule.csv` in the repo and commits. If it says NO CHANGE, it stops.
   If it says DO NOT PUBLISH, it stops and reports.
5. Cloudflare Pages rebuilds in about a minute. Everyone who opens the site
   sees the new schedule; anyone with it already open is shown what changed.

## How often

- In season: every morning, and again at 3 pm on game days so weather moves show.
- After a rainout or mass reschedule: run it on request.
- Off season: weekly is enough.

## Trying a change before it is in TeamLinkt

Press **Edit** on the site, drag or add games, and read the rule check. Those
edits live only in that browser. *More -> Export -> Change list only* gives the
list to enter in TeamLinkt. After the next bot run the edits clear by themselves.

## By hand (no bot)

1. In TeamLinkt, export the full league schedule as CSV.
2. On the site press **Import TeamLinkt** (or drop the file on the page) and
   review what changed.
3. *More -> Export -> Everything, as TeamLinkt has it* downloads `schedule.csv`.
4. Upload it to the `data` folder of the repo on GitHub (Add file -> Upload
   files -> Commit).

## Permits and practices

Not from TeamLinkt. Update them with *More -> Import permits* / *Import
practices*, download the cleaned file the site offers, and upload it to `data/`.
See the README for the columns.

## New season checklist

- Set `season` in `js/config.js`.
- Replace `data/permits.csv` and `data/practices.csv` (or delete them until
  the new ones exist - the site works without them).
- Check `litFields`, `coachLinks` and `fieldAliases` in `js/config.js`.
- Point the bot at the new season in TeamLinkt.

## Cloudflare Pages setup (once)

1. Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
2. Pick `gbussey-star/MCLL-Schedule`, branch `main`.
3. Project name: **mcll-schedule** (this becomes `https://mcll-schedule.pages.dev`).
4. Framework preset: None. Build command: leave empty. Output directory: `/`.
5. Save and deploy. Every later commit redeploys by itself.
6. Optional: Custom domains -> add `schedule.mclittleleague.org`. Whoever
   manages the mclittleleague.org DNS adds the CNAME Cloudflare shows.

The page file must stay named `index.html` so the address works with nothing
after the slash. The name people see comes from the project name and the
custom domain.
