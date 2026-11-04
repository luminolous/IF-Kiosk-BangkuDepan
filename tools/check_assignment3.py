#!/usr/bin/env python3
"""
Self-check for EA234506 Group Assignment 3.

Verifies that the group repository is a complete submission:
  1. exactly one report PDF in report/, named assignment3_group<NN>.pdf, within the page limit
  2. SUBMISSION.md, evaluation/PLAN.md, evaluation/accessibility/audit.md and
     evaluation/change/CHANGE.md have no unfilled fields
  3. evaluation/data/*.csv have the right header, at least 8 complete main sessions and
     3 complete check sessions, trials that point at real sessions, and valid values
  4. nothing under evaluation/ looks like an e-mail address, a phone number or an NRP
  5. CONTRIBUTIONS.md has a line per member, and each member was present at a session
  6. the facts in data/*.csv are unchanged and the Student prototype badge is still there

It does not grade anything.

    python3 tools/check_assignment3.py          full check (final submission)
    python3 tools/check_assignment3.py --plan   only what must exist before the first visitor
"""
import csv
import hashlib
import io
import os
import re
import subprocess
import sys

PLAN_ONLY = "--plan" in sys.argv
PAGE_LIMIT = 12            # eight pages of report plus appendices, with slack
MIN_MAIN, MIN_CHECK = 8, 3
REPORT_RE = re.compile(r"^assignment3_group\d{2}\.pdf$")
FIELDS = ["group_number", "team_name", "facet", "research_question", "method_family",
          "lam_scenario", "setting", "fork_url", "change_pr", "allow_adoption", "ai_tools_used"]
SESSION_COLS = ["session_id", "phase", "date", "start_time", "setting", "model_visitor",
                "first_time_in_building", "age_18_plus", "not_in_ea234506", "consent_verbal",
                "condition_order", "team_present", "notes"]
TRIAL_COLS = ["session_id", "task_id", "condition", "attempt_order", "success", "time_s",
              "errors", "seq", "observation"]
FORBIDDEN_COLS = re.compile(r"name|nama|nrp|phone|telp|hp|wa|email|e-mail|instagram|photo|foto", re.I)
PII = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "an e-mail address"),
    (re.compile(r"(?<!\d)(?:\+62|62|0)8\d{7,11}(?!\d)"), "a phone number"),
    (re.compile(r"(?<!\d)\d{10}(?!\d)"), "a 10-digit number (an NRP?)"),
]
# Columns of data/ that state facts. ruangan.csv may change its display columns.
FACT_FILES = {"data/dosen.csv": None, "data/penghuni.csv": None, "data/jadwal.csv": None,
              "data/ruangan.csv": {"label_peta", "keterangan"}}
FACTS_SHA = "tools/data-facts.sha256"

problems, warnings, notes = [], [], []


def read(path):
    try:
        with open(path, encoding="utf-8-sig") as fh:
            return fh.read()
    except OSError:
        return None


def unfilled(path, label):
    text = read(path)
    if text is None:
        problems.append(f"{path} is missing.")
        return None
    left = [i + 1 for i, line in enumerate(text.splitlines()) if "REPLACE" in line]
    if left:
        problems.append(f"{label}: {len(left)} line(s) still say REPLACE (first at line {left[0]}).")
    return text


def table_rows(text, prefix):
    """Rows of a Markdown table whose first cell matches prefix and whose second cell is filled."""
    rows = []
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 2 and re.fullmatch(prefix, cells[0]) and cells[1] and "REPLACE" not in cells[1]:
            rows.append(cells)
    return rows


def check_submission_md():
    text = read("SUBMISSION.md")
    if text is None:
        problems.append("SUBMISSION.md is missing.")
        return {}
    values = {}
    for key in FIELDS:
        m = re.search(rf'^{key}:\s*"(.*)"\s*$', text, re.M)
        if not m:
            problems.append(f"SUBMISSION.md: the line '{key}:' is missing or has lost its quotation marks.")
        elif not m.group(1).strip() or m.group(1).startswith("REPLACE"):
            problems.append(f"SUBMISSION.md: '{key}' is not filled in.")
        else:
            values[key] = m.group(1).strip()
    if "allow_adoption" in values and values["allow_adoption"].lower() not in ("yes", "no"):
        problems.append("SUBMISSION.md: 'allow_adoption' must be yes or no.")
    return values


