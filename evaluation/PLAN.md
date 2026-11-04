# Evaluation plan

**Commit and push this file before your first main session.** The commit time is the evidence that
your tasks and success criteria were decided before you saw any data. You may change it afterwards;
if you do, say what changed and why under *Deviations from the plan* in `SUBMISSION.md`.

## 1. Facet

F5 Layout and the phone handover is the facet that our group choose. This part covers the left navigation bar to change the highlighted room on the 3D visualization on the main part of the page. There is also a QR-Code on the bottom left with text that said, "SCAN UNTUK KONTROL", which we assume that user/visitor can control by scanning the code.

## 2. Divergent model

### 2.1 How kiosk visitors differ

At least five dimensions along which the people in the Lantai 1 lobby differ, as they matter for your facet.

| # | Dimension        | Values it can take                                                                       | Why it matters for this facet                                                                                                                                                             |
| :-: | ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 | Familiarity      | First-time user / Occasional user / Frequent user                                        | Visitors who have used the kiosk before may understand its navigation and control mechanisms more quickly, while first-time users may need more time to discover how to interact with it. |
| D2 | Digital literacy | Low / Moderate / High                                                                    | Visitors with different levels of digital experience may differ in their ability to understand the QR code, scan it, and use their smartphones to control the kiosk.                      |
| D3 | Visit purpose    | Finding a specific room / Exploring the building                                         | Visitors looking for a specific room may focus on navigation efficiency, while those exploring the building may interact with more menu options and floor selections.                     |
| D4 | Time pressure    | Relaxed / In a hurry                                                                     | Visitors with limited time may navigate more quickly, overlook instructions, or abandon the interaction when the phone handover takes too long.                                           |
| D5 | Accessibility    | No additional support needed / Needs visual assistance / Needs motor or reach assistance | Differences in accessibility needs may affect visitors' ability to read navigation labels, identify the QR code, and interact with the kiosk or smartphone controls.                      |

Visitor characteristics will be identified through brief pre-session questions. Accessibility needs will be self-reported voluntarily rather than inferred from appearance.

### 2.2 Model visitors

At least three, each one a combination of values from 2.1, in one sentence. Give each a code (M1, M2, …):
these codes go in the `model_visitor` column of `sessions.csv`.

| Code | Model visitor, one sentence                                                                                                                                                                           | Dimension values                                                                                           |
| :--: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
|  M1  | A student who frequently uses the kiosk, is comfortable with digital technology, and wants to quickly find a specific room before attending class without requiring additional accessibility support. | D1: Frequent user; D2: High; D3: Finding a specific room; D4: In a hurry; D5: No additional support needed |
|  M2  | A first-time visitor with limited experience using digital interfaces who has no urgent schedule and wants to explore the building without requiring additional accessibility support.                | D1: First-time user; D2: Low; D3: Exploring the building; D4: Relaxed; D5: No additional support needed    |
|  M3  | An occasional kiosk user with moderate digital literacy who wants to locate a specific room without time pressure but needs larger text or closer viewing to read interface information comfortably.  | D1: Occasional user; D2: Moderate; D3: Finding a specific room; D4: Relaxed; D5: Needs visual assistance   |

These model visitors represent possible combinations of visitor characteristics rather than actual participants. Real participants will be categorized based on their pre-session responses.

### 2.3 Candidate research questions

At least three, before you choose. Each one is something you could find out by watching visitors use the kiosk.

1. At which stage of the QR-to-phone handover process do visitors experience hesitation, errors, or failure when attempting to control the kiosk using their smartphones?
2. How successfully and efficiently can visitors navigate between floors and locate a specific room using the kiosk's navigation interface?
3. How effectively do visitors recognize and understand the room information panel that becomes available after pairing their smartphones with the kiosk?

### 2.4 The question you chose, and why

**Primary research question:**

At which stage of the QR-to-phone handover process do visitors experience hesitation, errors, or failure when attempting to control the kiosk using their smartphones?

**Reason for selection:**

We selected this question because the transition from the kiosk display to smartphone control is a distinctive part of F5. Visitors must recognize the QR code, understand its purpose, scan it, and establish a connection before accessing the room information panel.

This process involves several observable interaction stages, allowing us to identify where visitors hesitate, make errors, or fail to proceed. We can evaluate these stages through task completion, interaction time, observed errors, and participant feedback.

Compared with the second candidate, which focuses primarily on navigation efficiency, the selected question examines the interaction required to enable smartphone-based control. The third candidate focuses on understanding the room information panel after pairing, while our selected question investigates the preceding handover process.

