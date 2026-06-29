# Development Guidelines for AI Agents

This file contains important rules and guidelines for AI agents working on this project. Follow them strictly to prevent regressions.

## Code Quality and Testing Requirements

### Rule: Always Run Tests and Checks Before Completing Changes

Before considering any change complete, **you MUST** run both of the following commands:

```bash
bun run test
bun run check
```

- `bun run test`: Runs all unit tests to ensure functionality is not broken
- `bun run check`: Runs both `bun run typecheck` (TypeScript type checking) and `bun run lint` (Biome)

**Both commands must pass with zero failures and zero errors before a change can be considered complete.**

If either command fails:
1. Fix all reported issues
2. Re-run both commands to verify the fixes
3. Only then consider the change complete

This prevents regressions and ensures code quality standards are maintained.

## Architecture

This is an additive Pi extension: it registers `/share-og` and never touches the
built-in `/share` command. Two HTML-export strategies are supported:

- **B1 (default)**: shell out to the public `pi --export <session>` CLI. Zero
  coupling, survives internal Pi refactors.
- **B3 (opt-in via `PI_OPENGIST_USE_INPROCESS=1`)**: deep-import Pi's internal
  `exportSessionToHtml` for an in-process fast path. Relies on an internal
  module path and may break on minor Pi versions — always degrade gracefully.

External collaborators (`spawn`, `fetch`, `fs.readFileSync`) are injectable via
the options objects so the command logic stays unit-testable without spinning
up real subprocesses or network calls.