def check_plan():
    text = unfilled("evaluation/PLAN.md", "evaluation/PLAN.md")
    if text is None:
        return
    for prefix, need, what in [(r"D\d+", 5, "dimensions (2.1)"), (r"M\d+", 3, "model visitors (2.2)"),
                               (r"A\d+", 3, "ambiguities (2.5)"), (r"T\d+", 3, "tasks (4)")]:
        n = len(table_rows(text, prefix))
        if n < need:
            problems.append(f"evaluation/PLAN.md: {n} {what}, at least {need} needed.")
    cand = re.search(r"### 2\.3.*?\n(.*?)\n### ", text, re.S)
    if cand and len(re.findall(r"^\s*\d+\.\s+\S", cand.group(1), re.M)) < 3:
        problems.append("evaluation/PLAN.md: fewer than three candidate research questions (2.3).")


def load_csv(path, columns):
    text = read(path)
    if text is None:
        problems.append(f"{path} is missing.")
        return []
    sample = text.splitlines()[0] if text.strip() else ""
    if ";" in sample and "," not in sample:
        problems.append(f"{path} uses ';' as the separator. Save it as CSV UTF-8 with commas.")
        return []
    reader = csv.DictReader(io.StringIO(text))
    header = [h.strip() for h in (reader.fieldnames or [])]
    if header != columns:
        problems.append(f"{path}: the header row has changed. It must be exactly: {','.join(columns)}")
    extra = [h for h in header if h not in columns and FORBIDDEN_COLS.search(h)]
    if extra:
        problems.append(f"{path}: column(s) {extra} look like personal data. Remove them.")
    return [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader]


def check_data():
    sessions = load_csv("evaluation/data/sessions.csv", SESSION_COLS)
    trials = load_csv("evaluation/data/trials.csv", TRIAL_COLS)
    ids, seen = {}, set()
    for i, s in enumerate(sessions, 2):
        sid = s.get("session_id", "")
        if not re.fullmatch(r"[SPC]\d{2,3}", sid):
            problems.append(f"sessions.csv line {i}: session_id '{sid}' should look like S01, P01 or C01.")
        if sid in seen:
            problems.append(f"sessions.csv line {i}: session_id {sid} appears twice.")
        seen.add(sid)
        phase = s.get("phase", "").lower()
        if phase not in ("main", "pilot", "check"):
            problems.append(f"sessions.csv line {i}: phase must be main, pilot or check.")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s.get("date", "")):
            problems.append(f"sessions.csv line {i}: date must be YYYY-MM-DD.")
        ids[sid] = s
    trial_count = {}
    for i, t in enumerate(trials, 2):
        sid = t.get("session_id", "")
        if sid not in ids:
            problems.append(f"trials.csv line {i}: session {sid} is not in sessions.csv.")
        trial_count[sid] = trial_count.get(sid, 0) + 1
        if t.get("success", "") not in ("0", "0.5", "1"):
            problems.append(f"trials.csv line {i}: success must be 0, 0.5 or 1.")
        seq = t.get("seq", "")
        if seq and not (seq.isdigit() and 1 <= int(seq) <= 7):
            problems.append(f"trials.csv line {i}: seq must be a whole number from 1 to 7, or empty.")
        ts = t.get("time_s", "")
        if ts and not re.fullmatch(r"\d+(\.\d+)?", ts):
            problems.append(f"trials.csv line {i}: time_s must be a number of seconds, or empty.")

    def complete(s):
        return (all(s.get(c, "").lower() == "yes" for c in ("age_18_plus", "not_in_ea234506", "consent_verbal"))
                and trial_count.get(s["session_id"], 0) > 0)

    main = [s for s in ids.values() if s.get("phase", "").lower() == "main" and complete(s)]
    check = [s for s in ids.values() if s.get("phase", "").lower() == "check" and complete(s)]
    notes.append(f"{len(main)} complete main session(s), {len(check)} complete check session(s), {len(trials)} trial(s).")
    if len(main) < MIN_MAIN:
        problems.append(f"Only {len(main)} complete main sessions; at least {MIN_MAIN} are required.")
    if len(check) < MIN_CHECK:
        problems.append(f"Only {len(check)} complete check sessions of your change; at least {MIN_CHECK} are required.")
    models = {s.get("model_visitor", "") for s in main} - {"", "none"}
    if main and len(models) < 2:
        warnings.append("All main sessions match one model visitor (or none). The brief asks you to reach at least two.")
    return ids


def check_pii():
    for root, _, files in os.walk("evaluation"):
        for name in files:
            if not name.lower().endswith((".csv", ".md", ".txt", ".json")):
                continue
            path = os.path.join(root, name)
            for n, line in enumerate((read(path) or "").splitlines(), 1):
                for rx, what in PII:
                    if rx.search(line):
                        problems.append(f"{path} line {n} contains what looks like {what}. Participants must not be identifiable.")
                        break


