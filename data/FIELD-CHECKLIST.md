# Field-day checklist (Studies 1 and 2)

Print this. Full formats and commands: [README.md](README.md).

## Before the first field day
- [ ] `backend/serviceAccountKey.json` is filled in and `npm start` shows no Firebase warning
- [ ] Phones reach the app over a stable HTTPS host. Phone browsers block the camera and compass over plain `http://` or a raw IP address.
- [ ] `site.json` has `north_offset_deg` (from `groundtruth.py --write`) and `magnetic_declination_deg`
- [ ] `npm run import-site -- <site>` has run with no warnings
- [ ] Anchors are printed from `npm run anchors -- <site> --base https://<stable-host>`, mounted, and match `waypoints.csv`
- [ ] `survey_points.csv` points are marked on the floor (tape + label)
- [ ] The §6 ground-truth paragraph is written
- [ ] Every phone: on iOS, Settings → Safari → Motion & Orientation Access is ON. Battery is above 60%. Auto-lock is off. Portrait orientation is locked.

## Each session, each phone
- [ ] Open the study URL with a **short, consistent `device=` label** (e.g. `pixel7`, `iphone12`) and your `pid=`
- [ ] The compass status line shows a heading, and the event type is **`deviceorientationabsolute`** or **`webkit`**. If it says `relative`, that phone/browser can't be used for Study 1. Note it for the device table.
- [ ] Keep keys, bags, laptops and other phones at least 1 m away from the measuring phone

## Study 1 — per point (`/ar?study=1&site=…&point=P01&device=…&pid=…`)
- [ ] Phone flat on the floor mark, **top edge along the point's alignment direction**
- [ ] Tap Capture, then hands off for the full 3 s settle and 10 s capture
- [ ] Check the summary: about 50 samples, spread under 5°, "absolute"; otherwise recapture
- [ ] Write anything unusual next to the point on paper (people nearby, a lift moving, a door left open)
- [ ] Tap "Next point"

## Study 2 — per route (`/ar?log=1&device=…&pid=…`)
- [ ] Stand at the anchor, **point the camera at the QR code** and scan in-page. The calibrate button should be green ("calibrated at this marker").
- [ ] Pick the destination and tap Start Navigation
- [ ] Walk at a steady pace along the corridor centre line, phone held up, pointing in the direction of travel
- [ ] Tap "I'm here" exactly as you pass each waypoint. Position comes from these taps.
- [ ] At the destination, wait until "waiting" reaches 0 before starting the next route
- [ ] Record route, start time and anything unusual on paper

## End of day
- [ ] Every phone shows **0 batches waiting**
- [ ] `cd backend && npm run export`, then `python scripts/analyse.py --site <site>` as a sanity check. Problems found today cost a day; problems found next week cost a week.
- [ ] Copy the paper notes into a dated file next to the export
