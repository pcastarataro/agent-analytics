# Delta for Usage Collector

## MODIFIED Requirements

### Requirement: Startup Self-Check

On startup, the plugin SHALL call `buildIndex(dirs)` which performs a recursive readdir of configured definition directories and builds a `Map<name, {path, type}>` index. This step MUST NOT read file contents or upload definitions. The startup heartbeat log SHALL confirm index population (definition count). `buildIndex` MUST complete in <50ms for typical installs (~100 definitions).
(Previously: Startup scanned all definition files eagerly — reading every SKILL.md/agent.md, computing hashes, and uploading via PUT.)

#### Scenario: Index built without file reads

- GIVEN configured definition directories containing skill and agent files
- WHEN the plugin starts
- THEN `buildIndex` populates the name→path index, no file contents are read, and no uploads occur

#### Scenario: Startup heartbeat confirms index

- GIVEN the plugin finishes startup
- WHEN the heartbeat log entry is emitted
- THEN it reports the number of definitions indexed

#### Scenario: Index build under time budget

- GIVEN ~100 definition files across directories
- WHEN `buildIndex` runs
- THEN it completes in <50ms

## ADDED Requirements

### Requirement: Lazy Definition Upload

`ensureDefinition(hash, name?)` SHALL resolve definitions lazily on cache miss. When a name is provided and found in the index, the system MUST read the file at the resolved path, compute its hash, and upload via PUT. When the name is missing or not in the index, the system SHALL still cache the hash to prevent retry loops (hash-only guard preserved). Uploads MUST be fire-and-forget — they MUST NOT block event delivery.
(Previously: No lazy upload behavior existed; definitions were uploaded eagerly at startup.)

#### Scenario: Cache miss triggers lazy upload

- GIVEN an event referencing definition name "research-skill" not yet in the hash cache
- WHEN `ensureDefinition` is called with the name and hash
- THEN the file is read from the index-resolved path, hashed, and uploaded via PUT; the hash is cached for future hits

#### Scenario: Cache hit skips upload

- GIVEN a definition hash already cached from a prior event
- WHEN `ensureDefinition` is called with the same hash
- THEN no file read or upload occurs

#### Scenario: Name not in index falls back to hash-only guard

- GIVEN an event referencing definition name "unknown-skill" not present in the index
- WHEN `ensureDefinition` is called
- THEN the hash is cached (preventing retry loops), a warning is logged, and no upload occurs

#### Scenario: Fire-and-forget upload does not block delivery

- GIVEN a lazy upload triggered by a cache miss
- WHEN the upload is initiated
- THEN event delivery continues without waiting for the upload to complete

### Requirement: Event-to-Definition Name Threading

`enqueueEvent` SHALL extract the definition name (skill name or agent name) from the event fields and pass it to `ensureDefinition`. The name extraction MUST be best-effort — missing or ambiguous names MUST NOT throw or block the event path.
(Previously: `ensureDefinition` received only a hash; no name was passed from the event context.)

#### Scenario: Skill event passes skill name

- GIVEN an enqueued event with `skill.name = "research"`
- WHEN the event reaches the definition upload path
- THEN `ensureDefinition` receives `name = "research"` alongside the hash

#### Scenario: Agent event passes agent name

- GIVEN an enqueued event with `agent.name = "coder"`
- WHEN the event reaches the definition upload path
- THEN `ensureDefinition` receives `name = "coder"` alongside the hash

#### Scenario: Missing name does not block

- GIVEN an enqueued event with neither `skill.name` nor `agent.name`
- WHEN the event reaches the definition upload path
- THEN `ensureDefinition` is called with `name = undefined` and the hash-only guard applies

## REMOVED Requirements

None.
