# Monorepo Scaffold Specification

## Purpose

Defines the repository skeleton for the agent-analytics platform: npm workspaces layout, shared strict TypeScript toolchain, root tooling commands, empty package skeletons, and git bootstrap rules. Every downstream capability (collector plugin, API server, persistence, dashboard) builds on this scaffold.

## Requirements

### Requirement: npm Workspaces Layout

The root `package.json` SHALL declare npm workspaces covering exactly six packages: `apps/api`, `apps/dashboard`, `packages/opencode-collector`, `packages/event-schema`, `packages/database`, `packages/shared`. Every workspace SHALL be named `@agent-analytics/<name>` and cross-package dependencies MUST use these workspace names — never relative file paths or bundler path aliases.

#### Scenario: Workspace resolution from root

- GIVEN the root `package.json` declaring the six workspaces
- WHEN `npm install` completes and each `@agent-analytics/*` name is resolved from a sibling workspace
- THEN all six names resolve to their package directories via the workspace link

#### Scenario: Workspace-named dependency import

- GIVEN a skeleton package that depends on another via its `@agent-analytics/*` name
- WHEN its sources import that name
- THEN TypeScript resolution succeeds through the workspace link with no path-alias configuration

### Requirement: Shared Strict Toolchain Configs

A root `tsconfig.base.json` SHALL enable TypeScript strict mode including `noUncheckedIndexedAccess`. Root-level ESLint (flat config), Prettier, and a shared Jest preset SHALL exist; per-package configs MUST extend the shared ones instead of redeclaring tool behavior.

#### Scenario: Strictness is enforced

- GIVEN a tracked source using implicit `any` or an unchecked index access yielding `T | undefined`
- WHEN typecheck runs from root
- THEN compilation FAILS reporting the strict-mode errors at those sites

#### Scenario: Single shared configuration source

- GIVEN any workspace config file
- WHEN inspected
- THEN it extends/references the shared root config rather than duplicating rule values

### Requirement: Root Toolchain Commands Green on Pristine Scaffold

From the repository root, `tsc --noEmit`, `eslint .`, `prettier --check .`, and `jest` MUST each exit 0 with zero findings when run on the scaffold as committed.

#### Scenario: All four commands pass from root

- GIVEN a clean checkout with dependencies installed
- WHEN the four root commands run in sequence
- THEN every command exits 0

#### Scenario: Violation fails loudly

- GIVEN any tracked file violating lint, format, or type rules
- WHEN the matching root command runs
- THEN it exits non-zero identifying the offending file

### Requirement: Empty Package Skeletons

Each of the six workspaces SHALL contain only its `package.json`, a `tsconfig` extending the base, and a minimal compilable entry point (plus one passing placeholder test where the shared Jest preset applies). Skeletons MUST NOT contain feature code for deferred capabilities (collector plugin, API server, database access, dashboard UI).

#### Scenario: Skeleton integrity

- GIVEN the six skeleton packages with zero feature code
- WHEN all root toolchain commands run
- THEN compile, lint, format check, and tests pass while no deferred-capability modules exist

### Requirement: Git Bootstrap With Clean Initial History

The change SHALL initialize a git repository with a `.gitignore` excluding `node_modules/`, build output (`dist/`), coverage output, and local environment files. Repository history MUST BEGIN with exactly ONE conventional scaffold commit containing the whole scaffold.

#### Scenario: History starts with one clean commit

- GIVEN bootstrap completed
- WHEN `git log --oneline` runs
- THEN repository history BEGINS with exactly one conventional scaffold commit containing the whole scaffold

#### Scenario: Generated artifacts stay untracked

- GIVEN installs and test runs produced `node_modules/`, `dist/`, and `coverage/`
- WHEN `git status --porcelain` runs
- THEN none of those generated paths appear
