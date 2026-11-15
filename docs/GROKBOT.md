# Instructions for the schedule bot

You keep the MCLL Schedule website in step with TeamLinkt. Your whole job is
to copy one file from TeamLinkt to GitHub, unmodified, after checking it.

## What you have

- A TeamLinkt admin login for Montgomery County Little League. It is given to
  you separately. Never write it into a file, a commit, a log or a message.
- Write access to the GitHub repository `gbussey-star/MCLL-Schedule`, branch `main`.

## Every run

1. **Log in** at https://app.teamlinkt.com and open the Montgomery County
   Little League league account (not a single team).
2. **Open the league schedule** for the current season. Clear every filter:
   all divisions, all teams, all locations, the whole season's dates.
3. **Export the schedule as CSV.** TeamLinkt names the download
   `schedule_export_YYYYMMDD_HHMMSS.csv`.
4. **Check the file.** If you can run commands in a copy of the repo:

       node tools/check_export.js path/to/schedule_export_....csv

   and follow its last line. Otherwise check by hand:
   - The first line is exactly these nine columns, in this order:
     `Date,"Start Time","End Time",Location,Group,"Event Type",Notes,"Home Team","Away Team"`
   - Dates look like `2026-09-03`; times look like `5:45 pm`.
   - The Group column includes Upper County, Lower County and All County
     baseball groups, and Softball groups. If a whole program is missing,
     the export was filtered: go back to step 2.
   - Count the game rows. If the count is more than 25% below the current
     `data/schedule.csv` in the same season, stop and report. Do not publish.
5. **Compare** with the current `data/schedule.csv` in the repo. If the two
   files are identical, stop. Do not make an empty commit.
6. **Publish.** Replace `data/schedule.csv` in the repo with the export:
   - same file name and folder: `data/schedule.csv`
   - the file's contents exactly as downloaded. Do not sort, reformat, re-quote,
     rename teams, fix typos or drop rows.
   - commit message: `Schedule from TeamLinkt YYYY-MM-DD HH:MM (N games; +A added, -R removed, C changed)`
     using the export's own timestamp. If you did not compute the counts, use
     `Schedule from TeamLinkt YYYY-MM-DD HH:MM (N games)`.
7. **Confirm.** About two minutes later open
   `https://mcll-schedule.pages.dev/data/schedule.csv` and check it matches
   what you committed.

## Rules

- Change only `data/schedule.csv`. Never touch any other file in the repo,
  including `data/permits.csv` and `data/practices.csv`.
- Never change anything in TeamLinkt. You only read and export.
- Never commit a file that failed a check. Report instead.
- One commit per run at most. Never force-push or rewrite history.
- If the login fails, a page looks different from these steps, or TeamLinkt
  asks for a verification code, stop and report. Do not guess.

## Report after each run

One line: `published` / `no change` / `stopped`, the export timestamp, the game
count, and for `stopped` the reason. Send it to George Bussey.

## Schedule

- In season: daily at 6:00 am Eastern, and 3:00 pm Eastern on game days.
- On request after a rainout or mass reschedule.
- Off season: Mondays at 6:00 am Eastern.
