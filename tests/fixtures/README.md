# Real-data fixtures

Regular tests in this repo mostly use hand-picked numbers chosen to exercise
one branch of one function. That's fine for pinning logic, but it can't catch
a regression that only shows up on a real, messy, actually-recorded site —
the class of bug this whole project keeps finding (GH-351/352/353/354/355:
none of them were caught by synthetic test numbers, all of them were found by
manually cross-checking a live site against the database).

**Convention:** whenever a real production/test-server site+sample gets
manually verified end-to-end (DB values confirmed via `docker exec ... mysql`,
UI screenshot, and/or a live console log), save that verified snapshot here as
a fixture, and write a test that recomputes from the fixture's raw inputs and
asserts the exact confirmed-correct outputs. This turns a one-off manual
verification into permanent regression coverage instead of a chat transcript
nobody re-checks.

## Fixture shape

```jsonc
{
  "_source": "how this was pulled + when + which real record",
  "_verifiedVia": ["db", "ui", "live-export"],   // how the expected values were confirmed
  "site": { "id": "...", "name": "..." },
  "sample": { "id": 141, "label": "Soccer", "sampleDate": "2026-08-17" },
  "inputs": { /* raw values as stored/observed — soil ppm, species, texture, N program, etc. */ },
  "expected": { /* the real, confirmed-correct outputs, per function/module tested */ }
}
```

## Pulling a fresh fixture

The dev stack runs in Docker (`gilba_mysql`, `gilba_app`, `gilba_web`). Read
directly rather than asking the user to paste values by hand:

```bash
docker exec gilba_mysql mysql -ugilba -pgilba_secret gilba -e "
SELECT JSON_PRETTY(payload) FROM samples WHERE id = <id>;"

docker exec gilba_mysql mysql -ugilba -pgilba_secret gilba -e "
SELECT JSON_PRETTY(JSON_EXTRACT(config, '\$.turf'))
FROM site_configs WHERE site_id = '<site-id>' AND namespace = 'gaip';"
```

Cross-check against the live UI (Data page for the sample's soil values,
Export Centre for the computed program) via the Playwright driver pattern
established in this project (login -> navigate -> screenshot / capture
console / download+unzip the .docx with `textutil -convert txt -stdout`).

## What NOT to put here

Don't fabricate a fixture's "expected" block from what you think the code
*should* do — only from what was actually observed working correctly (DB
value -> confirmed correct rendered output). If the current wiring has a known
gap (e.g. GH-355's texture/species resolution not reaching the certificate
lookup), the fixture should test the underlying calculation function directly
with the *real, correct* inputs (bypassing the broken wiring), not encode the
wiring bug as if it were the spec.
