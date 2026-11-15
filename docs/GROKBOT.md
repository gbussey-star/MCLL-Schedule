# Instructions for the schedule bot

You keep the MCLL Schedule website (https://mcll-schedule.pages.dev) in step
with TeamLinkt. Your whole job: download the season schedule from TeamLinkt and
publish it to the website, unmodified, after checking it.

## What you have

- A TeamLinkt admin login for Montgomery County Little League.
- One way to publish, given to you separately - use whichever you were given:
  - **A. A website sign-in** (a name and password for the schedule site), or
  - **B. A bot key** (a long random string), or
  - **C. Write access to the GitHub repository** `gbussey-star/MCLL-Schedule`.

Never write a password, key or token into a file, a commit, a log or a message.

## Every run

1. **Log in** at https://app.teamlinkt.com and open the Montgomery County Little
   League league account (not a single team).
2. **Open the league schedule** for the current season. Clear every filter: all
   divisions, all teams, all locations, the whole season's dates.
3. **Export the schedule as CSV.** TeamLinkt names it
   `schedule_export_YYYYMMDD_HHMMSS.csv`.
4. **Check the file:**
   - The first line is exactly these nine columns:
     `Date,"Start Time","End Time",Location,Group,"Event Type",Notes,"Home Team","Away Team"`
   - The Group column includes Upper County, Lower County and All County
     baseball groups, and Softball groups. If a whole program is missing, the
     export was filtered - go back to step 2.
5. **Publish** with the method you were given (below).
6. **Report** one line to George Bussey: `published` / `no change` / `stopped`,
   the export timestamp, the game count, and for `stopped` the reason.

## A. Website sign-in (works like a person would)

1. Open https://mcll-schedule.pages.dev
2. **More -> Sign in to publish.** Enter the bot's name and password.
3. Press **Import TeamLinkt** and choose the export file.
4. The screen lists what changed. Press **Apply all**.
   If it says **Nothing to update**, stop and report `no change`.
5. A banner appears: *This browser holds a newer TeamLinkt import than the
   website.* Press **Publish to website**.
6. Wait for **Published**. If it says **Check before publishing** (the file has
   far fewer games than the published one), press **Cancel** and report
   `stopped` - do not press *Publish anyway*.

## B. Bot key (no browser needed)

    POST https://mcll-schedule.pages.dev/api/publish?kind=schedule
    Authorization: Bearer <bot key>
    Content-Type: text/csv

    <the export file's contents, unmodified>

Answers (JSON):
- `200 {"ok":true,"rows":N,...}` - published. With `"unchanged":true`, nothing changed.
- `409` - far fewer games than the published schedule; probably a filtered export. Stop and report.
- `422` - not a full schedule export (wrong columns). Stop and report.
- `401` - the key is wrong. Stop and report.

## C. GitHub commit

Replace `data/schedule.csv` in `gbussey-star/MCLL-Schedule` (branch `main`)
with the export, unmodified. Commit message:
`Schedule from TeamLinkt YYYY-MM-DD HH:MM (N games)`. If the file is identical
to what is there, do not commit. Never touch any other file.

## Rules

- Publish only the schedule. Never publish permits or practices.
- Never change anything in TeamLinkt. You only read and export.
- Never publish a file that failed a check.
- If a login fails, a page looks different from these steps, or anything asks
  for a verification code, stop and report. Do not guess.

## When

- In season: daily at 6:00 am Eastern, and 3:00 pm Eastern on game days.
- On request after a rainout or mass reschedule.
- Off season: Mondays at 6:00 am Eastern.
