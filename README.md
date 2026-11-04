# Group Assignment 3: your group's copy of the IF E-Kiosk

**EA234506 Information Visualisation** · Class 20261 (N)

> ### 📖 The assignment brief is on myITS Classroom, not here.
>
> **Read it there first.** The task, the facets, the rules for working with visitors in the lobby, how the 100 points are awarded and the academic-integrity policy all live in the specification PDF and the announcement on myITS Classroom.
>
> **This repository is where your group works and hands in.** It holds a full copy of the kiosk's code, so that your group can build and publish one evidence-driven change, plus the folders for your research. If anything here ever disagrees with myITS Classroom, **myITS Classroom is correct**.

| Date | What |
|---|---|
| **Fri 30 Oct, 23:59 WIB** | Every member has accepted the invitation and added their line to `CONTRIBUTIONS.md`. Facet and big-screen slots booked in the sign-up sheet. |
| **Mon 2 Nov, 12:00** | GitHub Pages is on (the lecturer does this); your copy is published on every push to `master`. |
| **Before your first participant** | `evaluation/PLAN.md` committed and pushed. The commit time is your evidence that you decided your tasks and success criteria before you saw any data. |
| **Tue 10 Nov, 23:59 WIB** | Final submission. Late rules are in the brief. |
| **Wed 4 Nov** | Week 10 clinic: bring your plan and your first sessions. |
| **Wed 11 Nov** | Presentation and questions, in class. |

---

## Where everything goes

```
README.md                       ← this file
KIOSK.md                        ← how the kiosk's code works (developer documentation)
SUBMISSION.md                   ← group details, links, AI declaration (fill in the form)
CONTRIBUTIONS.md                ← one line per member, each written by that member
evaluation/
    PLAN.md                     ← divergent model, research question, tasks, success criteria
    protocol/                   ← task cards, the script you read, any questionnaire, as used
    data/
        sessions.csv            ← one row per participant session (main, pilot, check)
        trials.csv              ← one row per task attempt
        README.md               ← what each column means
    accessibility/
        audit.md                ← the accessibility checks, with measured values
        evidence/               ← photos of the screen, measurements, simulations (no faces)
    change/
        CHANGE.md               ← finding → change → reason → check
report/
    assignment3_group<NN>.pdf   ← the report, e.g. assignment3_group07.pdf
template/report-skeleton.md     ← optional blank headings for the report
tools/check_assignment3.py      ← the self-check (see below)

data/  frontend/  backend/  relay/   ← the kiosk itself (see KIOSK.md)
```

**A repository with no report PDF in `report/` is not a submission and is not marked.**

---

## Step 1, for every member, this week

Each member opens **`CONTRIBUTIONS.md`** on github.com, clicks the ✏️ pencil, adds **their own line**, and commits it **from their own account**. This proves that you can push here. Do it on the first day.

## Step 2: your published copy

The lecturer switches on GitHub Pages for every group repository by **Monday 2 November, 12:00**. From then on, every push to `master` builds your copy and publishes it at:

`https://giga-iv.github.io/<this repository's name>/`

Open the **Actions** tab to watch it: the **Pages** workflow takes three or four minutes. Put the address in `SUBMISSION.md` as `fork_url`.

Every page shows a red **Student prototype** badge. It is there so that nobody in the lobby mistakes your version for the official kiosk. **Do not remove or hide it.** Removing it is treated like any other misrepresentation.

If the **deploy** job still fails after Monday 2 November, 12:00, tell the lecturer on the forum the same day. Do not move the code to a personal repository. While you wait, `npm run dev:frontend` runs your copy on your own laptop.

## Step 3: make your change on a branch, as a pull request

Your one evidence-driven change goes through a pull request **inside this repository**, so the marker can see exactly what changed and why:

```bash
git clone <this repository's URL>
cd <repository folder>
npm ci                       # once; needs Node.js 22
git switch -c change         # a branch for your change
npm run dev:frontend         # the kiosk at http://localhost:5173, without phone pairing
# ...edit frontend/src/...
npm test                     # must still pass
git add -A && git commit -m "Room labels: raise minimum height to 40 dmm at 2 m"
git push -u origin change
```

Then on github.com: **Pull requests → New pull request → base: master ← compare: change**. Write the description with the four headings from `evaluation/change/CHANGE.md`, and merge it before the deadline. The **Pages** workflow builds every pull request, so a ❌ on the pull request means the code does not build or a test fails.

Useful addresses while you test, on the official site or your own:

| Add to the address | What it does |
|---|---|
| `?gestures=orbit` | the older gesture scheme: one finger rotates, two fingers pan |
| `?sekarang=Senin-09:45` | pretends it is Monday 09:45, so the "Sedang berlangsung" board shows classes outside class hours |

### What you may and may not change

- **May:** anything in `frontend/src/` and `frontend/index.html`, and the display columns of `data/ruangan.csv` (`label_peta`, `keterangan`) if your change is about how a room is named on the map.
- **May not:** the facts in `data/` (which rooms exist, who sits where, the timetable), anything in `relay/` or `backend/`, the badge, and the two workflows in `.github/workflows/`. The self-check warns if `data/` facts have changed.
- **No photos of real people** anywhere in this repository, including `frontend/public/picture/` and `evaluation/accessibility/evidence/`.

---

## Your research data

- `evaluation/data/sessions.csv` and `trials.csv` already have their header row. Add one row per session and one row per task attempt. `evaluation/data/README.md` explains each column.
- **Never record a name, an NRP, a phone number, an e-mail address, a face or a voice.** A participant is a code: `S01`, `S02`, …. The self-check refuses anything that looks like an NRP, a phone number or an e-mail address.
- Pilot sessions stay in the file with `phase` = `pilot`; they do not count towards the minimum.

## How to push work without a command line

For everything except the code change, the web works, also on a phone: open the folder on **github.com**, then **Add file → Upload files** (or open a file and click the ✏️ pencil) and **Commit changes**. Always open the file fresh before editing: other members push here too.

---

## Check yourself before the deadline

Every push runs an automatic check. Look for the ✅ or ❌ beside your commit, or open the **Actions** tab. You can also run it yourself:

```bash
python3 tools/check_assignment3.py
```

It checks mechanical things only: the report PDF is present, correctly named and within the page limit; `SUBMISSION.md` and `PLAN.md` are filled in; the data files have enough complete, consented sessions and contain nothing that identifies a person; `audit.md` and `CHANGE.md` are filled in; every member has a line in `CONTRIBUTIONS.md`; and the facts in `data/` are unchanged.

**It does not grade you.** A green tick means "this will be marked", not "this is good".

---

## If something goes wrong

| Problem | What to do |
|---|---|
| You cannot see this repository, or you are in the wrong group | E-mail **hadziq@its.ac.id on the first day**. Do not create a new group. |
| `npm ci` fails on your laptop | Install Node.js 22 LTS and try again. One working laptop per group is enough; the others can work on the research. |
| The QR code never appears on your published copy | Pairing depends on the course relay; ask on the forum. Your copy still works by touch. |
| Two members pushed at once and Git refuses your push | `git pull`, then push again. On the web, re-upload the file. |
| A member has stopped responding | Tell the lecturer **before** the deadline, not at the presentation. |
| Any question about the task itself | The **forum on myITS Classroom**, not e-mail. |
