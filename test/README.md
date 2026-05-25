# Testing

This is the single source for testing this package — quick start at the top, comprehensive reference below.

## Quick start

```bash
node --version           # >= 20.19 (matches engines.node)
npm install
npm test
```

Other useful invocations:

```bash
npm test -- --watch                       # rerun on file changes
npm test -- --coverage                    # generate coverage report
npm test -- test/read-node.test.js        # one file
npm test -- --testNamePattern="discover"  # filter by name
npm test -- --verbose                     # per-test output
npm test -- --detectOpenHandles           # find timer/socket leaks

npm run lint                              # eslint flat config
npm run lint:fix                          # auto-fix
```

Coverage report lands in `coverage/lcov-report/index.html` after a `--coverage` run.

### Minimal test skeleton

Copy this as a starting point for a new spec file. Save as `test/<feature>.test.js`:

```javascript
const helper = require("node-red-node-test-helper");
const configNode = require("../nodes/config.js");
const readNode = require("../nodes/read.js");

helper.init(require.resolve("node-red"));

describe("feature name", () => {
    beforeEach((done) => helper.startServer(done));
    afterEach((done) => helper.unload().then(() => helper.stopServer(done)));

    it("should do something specific", (done) => {
        const flow = [
            { id: "c1", type: "goodwe-config",
              host: "192.168.1.100", port: "8899", protocol: "udp", family: "ET" },
            { id: "n1", type: "goodwe-read", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        helper.load([configNode, readNode], flow, () => {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");
            n2.on("input", (msg) => {
                try {
                    expect(msg.payload).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });
            n1.receive({ payload: true });
        });
    });
});
```

See `test/read-node.test.js`, `test/info-node.test.js`, `test/discover-node.test.js`, `test/config-node.test.js` for canonical per-node examples; `test/connectivity.test.js` for protocol-layer / socket-mocking patterns.

### Pre-commit checklist

1. `npm run lint` — zero errors
2. `npm test` — all green
3. Coverage maintained or improved (`npm test -- --coverage`)
4. Commit follows [`CONTRIBUTING.md`](../CONTRIBUTING.md) conventional format

---

# Comprehensive reference

## Overview

This project follows test-driven development:

- All features have tests before implementation
- Coverage thresholds (enforced by CI): ≥ 70% across statements / functions / lines / branches
- CI runs on every push and PR against `main` (Node 20/22/24/26 matrix)

## Test framework

