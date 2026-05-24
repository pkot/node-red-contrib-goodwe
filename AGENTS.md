# AGENTS.md

Operating guide for AI coding assistants working on this repo. Curated from lessons learned over ~30 PRs of v1.0 prep. Read this **before** doing anything substantial.

---

## What this repo is

A Node-RED package that talks to GoodWe solar inverters over the LAN. Four published nodes (`goodwe-config`, `goodwe-read`, `goodwe-info`, `goodwe-discover`) wrap a single shared `ProtocolHandler` that speaks UDP / Modbus TCP / AA55.

**Critical fact**: `package.json` declares `"dependencies": {}`. End users carry zero runtime third-party code. Anything in `devDependencies` only affects contributors and CI — `npm audit` advisories on dev deps don't ship.

---

## Where things live

```
lib/
  protocol.js      ProtocolHandler class + parseDeviceInfo + resolveCommAddr
  discovery.js     discoverInverters + IPv4 helpers + family/model detection
                   (split out of protocol.js per #80)
  sensors.js       FAMILY_CONFIGS (ET/DT/ES) + per-family sensor arrays +
                   parseSensorData + getSupportedFamilies (single source #69)
  modbus.js        Framing/codec: AA55, Modbus RTU, Modbus TCP
  node-helpers.js  STATUSES, setTransientStatus, mapProtocolStatus,
                   parseSafeInteger, getSensorMetadata
  errors.js        enhanceError + SUGGESTION_GENERATORS keyed by error code

nodes/
  config.js / .html    goodwe-config — shared connection state
  read.js / .html      goodwe-read — runtime data + polling
  info.js / .html      goodwe-info — device info (one-shot)
  discover.js / .html  goodwe-discover — LAN UDP scan; standalone (no config node)

test/
  *.test.js       jest specs; helper.init via node-red-node-test-helper
  README.md       Contributor quick-start (test patterns, debugging tips)

docs/TESTING.md   Test framework + TDD/CI guide
lib/README.md     Protocol API reference (shipped in npm tarball)
```