The evidence collected will help us decide which stage of the handover requires improvement and guide one targeted interface change. Given the small number of participants, the evaluation will focus on identifying usability problems rather than making statistically generalizable claims about all kiosk visitors.

### 2.5 Ambiguity log

At least three things that could be read two ways, and the rule you decided now so that you do not decide it later when you have seen the data.

| # | Ambiguity                                                                                                                                  | Decision rule, fixed before the study                                                                                                                                                                                                                                                                                                           |
| :-: | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 | A visitor successfully scans the QR code and opens the link on their smartphone but does not complete the pairing process.                 | Record the QR scan as successful but the handover as incomplete. For the phone-handover task, assign 0.5 if the link opens without successful pairing, 1 if pairing is completed, and 0 if the visitor fails to open the QR link. Verified technical failures are handled separately under A4.                                                  |
| A2 | A visitor initially selects the wrong floor or room but later corrects the mistake without assistance.                                     | Record the initial incorrect selection as a navigation error. If the visitor independently reaches the correct final result within the predefined task limit, assign a success score of 1. The navigation error remains recorded separately.                                                                                                    |
| A3 | A visitor completes a task only after receiving guidance from the researcher.                                                              | Repeating the original task instruction without additional clues is allowed. If the researcher provides a directional hint and the visitor subsequently completes the task, record it as assisted completion with a maximum success score of 0.5. If the researcher directly performs the required interaction or reveals the answer, assign 0. |
| A4 | A visitor cannot complete the phone handover because of a verified technical problem, such as a network failure or kiosk connection error. | Record the event as a technical issue rather than a user interaction error. Allow one restart after the problem is resolved. If the issue persists, mark the affected trial as invalid, exclude it from task-success calculations, and recruit a replacement participant if necessary.                                                          |

## 3. Study design

**Method family:** task-based. we want to give a brief of what participant should do to do the goal we give them and see how they do it.

**Lam et al. (2012) scenario:** User Performance, we used this because we want to measure are the kiosk can fulfill someone goal to find something using the page as fast and easily to understand as possible.

**Setting:** big screen and participant's own handphone.

**Conditions and order:** one condition, the current screen of kiosk. no order.

**Who you will recruit, and how you will reach at least two of your model visitors:** we plan to recruit 1 person from outside ourclass, a student and from Teknik Informatika staff.

**Planned number of main sessions:** 10 Sessions

**Session length:** We aim to do a brief 6-7 minutes for each session.

## 4. Tasks

At least three. Write the correct answer and the success rule **now**.

| Task | What you say to the participant (in Bahasa Indonesia, as you will say it) | Correct answer | Success rule (1 / 0.5 / 0) | What counts as an error |
| :--: | ------------------------------------------------------------------------- | -------------- | -------------------------- | ----------------------- |
|  T1  | “Anda ingin menggunakan ponsel pribadi untuk mengontrol kiosk ini. Tanpa mencobanya dulu, tunjukkan bagian layar yang akan Anda gunakan untuk memulai dan jelaskan apa yang akan Anda lakukan.”                                                                  | The participant points to the QR code labelled “SCAN UNTUK KONTROL” at the bottom left and explains that they would scan it using their phone to access kiosk control.        | Time limit: 45 seconds. 1: Independently identifies the correct QR code and explains its purpose within the limit. 0.5: Identifies the correct QR code but cannot explain its purpose, or completes the task after a directional hint. 0: Does not identify the correct entry point within the limit, gives up, or the researcher points it out directly.                   | Each distinct selection of an unrelated screen element as the phone-control entry point. An incomplete explanation is reflected in the success score rather than counted as an additional interaction error.                |
|  T2  | “Sekarang gunakan ponsel Anda untuk membuka halaman kontrol yang disediakan kiosk ini. Beri tahu saya ketika halaman tersebut sudah terbuka.”                                                                           |  The participant scans the kiosk’s QR code and opens the linked control or pairing page on their own phone. Opening the camera or displaying a detected link alone does not count as opening the page.              | Time limit: 60 seconds. 1: Independently opens the correct linked page within the limit. 0.5: Opens the correct page after a directional hint, or independently detects the correct QR link but does not open it before the limit. 0: Does not detect or open the correct link, gives up, or the researcher performs the required interaction.                           |Scanning an unrelated QR code, opening an unrelated link, dismissing the correct detected link and having to scan again or rescanning after the correct page has already opened. Repositioning the phone while attempting the first scan is not an error.                         |
|  T3  |“Lanjutkan sampai ponsel Anda terhubung dan siap digunakan untuk mengontrol kiosk ini. Beri tahu saya ketika menurut Anda sudah berhasil.”                                                                           |Pairing is completed. The observer verifies this using the interface’s actual connection indicator or a phone-control action that produces the corresponding change on the kiosk. The exact verification method must be checked during the pilot and recorded before the first main session. A participant’s claim alone is insufficient evidence of successful pairing.                |Time limit: 90 seconds. 1: Independently completes verified pairing within the limit. 0.5: The correct QR-linked page is open but pairing remains incomplete, or pairing succeeds after a directional hint. 0: The participant never opens the correct QR-linked page, or the researcher performs the pairing interaction. Apply A4 separately to verified technical failures.                            |Submitting an incorrect pairing code, if a code is required, selecting an unrelated connection option, leaving the control page and needing to reopen it, or restarting a pairing process that is already progressing without an interface instruction to do so.                         |