| Tool | Purpose |
|---|---|
| [Jest 30](https://jestjs.io/) | Test runner |
| [node-red-node-test-helper](https://github.com/node-red/node-red-node-test-helper) | Loads Node-RED nodes in-process for testing |
| Istanbul (via Jest) | Coverage |
| ESLint 10 (flat config) | Lint |

Configuration files:

- `jest.config.js` — Jest configuration + coverage thresholds
- `eslint.config.js` — ESLint flat config
- `.github/workflows/ci.yml` — CI pipeline

## Writing tests

### File layout

Test files live in `test/` and end with `.test.js`. The basic skeleton is in the Quick start above. The structural pieces:

1. **Require the production module and the helper**. Worker nodes (`read`, `info`, `discover`) need the `config` module loaded alongside them — `helper.load([configNode, readNode], ...)`.
2. **`helper.init(require.resolve("node-red"))`** at module scope, once.
3. **`beforeEach`/`afterEach`** start/stop the helper's embedded Node-RED server. The `afterEach` should use `helper.unload().then(() => helper.stopServer(done))` for proper sequencing.
4. **Build a flow array** with config + worker + a `type: "helper"` capture node, wired via `wires`.
5. **`helper.load(...)`** instantiates the flow; in its callback, fetch nodes by `helper.getNode(id)`, attach `n2.on("input", ...)` to assert on output, and call `n1.receive(...)` to drive input.

### Node-RED test helper API

**Loading nodes:**

```javascript
helper.load(readNode, flow, callback);                  // single node
helper.load([configNode, readNode], flow, callback);    // multiple
```

**Getting node references:**

```javascript
const node = helper.getNode("n1");
const helperNode = helper.getNode("n2");
```

**Sending messages to a node:**

```javascript
node.receive({ payload: "test" });
node.receive({
    payload: { sensor_id: "vpv1" },
    topic: "custom/topic"
});
```

**Listening for output:**

```javascript
helperNode.on("input", (msg) => {
    expect(msg.payload).toBeDefined();
    done();
});
```

**Triggering a node's close handler:** use `helper.unload()` from the `afterEach`. Do **not** `node.emit("close", cb)` — the callback argument doesn't get passed through correctly.

## Mocking the network layer

We don't connect to real inverters in tests. Two patterns work; pick one per spec:

**Pattern A — replace `handler.socket` with a fake EventEmitter** (preferred for socket-lifecycle tests):

```javascript
const { ProtocolHandler } = require("../lib/protocol.js");
const EventEmitter = require("events");

const handler = new ProtocolHandler({ protocol: "udp", timeout: 5000 });
const fake = new EventEmitter();
fake.send = () => { /* never invokes callback */ };
handler.socket = fake;

const pending = handler.sendCommand(Buffer.from([0x01]));
setImmediate(() => fake.emit("close"));   // or "data", "error", "message"
await expect(pending).rejects.toThrow(/closed during request/);
```

**Pattern B — replace `handler._sendCommandImpl` with a controllable async function** (preferred for queue / retry / timing tests):

```javascript
handler._sendCommandImpl = async (cmd) => {
    // Custom behavior — return a Buffer to resolve, throw to reject.
    return Buffer.from([cmd[0]]);
};

// Drive the public sendCommand() to exercise the FIFO queue, retry logic, etc.
```

Patterns C — mocking `dgram` / `net` modules — works but is brittle; prefer A or B.

## TDD workflow

### Red-Green-Refactor

1. **RED** — write the failing test first:

   ```javascript
   it("should reject input while a read is in flight", (done) => {
       // n1 has isReading=true; second receive should be dropped with a warn
       done();
   });
   ```

2. **GREEN** — minimum implementation to make it pass.
3. **REFACTOR** — clean up while tests stay green.

### Convention

Tests are documentation. Names should read like prose: *"should reject concurrent input-driven reads"*, not *"test concurrency"*.

## Common test patterns

### Asynchronous flows

```javascript
n2.on("input", (msg) => {
    try {
        expect(msg.payload).toBeDefined();
        done();
    } catch (err) {
        done(err);
    }
});
n1.receive({ payload: true });
```

The `try/catch + done(err)` wrapping is necessary — a thrown assertion inside an event handler doesn't fail the test, it just throws into Node-RED's event loop. Catch and call `done(err)`.

### Error-path assertions

```javascript
it("should fire Catch when host is invalid", (done) => {
    // Worker node calls node.error(err, msg); intercept via spy.
    const originalError = n1.error.bind(n1);
    let errCalls = 0;
    n1.error = (err, msg) => { errCalls++; return originalError(err, msg); };
    n1.receive({ payload: true });
    setTimeout(() => {
        expect(errCalls).toBeGreaterThan(0);
        done();
    }, 100);
});
```

### Status updates

```javascript
const statusCalls = [];
const orig = n1.status.bind(n1);
n1.status = (s) => { statusCalls.push(s); orig(s); };

n1.receive({ payload: true });
setTimeout(() => {
    expect(statusCalls.some(s => s.text === "reading...")).toBe(true);
    done();
}, 50);
```

### Timer-driven tests

If you need to drive scheduled timers (polling, idle timer, status reset), `jest.useFakeTimers()` + `jest.advanceTimersByTime(ms)` is reliable. See `test/node-helpers.test.js` for the established pattern.

For real-time waits, **don't** use `setInterval` inside the test — it leaks across tests. Use explicit `setTimeout` handles with `clearTimeout(h)` in a `finally`:

```javascript
const handles = [];
for (const delay of [70, 140, 210]) {
    handles.push(setTimeout(() => fake.emit("data", Buffer.from([0xAA])), delay));
}
pending.catch(() => {}).finally(() => handles.forEach(clearTimeout));
```

## CI integration

GitHub Actions runs every push and PR against `main`:

- Matrix: Node 20.x / 22.x / 24.x / 26.x
- `fail-fast: false` (one version failing doesn't abort the others)
- Steps: `npm ci` → `npm run lint` → `npm test -- --coverage`
- Coverage is generated locally per job (Jest's threshold in `jest.config.js` is the gate); per-job artifacts are uploaded as `test-results-<node-version>` with 7-day retention
- `concurrency` group cancels superseded PR runs

Current workflow: `.github/workflows/ci.yml`.

### Coverage thresholds (in `jest.config.js`)

All four metrics share the same floor: **70%**. Current coverage sits comfortably above (statements ≈84%, branches ≈78%) — the floor is the safety net, not the target.

## Troubleshooting

### "Worker process has failed to exit gracefully"

A test leaked a timer or socket. Usually harmless cosmetic — the suite still completes. To find the offender:

```bash
npm test -- --detectOpenHandles
```

### "Coverage threshold not met"

A green-test PR can still fail CI here. Generate the report, open it, fill the gaps:

```bash
npm test -- --coverage
open coverage/lcov-report/index.html   # macOS
xdg-open coverage/lcov-report/index.html   # Linux
```

### Tests timing out

Either a missing `done()` or a real hang. Bump the per-test budget if the test genuinely needs longer:

```javascript
it("slow path", (done) => { /* ... */ }, 10000);   // 10s
```

For protocol-layer tests, a hang often means a fake socket never fired the event the production code is waiting on — check that the `setImmediate`/`setTimeout` driving the fake actually runs before the test timeout.

### `caughtErrorsIgnorePattern: "^_"` lint warning

ESLint 10's `no-unused-vars` rule warns on `catch (err)` where `err` is unused. Use `catch (_err)` for intentionally-unused caught errors. See [`AGENTS.md`](../AGENTS.md) for the codebase convention.

## Contributing tests

When adding tests:

1. Follow the Red-Green-Refactor workflow
2. Descriptive names that read like documentation
3. Keep tests independent — no shared state across `it()` blocks
4. Mock external dependencies (sockets, timers) — never call a real inverter
5. Maintain or improve coverage
6. All tests must pass locally before opening a PR

## Resources

- [Jest documentation](https://jestjs.io/docs/getting-started)
- [Node-RED test helper](https://github.com/node-red/node-red-node-test-helper)
- [Node-RED creating nodes](https://nodered.org/docs/creating-nodes/)
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — broader contributor workflow
- [`AGENTS.md`](../AGENTS.md) — AI-assistant operating guide
