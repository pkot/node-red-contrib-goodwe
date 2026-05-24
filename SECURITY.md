# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities by [opening a private security advisory](https://github.com/pkot/node-red-contrib-goodwe/security/advisories/new) on the repository. Do not file a public issue.

Include:
- A description of the vulnerability and its impact.
- Steps to reproduce (or a proof of concept).
- The package version and Node.js version you tested against.
- Any suggested mitigation.

We aim to acknowledge reports within 7 days.

## Supported Versions

Only the latest released minor version receives security fixes.

## Dependency vulnerabilities

This package ships with **zero production dependencies** (`"dependencies": {}` in package.json), so users installing via `npm install node-red-contrib-goodwe` carry no third-party code from this project.

`npm audit` on a fresh clone reports vulnerabilities, but every one is in a **dev-only transitive dependency** under `node-red`, `node-red-node-test-helper`, `jest`, or `eslint`. We hold these in check via the `overrides` block in `package.json` (qs, path-to-regexp 0.1.x, nise, picomatch, brace-expansion, ip-address, diff).

A residual handful of advisories come from inside the **bundled `npm@10.9.8`** distribution that `@node-red/registry` pre-installs (`node_modules/npm/node_modules/*`). These are baked into npm's release tarball and cannot be moved by this repo's overrides; they will clear once node-red ships a release built against a newer registry / bundled npm. They do not affect end users (zero runtime deps) and they do not affect the Node-RED runtime path the worker nodes exercise — only the bundled-npm code that the registry uses for installing other Node-RED nodes from inside Node-RED.

## Trust Model

This package speaks AA55 and Modbus TCP/RTU to GoodWe inverters over the local network. Both protocols use **error-detection codes (16-bit byte-sum checksum / CRC16), not authentication**. The full protocol spec is publicly documented in the upstream Python library, so anyone can fabricate syntactically valid frames.

### What this package mitigates

- **Discovery spoofing from outside the local subnet**: `discoverInverters` rejects responses whose source IP is outside the local subnet of any of the Node-RED host's network interfaces by default. Loopback is always trusted. Opt out with `options.acceptAnySource: true` only for routed setups, knowing you accept the trust boundary that creates.
- **Frame-level garbage**: discovery and runtime reads validate AA55 / Modbus framing (length + magic bytes + checksum) before parsing. Malformed packets cannot corrupt parser state or trigger out-of-bounds reads.
- **Cross-session response injection**: Modbus TCP transaction IDs are per-`ProtocolHandler` instance with a random initial offset, so the TX ID for one inverter session cannot be predicted by observing traffic for another session in the same Node-RED process.
- **Concurrent request races**: a per-handler FIFO queue serializes `sendCommand()` so concurrent worker nodes against the same config cannot interleave responses on the shared socket.

### What this package does NOT protect against

- A hostile device on the same L2 segment that forges AA55 / Modbus frames with valid checksums.
- TCP session hijacking by an L2 attacker.
- DNS or ARP spoofing redirecting the configured host to an attacker.
- A compromised inverter or a man-in-the-middle that the user has explicitly opted to trust via `acceptAnySource: true`.

These limitations are inherent to the protocol, not specific to this implementation.

### Operational guidance

- Do not run Node-RED on an L2 segment shared with untrusted devices when GoodWe data drives consequential automation (load-shedding, EV charging schedules, battery dispatch).
- If you can, put your inverter on a separate VLAN or routed segment with a DHCP reservation, and pin the configured host IP.
- Validate sensor values downstream when they drive decisions — `battery_soc` must be 0–100, energy counters monotonic except after explicit reset, etc.
- Keep Node-RED credentials and `flows_cred.json` private — `goodwe-config` does not store sensitive credentials today, but flow-import auditing protects you against malicious flow JSON that points at attacker-controlled hosts.
