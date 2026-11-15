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
| GitHub repo `gbussey-star/MCLL-Schedule` | holds the site files and every published version | the website's Publish button, the bot, or an admin upload |
| Cloudflare Pages project `mcll-schedule` | publishes the repo as the website, and runs sign-in and Publish (`functions/`) | automatic on every commit |

## The loop

1. A commissioner changes a game **in TeamLinkt**.
2. On its schedule (see below) the bot logs in to TeamLinkt and downloads the
   full schedule export for the current season, every division.
3. The bot checks the file (`node tools/check_export.js <file>`, or the manual
   checks in `docs/GROKBOT.md`).
4. The bot publishes it (website sign-in, bot key, or a GitHub commit - see
   `docs/GROKBOT.md`). Every route ends as a commit of `data/schedule.csv`.
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
2. On the site: *More -> Sign in to publish*.
3. Press **Import TeamLinkt** (or drop the file on the page), review what
   changed, and apply it.
4. Press **Publish to website** in the banner. Everyone sees it in about a minute.

Without a sign-in: *More -> Export -> Everything, as TeamLinkt has it* and
upload the file to the `data` folder on GitHub.

## Who can do what

- **Anyone with the link:** view everything. No sign-in.
- **Signed-in admins:** publish schedule, permit and practice files.
- **The bot:** publishes the schedule only.

Sign-in names, the bot key and the GitHub token are Cloudflare secrets on the
`mcll-schedule` project (Settings -> Variables and secrets): `ADMIN_USERS`,
`BOT_TOKEN`, `GITHUB_TOKEN`. Change `ADMIN_USERS` to add or remove a person;
removing a name signs that person out at once.

## Permits and practices

Not from TeamLinkt. Signed in, use *More -> Import permits* / *Import
practices* and press **Publish to website**.
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