## 5. Measures

| Measure | Type (performance, subjective, qualitative) | How it is taken | Column it goes in |
| ------- | ------------------------------------------- | --------------- | ----------------- |
| Task success | performance | Scored 1 / 0.5 / 0 by the rule in section 4 and the ambiguity log (A1–A4), decided at the end of each task, not afterwards | `trials.success` |
| Task time | performance | Stopwatch by the note-taker (left empty if not timed): starts when the facilitator finishes reading the task, stops at the participant's answer, when they say they give up, or at the time limit in section 4 | `trials.time_s` |
| Errors | performance | Count of observable actions defined as errors in section 4 (e.g. wrong tap, re-scan, leaving the paired page), tallied by the note-taker during the task | `trials.errors` |
| Handover stage reached | performance | The last handover stage the participant completed and the stage where they first hesitated or failed, coded with the stage list in section 2.4 | `trials.observation` (coded as `stage=…; hesitation=…`) |
| Single Ease Question | subjective | Field Kit card, asked immediately after each task in the same words: "Secara keseluruhan, seberapa sulit atau mudah tugas tadi?" The participant points at 1–7 | `trials.seq` |
| Think-aloud and observation | qualitative | Note-taker writes what hands, eyes and words did ("tapped the QR twice", not "confused"); one prompt only if think-aloud goes quiet: "Apa yang sedang Anda cari sekarang?" | `trials.observation` |
| Closing comments | qualitative | Debrief question from the consent script: "Ada yang ingin Anda sampaikan tentang kiosk ini?" Paraphrased, quoted only if no one could be identified; the setting of each session (`big-screen`, `laptop-touch`, `tablet`, plus the participant's own phone) is recorded alongside | `sessions.notes`, `sessions.setting` |

## 6. What you expect, and what would change your mind

These predictions concern the model visitors defined in section 2.2. Participants will be categorized using their pre-session responses. We will report individual results and counts within each model rather than generalize to all kiosk visitors.

| Model visitor | What we expect | What would change our mind |
| :--: | --- | --- |
| M1 | Frequent kiosk users with high digital literacy will independently identify the QR entry point, open the linked page, and complete pairing within the task limits. We expect scores of 1 on T1–T3, without directional hints or hesitation longer than 10 seconds. | An M1 participant needs a directional hint, scores below 1 on any task, or hesitates for more than 10 seconds, excluding system loading. This would challenge our assumption that familiarity and digital confidence are sufficient for a smooth handover. |
| M2 | First-time users with low digital literacy will experience difficulty discovering or interpreting the QR entry point, or moving from a detected link to the control page. We expect a score below 1 on T1 or T2, or hesitation longer than 10 seconds during stages S1–S3. | An M2 participant independently scores 1 on T1 and T2 without a recorded error or hesitation longer than 10 seconds. This would challenge our expectation that the entry and scanning process will be difficult for this model visitor. |
| M3 | Occasional users who need larger text or closer viewing will move closer or adjust their viewing position to read the QR label or pairing instructions. We expect at least one viewing adjustment accompanied by hesitation longer than 10 seconds during discovery or pairing. | An M3 participant completes T1–T3 independently without adjusting their viewing position, requesting larger text, or hesitating for more than 10 seconds. If viewing adjustments occur but completion remains smooth, we will reconsider our assumption that these adjustments indicate difficulty. |

We will record contradictory evidence as carefully as supporting evidence. A contradictory valid session will challenge the corresponding prediction; mixed outcomes will be reported as variation within the model.

Verified technical failures will be handled under A4 and will not count as participant difficulty. If no recruited participant matches a model, its prediction will remain untested. Because each model combines several characteristics, we will not attribute an observed difficulty to a single characteristic without additional evidence.

## 7. Pilot

P01: a classmate from EA234506, on a laptop-touch + own phone