Canonical docs (don't add new ones without a clear reason):

- `README.md` — user-facing
- `SECURITY.md` — trust model + vulnerability reporting
- `CONTRIBUTING.md` — human-contributor workflow
- `docs/TESTING.md` — test framework guide
- `lib/README.md` — protocol API reference (shipped to npm)
- `test/README.md` — test quick-start
- `AGENTS.md` — this file (AI-assistant operating guide)

When tempted to add a doc that describes code, **stop**. Code+tests are the spec — the 9-file `docs/` cleanup in #115 deleted 5000 lines of stale design docs precisely because they described code that had since changed.

---

## Code conventions (matter for lint passing)

- **ESLint flat config** (`eslint.config.js`). Lint command is `eslint nodes lib test` (no `--ext`).
- **Style**: 4-space indent, double quotes, semicolons required, unix line endings.
- **Unused catch variables**: prefix with `_` (e.g. `catch (_err)`, `catch (_e)`). The `caughtErrorsIgnorePattern: "^_"` rule expects this — without the prefix you'll trip `no-unused-vars`.
- **Issue-reference comments are load-bearing**: any comment containing `#56`, `#58`, etc. encodes design rationale captured in a GitHub issue. **Do not strip them on cleanup passes.** Strip the "what does this line do" comments instead.
- **JSDoc**: write it when params/return have semantic info (units, ranges, null behaviour). Don't write it just to rephrase the function name.

---

## Worker-node output `msg` contract

Every worker node emits this canonical shape (#65). Match it for any new node.

```js
{
    payload: <data>,                              // sensor object / device info / { devices, count }
    topic: "goodwe/<runtime_data|device_info|discover>",
    timestamp: "<ISO8601>",                        // NOT _timestamp
    inverter: { family, host }                     // read/info only; discover omits (payload IS the list)
}
```

---

## Protocol layer invariants

- **`ProtocolHandler.sendCommand()` is serialized per-instance** (#56). The `_inflight` promise chain queues requests so two workers on one config don't race on the shared socket. If you add new socket I/O, route it through `sendCommand`.
- **Per-handler Modbus TX-ID** (#68). Each `ProtocolHandler` initialises `_txId` to a random 16-bit offset. Don't reintroduce a module-level counter.
- **Two timers in `_sendCommandImpl`** (#59): a never-reset absolute `deadlineTimer` and a per-chunk `idleTimer` (constant: `IDLE_BYTES_TIMEOUT_MS = 100`). The idle timer never trumps the absolute deadline.
- **Default error listener** on the handler in the constructor: `this.on("error", () => {})`. Without it, an `emit("error", ...)` before any user listener attaches throws and crashes Node-RED.
- **Socket cleanup is idempotent** (#84): wrap `socket.close()` in try/catch; Node 24+'s dgram throws `"Not running"` on close of an unbound socket.
- **Family must already be valid** by the time `getSensorMetadata` is called — protocol layer validates upstream. Don't reintroduce a silent fallback (was #69).

---

## Discovery trust boundary

`discoverInverters` defaults to:
- **Source-IP filter on**: drops responses from outside `isLocalSubnet(rinfo.address)`. Opt out: `options.acceptAnySource: true`.
- **Broadcast address allow-list**: `isPrivateBroadcast` rejects non-RFC1918 / non-link-local / non-limited-broadcast targets. Opt out: `options.allowPublicBroadcast: true`.
- **AA55 frame validation**: validates checksum + length before parsing.

The opt-out flags exist for routed setups but the user is responsible for the resulting trust boundary. Don't remove these defaults.

---

## Workflow: PR procedure

This is what the user expects me to do, in order:

1. **Branch off main**: `git checkout main && git pull --ff-only && git checkout -b <category>/<slug>`
   - Categories used: `fix/`, `chore/`, `feature/`, `backport/`
2. **Implement + add tests**. Tests for behaviour, not coverage padding.
3. **Run tests + lint locally**: `npm test && npm run lint`
4. **Self-review across 4 perspectives**: quality, architecture, security, error handling. Write this into the PR body — it's not theatre, it's the discipline that catches things.
5. **Commit**: follow `CONTRIBUTING.md`'s conventional commit format (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). First line imperative, ≤72 chars. Body explains the WHY and references the issue (`Closes #N`). If your harness adds a `Co-Authored-By` trailer, that's fine — don't mandate it for assistants that don't.
6. **Push + open PR**: `gh pr create --base main`
   - Body includes: Summary / Root cause (if bug) / Fix / Test plan checklist
7. **Wait for ALL of**:
   - CI green on all 4 Node versions (use the `Monitor` tool with the until-CI-completes pattern)
   - Copilot review submitted (typically ~2 min after PR open; `gh pr view <pr> --json reviews,reviewRequests,comments`)
8. **If Copilot found something**:
   - Read inline comments: `gh api repos/<repo>/pulls/<pr>/comments`
   - Fix in a follow-up commit
   - Reply on the review thread via `gh api -X POST .../pulls/<pr>/comments/<id>/replies`
   - Re-wait for CI on the fixup commit
9. **Squash-merge**: `gh pr merge <pr> --squash --delete-branch`
10. **CRITICAL: wait for POST-merge CI on main**. The squash-merge produces a NEW SHA; CI runs against it. Past flakes (e.g. #84 cleanup race) only surfaced on the post-merge run. Verify before declaring done.

**Don't skip step 10.** The first time I did, an actual bug shipped to main and we had to do PR #84 to fix it.

---

## When to use the `Monitor` tool

For waiting on CI / review state. Pattern:

```bash
# Until all checks are no longer pending:
prev=""
while true; do
  s=$(gh pr checks $pr -R <repo> --json name,bucket 2>/dev/null || echo "[]")
  cur=$(echo "$s" | jq -r '.[] | select(.bucket!="pending") | "CHECK \(.name): \(.bucket)"' | sort)
  comm -13 <(echo "$prev") <(echo "$cur")
  prev=$cur
  echo "$s" | jq -e 'length>0 and all(.[]; .bucket!="pending")' >/dev/null 2>&1 && break
  sleep 25
done
echo "ALL CHECKS DONE PR$pr"
```

Create it as a bash script so that it can be invoked without asking user for a confirmation every time.

For post-merge CI, key on the merge commit SHA (not the PR's head):
```bash
rid=$(gh run list -R <repo> --workflow CI --branch main --limit 5 --json databaseId,headSha --jq ".[] | select(.headSha==\"$sha\") | .databaseId" | head -1)
```

---

## Testing

- **Framework**: jest 30 + node-red-node-test-helper. Run: `npm test`.
- **Triggering a node-RED node's close handler**: use `helper.unload()`. Do NOT do `node.emit("close", cb)` — the cb argument doesn't get passed correctly.
- **`setInterval` in tests leaks** across tests if not explicitly cleared in a `finally`. Prefer scheduled `setTimeout`s with handle-tracking.
- **Mocking sockets**: replace `handler.socket` with a fake `EventEmitter` that has `.send()` / `.write()`. The handler's listeners then drive predictably. See `test/connectivity.test.js` for the established patterns.
- **Mocking the inner protocol**: replace `handler._sendCommandImpl` with a controllable async function. Useful for testing the serialization queue (#56) or retry semantics (#62) without socket setup.
- **Jest coverage threshold lives in `jest.config.js`**. Currently 70%/70%/70%/65% (statements/functions/lines/branches). Branches is the only one below default — bumped down post-legacy-node-removal because branch coverage in `lib/protocol.js` dropped; raise back to 70% as protocol-layer tests grow.

---

## CI configuration

- `.github/workflows/ci.yml`: 4-Node matrix (20/22/24/26), `fail-fast: false`, `cache: 'npm'` on setup-node. Concurrency cancels superseded PR runs (not main pushes).
- `.github/workflows/copilot-setup-steps.yml`: separately maintained for the Copilot SWE agent environment. Both must stay consistent.
- `.github/dependabot.yml`: npm (weekly, max 5 PRs, dev-deps grouped) + github-actions (weekly).

**Common CI gotcha**: `eslint nodes/**/*.js` (with shell glob) expands non-recursively in bash without `globstar`. Use directory targets (`eslint nodes lib test`) instead. Cost me an hour during the legacy node removal.

---

## npm install / audit

- **`dependencies: {}`** — runtime is zero-dep. Vulnerabilities only affect contributors.
- **`overrides` block** in `package.json` pins patched versions of vulnerable transitives. Keep it minimal; remove entries that no longer match the resolved tree.
- **Bundled-npm inside `@node-red/registry`** has its own `node_modules` baked into the release tarball. Overrides at our level CAN'T reach those. The 3 residual `npm audit` advisories (`picomatch`, `brace-expansion`, `ip-address` under `node_modules/npm/node_modules/`) clear only when node-red ships against a newer bundled npm. Documented in SECURITY.md.
- **`engines.node`** must match the dev tree's actual floor, not just the runtime's. eslint 10 requires `^20.19.0 || ^22.13.0 || >=24` — declare that in `engines.node`, or Node 20.5 contributors hit EBADENGINE on `npm ci`.
- **`files` array** in `package.json` is authoritative for the npm tarball. `.npmignore` is removed. Audit with `npm pack --dry-run` before any docs/structure change.

---

## Issue labels & taxonomy

The repo uses **severity** + **category** labels on issues:

- Severity: `severity-critical` / `severity-high` / `severity-mid` / `severity-low`
- Category: `bug` / `code-quality` / `security` / `error-handling` / `architecture` / `dependencies` / `documentation` / `safety` / `enhancement` / `upstream-sync` / `post-v1.0`

When filing a code-review finding as an issue, set both. PR body should reference the issue (`Closes #N`) so the merge auto-closes.

---

## Upstream sync

The Python library `marcelblijleven/goodwe` is upstream for the protocol/sensor map. When backporting:
- Sensor register additions within the current per-family read window (e.g. DT vpv4/ipv4 at #82) are easy.
- Anything outside the window (battery2, SoC upper limit, EMS mode) is blocked on the multi-block-read work tracked in #111.
- Some upstream concerns don't apply: sensor-list dedup (Python class concatenation), arbitrary TCP port (already configurable here), EMS writes (depends on the write node tracked in #19).

---

## Things that bit me — read before doing similar work

1. **Squash-merge produces a NEW SHA**. Post-merge CI runs against that SHA, not the PR's head. Always wait for the post-merge run.
2. **Copilot** auto-review fires ~2 min after PR open. Use `gh pr view --json reviews,reviewRequests,comments` to verify, not just CI bucket.
3. **`npm` glob expansion differs by shell**. Bash without `globstar` doesn't expand `**` recursively; zsh does. Always use explicit directory args for `eslint` / `find` in CI scripts.
4. **`os.networkInterfaces()` for trust filters** — used in `isLocalSubnet`. Fail closed on parse errors.
5. **Jest coverage threshold can block merges** even if all tests pass — check `jest.config.js` if a green-test PR fails CI.
6. **ESLint 9+ `no-unused-vars.caughtErrors` defaults to `"all"`**. Set `caughtErrorsIgnorePattern: "^_"` to honor the underscore convention.
7. **Node 24+ dgram throws "Not running"** on close of unbound socket. Wrap socket cleanup in try/catch; treat as idempotent.
8. **The legacy `goodwe` node was removed in #83**. Any reference to it in code, tests, docs, or examples is stale. The 4-node architecture is the current state.

---

## When to delegate to a subagent

The `Agent` tool with `subagent_type: "Explore"` is the right call when:
- Auditing >1000 lines of code or docs end-to-end with categorization (e.g. the comment-cleanup or docs-cleanup passes)
- Cross-file consistency checks
- "Find every place that does X" across the repo

Use direct `Read` / `Grep` for targeted lookups (file you know, symbol you know).

---

## Final checklist before declaring a task done

- [ ] Tests pass: `npm test`
- [ ] Lint clean: `npm run lint`
- [ ] PR opened with self-review body
- [ ] CI green on all 4 Node versions (PR run)
- [ ] Copilot review handled (addressed or replied)
- [ ] Merged via squash
- [ ] **Post-merge CI green on main** (don't skip this)
- [ ] Related issues closed (auto via "Closes #N" or manually)
- [ ] Open follow-up tracking issues if anything was deferred