def check_contributions(sessions):
    text = read("CONTRIBUTIONS.md")
    if text is None:
        problems.append("CONTRIBUTIONS.md is missing.")
        return
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    lines = [l for l in text.splitlines() if l.startswith("- ") and "·" in l]
    if not lines:
        problems.append("CONTRIBUTIONS.md has no member lines yet.")
        return
    notes.append(f"CONTRIBUTIONS.md lists {len(lines)} member(s).")
    if sessions is None:
        return
    present = set()
    for s in sessions.values():
        present.update(u.lower().lstrip("@") for u in s.get("team_present", "").split())
    for l in lines:
        parts = [p.strip() for p in l[2:].split("·")]
        if len(parts) >= 3 and parts[2] and parts[2].lower().lstrip("@") not in present:
            warnings.append(f"{parts[2]} is in CONTRIBUTIONS.md but not in team_present of any session.")


def fact_digest(path, display_cols):
    text = read(path)
    if text is None:
        return None
    sep = ";" if text.splitlines()[0].count(";") > text.splitlines()[0].count(",") else ","
    rows = list(csv.reader(io.StringIO(text), delimiter=sep))
    if display_cols:
        keep = [i for i, h in enumerate(rows[0]) if h.strip() not in display_cols]
        rows = [[r[i] if i < len(r) else "" for i in keep] for r in rows]
    canon = "\n".join(",".join(c.strip() for c in r) for r in rows if any(c.strip() for c in r))
    return hashlib.sha256(canon.encode()).hexdigest()


def check_facts_and_badge():
    expected = {}
    for line in (read(FACTS_SHA) or "").splitlines():
        if line.strip():
            digest, path = line.split(None, 1)
            expected[path.strip()] = digest
    for path, display in FACT_FILES.items():
        got = fact_digest(path, display)
        if got is None:
            problems.append(f"{path} is missing. The kiosk cannot build without it.")
        elif path in expected and got != expected[path]:
            warnings.append(f"{path}: the facts (rooms, lecturers or timetable) differ from the template. "
                            f"The brief allows changes to how rooms are shown, not to what is true.")
    badge = read("frontend/src/components/PrototypeBadge.jsx") or ""
    main = read("frontend/src/main.jsx") or ""
    if "VITE_PROTOTYPE_LABEL" not in badge or "<PrototypeBadge" not in main:
        problems.append("The Student prototype badge has been removed or disconnected. Restore it.")


def check_report():
    pdfs = [f for f in os.listdir("report") if f.lower().endswith(".pdf")] if os.path.isdir("report") else []
    if not pdfs:
        problems.append("No report PDF in report/. Without it the repository is not a submission.")
        return
    if len(pdfs) > 1:
        problems.append(f"More than one PDF in report/: {pdfs}. Keep only the final report.")
    for f in pdfs:
        if not REPORT_RE.match(f):
            problems.append(f"report/{f} should be named assignment3_group<NN>.pdf, e.g. assignment3_group07.pdf.")
        try:
            out = subprocess.run(["pdfinfo", os.path.join("report", f)], capture_output=True, text=True, timeout=30)
            m = re.search(r"^Pages:\s+(\d+)", out.stdout, re.M)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            m = None
        if not m:
            warnings.append(f"Could not count the pages of report/{f} (is pdfinfo installed?).")
        elif int(m.group(1)) > PAGE_LIMIT:
            problems.append(f"report/{f} has {m.group(1)} pages; the limit is 8 plus appendices (checked at {PAGE_LIMIT}).")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    os.chdir(os.path.dirname(here))
    check_plan()
    check_facts_and_badge()
    check_pii()
    sessions = None
    if PLAN_ONLY:
        check_contributions(None)
    else:
        check_submission_md()
        sessions = check_data()
        unfilled("evaluation/accessibility/audit.md", "evaluation/accessibility/audit.md")
        audit = read("evaluation/accessibility/audit.md") or ""
        n = len(table_rows(audit, r"K\d+"))
        if n < 6:
            problems.append(f"evaluation/accessibility/audit.md: {n} checks filled in, at least 6 needed.")
        unfilled("evaluation/change/CHANGE.md", "evaluation/change/CHANGE.md")
        check_contributions(sessions)
        check_report()

    title = "Plan check" if PLAN_ONLY else "Submission check"
    print(f"== {title}, EA234506 Group Assignment 3 ==")
    for n in notes:
        print("  ·", n)
    for w in warnings:
        print("  ⚠", w)
    for p in problems:
        print("  ✗", p)
    if problems:
        print(f"\n{len(problems)} problem(s). This would not be a complete submission yet.")
        sys.exit(1)
    print("\nNo problems found. This checks completeness only, not quality.")


if __name__ == "__main__":
    main()
