# The two data files

One participant is one **session**. One task done by one participant in one condition is one **trial**.
Keep both files as plain CSV with a comma separator and the header row exactly as given. If you edit in
Excel with Indonesian regional settings, save as **CSV UTF-8** and check that the separator is still a comma.

Never put a name, NRP, phone number, e-mail address, social-media handle, photo or voice recording in
either file or anywhere in this repository. The participant is the `session_id` and nothing else.

## sessions.csv

| Column | What to write | Example |
|---|---|---|
| `session_id` | `S` and two digits, in the order you ran them. Pilots are `P01`, `P02`; change checks are `C01`, `C02`. | `S07` |
| `phase` | `main`, `pilot` or `check` | `main` |
| `date` | `YYYY-MM-DD` | `2026-11-06` |
| `start_time` | `HH:MM`, 24-hour, WIB | `09:52` |
| `setting` | where and on what: `big-screen`, `laptop-touch`, `tablet`, `phone`, plus anything that matters | `big-screen` |
| `model_visitor` | which of your model visitors from `PLAN.md` this person matches, by its code. `none` if none. | `M2` |
| `first_time_in_building` | `yes`, `no` or `unknown`, from the screening question | `yes` |
| `age_18_plus` | `yes`. Anyone who is not 18 or older does not take part. | `yes` |
| `not_in_ea234506` | `yes`. Students of this class are not participants. | `yes` |
| `consent_verbal` | `yes`, after reading the consent script from the field kit | `yes` |
| `condition_order` | for a comparison: the order the person met the conditions, e.g. `map-orbit`. Otherwise `na`. | `orbit-map` |
| `team_present` | GitHub usernames of the members at this session, separated by spaces | `budisan rinap` |
| `notes` | anything unusual: interrupted, left early, a friend helped. No personal details. | `stopped after T2, class starting` |

A **complete main session** has `phase` = `main`, `yes` in the three screening columns and in
`consent_verbal`, and at least one trial in `trials.csv`.

## trials.csv

| Column | What to write | Example |
|---|---|---|
| `session_id` | the session it belongs to | `S07` |
| `task_id` | the task code from `PLAN.md` | `T2` |
| `condition` | the condition, e.g. `map`, `orbit`, `official`, `prototype`; `na` if there is only one | `official` |
| `attempt_order` | 1 for the person's first task, 2 for the second, and so on | `3` |
| `success` | `1` success, `0` failure, `0.5` partial, **by the criterion written in PLAN.md before the study** | `1` |
| `time_s` | seconds from the end of reading the task to the answer or to giving up; empty if not timed | `23` |
| `errors` | the count of what PLAN.md defines as an error; empty if not counted | `1` |
| `seq` | Single Ease Question, 1 (very difficult) to 7 (very easy); empty if not asked | `5` |
| `observation` | what you saw or heard, in a few words. Quote the participant only if they cannot be identified by it. | `tapped IF 105 label twice, expected it to open` |
