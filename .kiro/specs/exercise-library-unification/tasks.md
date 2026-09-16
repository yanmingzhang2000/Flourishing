# Implementation Plan: Exercise Library Unification

## Overview

Implement the approved TypeScript design incrementally: first establish a deterministic exercise-library domain and test toolchain, then migrate and publish the sole runtime library, implement pure compatibility and eligibility rules, cut server and client consumers over to adapter-backed APIs, and finally prevent all runtime legacy-data reads. A record that passes every validator rule becomes `approved` automatically; there is no manual review or approval path. Any unsupported input or requested project without a safe, fully eligible candidate returns one request-level `temporarily_unavailable` result (`暂不可生成`) without a fallback or partial persistence.

## Tasks

- [ ] 1. Establish the server exercise-library foundation and deterministic test tooling
  - [ ] 1.1 Add the pinned server test toolchain and single-run scripts
    - Modify `server/package.json` to add exact development versions `vitest@2.1.9` and `fast-check@3.23.2`, plus non-watch test scripts suitable for local and CI execution.
    - Add the minimal Vitest configuration and TypeScript test setup needed for pure modules and temporary filesystem/SQLite integration tests; do not start a watch process.
    - _Requirements: 9.1, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [ ] 1.2 Create shared canonical-library contracts and closed vocabularies
    - Create `server/src/exercise-library/types.ts` for canonical records, library metadata, validation/migration reports, eligibility assessments, availability responses, plan success responses, and client snapshots.
    - Create `server/src/exercise-library/vocabulary.ts` with the exact Project_ID, Injury_Selection, Injury_Tag, category, review-status, experience, eligibility-category sets, injury expansion map, and experience ranges; include `bodyweight` as the universal equipment value.
    - _Requirements: 2.1-2.9, 3.1-3.3, 4.1-4.6, 5.1_

- [ ] 2. Implement canonical validation and automatic status lifecycle
  - [ ] 2.1 Implement the pure library validator and evidence report
    - Create `server/src/exercise-library/validator.ts` with a non-fail-fast `validateLibrary(candidate, migrationReport)` implementation.
    - Validate required fields, JSON types, non-empty strings, ordered non-empty steps, integer bounds, cardinality/uniqueness, closed vocabulary values, duplicate IDs, safety values, and alternative missing/self/duplicate/unapproved references.
    - Produce per-record findings and the candidate summary with registry version, exact registry arrays, migration blockers, and publication-gate outcome. Derive `approved` only for records with no validation failure; otherwise retain/assign `needs_review`, with unvalidated records remaining `draft` and explicitly deprecated historical records preserved.
    - _Requirements: 2.1-2.10, 3.4-3.5, 6.1-6.2, 7.1-7.5, 9.1-9.4, 11.4_
  - [ ]* 2.2 Write validator unit tests for malformed schema, vocabulary, duplicate-ID, and reference examples
    - Cover valid records and each major validation failure, asserting machine-readable field, invalid value, rule, outcome, and registry version evidence.
    - _Requirements: 2.1-2.10, 3.4-3.5, 6.1-6.2, 9.1-9.3_
  - [ ]* 2.3 Write property test for schema and controlled-vocabulary validation
    - **Property 1: Schema and controlled-vocabulary validation is exact.**
    - Use `fast-check` to mutate valid canonical records and assert pass/fail evidence exactly matches the required schema and vocabulary rules.
    - _Validates: Requirements 1.1, 2.1-2.10, 3.2, 3.4, 7.1, 9.1, 9.3_
  - [ ]* 2.4 Write property test for alternative-reference integrity
    - **Property 2: Alternative references are valid, unique, and approved.**
    - Generate alternative graphs and assert missing, self, duplicate, and non-approved target failures are reported precisely.
    - _Validates: Requirements 6.1, 6.2, 9.2_
  - [ ]* 2.5 Write property test for automatic review-status derivation
    - **Property 3: Validation deterministically derives review status.**
    - Assert all-valid created/imported/edited records become `approved`; every invalid record becomes `needs_review` and is excluded by eligibility callers.
    - _Validates: Requirements 5.11, 7.2, 7.3, 8.6, 11.4_

- [ ] 3. Build deterministic migration, reconciliation, and initial publication artifacts
  - [ ] 3.1 Implement the offline migration CLI and reconciliation report
    - Create `server/src/exercise-library/migrate.ts` to read both legacy JSON sources in fixed path/index order and map legacy equipment, difficulty, category, muscle, project, injury, and text forms to canonical fields.
    - Emit exactly one record-level outcome per legacy record, preserve selected values and field conflicts, merge only through an explicit canonical-key selection table, and mark unsupported or incomplete data `unresolved`/blocking rather than guessing.
    - Write candidate JSON to `data/.exercise-library-candidates/` and the machine-readable migration report to `data/exercise-library-reports/`; generate the published canonical JSON only after all gates pass.
    - _Requirements: 1.1, 2.1-2.9, 3.1-3.5, 7.2-7.7, 8.1-8.8, 9.4-9.5_
  - [ ] 3.2 Generate and validate the initial canonical published library
    - Run the migration CLI against `data/exercises.json` and `src/data/exercises.json`, resolve every blocking mapping/conflict through explicit code/data mappings, and commit `data/canonical-exercise-library.json` plus immutable candidate migration and validation evidence.
    - Ensure the published library contains one canonical record per active exercise, approved only through deterministic validation, and no manual approval path.
    - _Requirements: 1.1, 1.5, 7.2, 7.6-7.7, 8.1-8.8, 9.4-9.5_
  - [ ]* 3.3 Write property test for deterministic migration and conflict evidence
    - **Property 10: Migration is deterministic and conflict-evidenced.**
    - Generate two legacy collections and mapping tables; assert supported conversion, explicit conflict selections, and blocking unresolved outcomes.
    - _Validates: Requirements 8.3, 8.4, 8.5_
  - [ ]* 3.4 Write property test for migration outcome conservation
    - **Property 11: Migration reporting conserves source records.**
    - Assert each source record has exactly one `migrated`, `merged`, or `unresolved` outcome with source and canonical/unresolved identity.
    - _Validates: Requirements 8.2, 8.7, 11.3_
  - [ ]* 3.5 Write an integration test over both actual legacy source files
    - Run the CLI in a temporary output directory and verify source-record counts equal report outcomes, reports serialize all blockers, and an unresolved candidate cannot replace a published library.
    - _Requirements: 8.1-8.8, 9.4-9.5, 11.3_

- [ ] 4. Implement published-library loading and atomic publication gates
  - [ ] 4.1 Create the published ExerciseLibraryService and atomic publisher
    - Create `server/src/exercise-library/service.ts` to load and validate only `data/canonical-exercise-library.json`, expose immutable approved records/current-content lookup, and retain the last valid cached library after a failed reload.
    - Implement candidate publication as an atomic replacement only when validation has no failure and migration has no blocking entry; persist validation evidence and retain the prior published library otherwise. Return the specified unavailable service error on invalid initial load and never consult legacy runtime data.
    - _Requirements: 1.2-1.5, 7.6-7.7, 8.8, 9.4-9.5, 10.5_
  - [ ]* 4.2 Write property test for atomic, gate-controlled publication
    - **Property 4: Publication is atomic and gate-controlled.**
    - Verify arbitrary prior/candidate/report combinations publish exactly valid non-blocking candidates and preserve prior versions for all other cases.
    - _Validates: Requirements 5.4, 7.6, 7.7, 8.8, 9.4_
  - [ ]* 4.3 Write service integration tests for published-only reads and reload failure retention
    - Use temporary candidate/published files to prove current-content lookup never reads a legacy path, successful publication is visible consistently, and failed reload retains the last valid cache.
    - _Requirements: 1.2-1.5, 7.6-7.7, 9.4_

- [ ] 5. Implement compatibility, safety, eligibility, and stable alternative selection
  - [ ] 5.1 Implement profile normalization and canonical-to-client compatibility adapters
    - Create `server/src/exercise-library/compatibility.ts` with explicit, versioned legacy mapping tables, defensive profile JSON parsing, `none -> bodyweight`, injury normalization, and diagnostics for unmatched injury/equipment/project/experience inputs.
    - Implement `canonicalToClientExercise` to preserve current React fields, canonical identity, and library version while mapping `stretch` to `cooldown`, joining tips, and keeping display text separate from eligibility.
    - _Requirements: 1.3, 4.7, 5.10, 10.1-10.4, 10.6_
  - [ ] 5.2 Implement pure safety assessment, eligibility assessment, and request-level selection
    - Create `server/src/exercise-library/eligibility.ts` to produce every category in stable order with reason codes and values, using only structured contraindications plus the exact injury expansion mapping for safety.
    - Enforce project, approved-only review state, `bodyweight`/equipment intersection, and the exact zero/occasional/regular difficulty ranges. Traverse configured alternatives in stored order, recording the first fully eligible replacement; do not search for arbitrary substitutes.
    - Generate one all-or-nothing `StructuredUnavailableResult` with `暂不可生成` for unknown injury/experience/project inputs or any requested project without a fully eligible candidate, selecting and persisting nothing.
    - _Requirements: 4.7-4.11, 5.1-5.14, 6.3-6.6, 10.2-10.4, 11.1-11.2, 11.5-11.6_
  - [ ]* 5.3 Write property test for structured, display-invariant safety
    - **Property 5: Safety is structured, complete, and display-invariant.**
    - Assert every contraindication intersection fails with all matching tags, empty injuries always pass, and arbitrary display-text changes do not affect safety.
    - _Validates: Requirements 4.8-4.11, 11.2_
  - [ ]* 5.4 Add exhaustive 63-combination injury regression coverage
    - Enumerate all non-empty subsets of the six Injury_Selection values and assert every matching canonical record fails safety; add the empty-set pass case for every record.
    - _Requirements: 4.1-4.6, 4.8-4.11, 11.1-11.2_
  - [ ]* 5.5 Write property test for complete, explanatory eligibility assessments
    - **Property 6: Eligibility assessments are exhaustive and explanatory.**
    - Assert one stable-order category assessment per eligibility category and non-empty machine-readable failure reasons/values for each failed category.
    - _Validates: Requirements 5.1, 5.2_
  - [ ]* 5.6 Write property test for the structured eligibility conjunction
    - **Property 7: Core eligibility equals the conjunction of structured rules.**
    - Generate canonical records and normalized profiles to verify project, review status, bodyweight/equipment, experience ranges, and approved-only candidate status.
    - _Validates: Requirements 5.3-5.9, 5.11_
  - [ ]* 5.7 Write property test for all-or-nothing unavailable generation
    - **Property 8: Generation is all-or-nothing with no eligibility override.**
    - Assert one unavailable result retains requested projects/experience, includes failed categories, selects nothing, and is unchanged by warning/tips/steps/generated text or ineligible alternatives.
    - _Validates: Requirements 5.12-5.14, 11.5_
  - [ ]* 5.8 Write property test for ordered qualified alternatives
    - **Property 9: Alternative replacement uses the first qualified stored reference.**
    - Assert the lowest-index fully eligible reference is selected and logged; exhaustion yields unavailable with no original/arbitrary substitute.
    - _Validates: Requirements 6.3-6.6, 11.6_
  - [ ]* 5.9 Write property test for compatibility normalization and output identity
    - **Property 12: Compatibility normalization and output preserve canonical identity.**
    - Verify recognized legacy conversions and every client snapshot field, including category conversion, prescription, canonical identity, and library version.
    - _Validates: Requirements 1.5, 10.1, 10.2, 10.4, 10.6_

- [ ] 6. Cut server routes over to published data and immutable plan snapshots
  - [ ] 6.1 Replace plan generation routes with the canonical pipeline
    - Refactor `server/src/routes/plans.ts` to normalize the stored profile once, load only ExerciseLibraryService data, preflight all requested projects, and invoke the pure generator before schedule assembly.
    - Remove warning-keyword safety matching and `loadExercises`; return the documented 200 availability union without a database write for unavailable requests. On success, apply feedback only to prescription fields and write adapter-shaped, versioned canonical snapshots transactionally.
    - Make individual-week and month generation use the same all-or-nothing preflight so no partial month batch is persisted.
    - _Requirements: 1.2, 4.7-4.11, 5.1-5.14, 6.3-6.6, 10.1-10.5, 11.5-11.6_
  - [ ] 6.2 Add current-content and historical snapshot route contracts
    - Refactor `server/src/routes/projects.ts` to serve approved, adapter-shaped project exercises from the published library and add `server/src/routes/exercises.ts` for `GET /api/exercises/:exerciseId` with current-only 404 behavior.
    - Add `GET /api/plans/:id` and make existing plan read routes deserialize and return stored `weekly_plans.days` unchanged, including deprecated/missing current exercises; return `plan_snapshot_invalid` rather than substituting current content for corrupt history.
    - Register the new router in the server application.
    - _Requirements: 1.3-1.4, 5.4, 10.1, 10.5-10.6_
  - [ ]* 6.3 Write server-route integration tests for generation result contracts
    - Use a temporary SQLite database and published library to verify unknown normalized input, no-candidate, unsafe candidate, and invalid alternative requests return one 200 unavailable envelope with no plan write; verify success snapshots include canonical IDs and versions.
    - _Requirements: 4.7, 5.10-5.14, 6.3-6.6, 10.1-10.4, 11.5-11.6_
  - [ ]* 6.4 Write server-route integration tests for current versus historical content
    - Verify project/exercise routes use published approved records only, while `/current`, `/month`, and `/:id` return stored snapshots after the corresponding record becomes deprecated or absent.
    - _Requirements: 1.2-1.4, 5.4, 10.1, 10.5-10.6_

- [ ] 7. Cut the React application over to typed APIs and unavailable states
  - [ ] 7.1 Add frontend generation/content response types and typed API methods
    - Update `src/lib/types.ts` and `src/lib/api.ts` with discriminated `PlanGenerationResponse`, `StructuredUnavailableResult`, and canonical-backed snapshot contracts; retain field names used by existing views.
    - Add typed calls for generated plans, current project exercise content, standalone current exercises, and persisted plan snapshots.
    - _Requirements: 1.3, 5.12-5.14, 10.1, 10.5-10.6_
  - [ ] 7.2 Update plan-generation screens for explicit unavailable handling
    - Modify `CalendarPage` and `ProjectSelectionPage` to branch on `outcome`, keep the user’s selection/profile context, show `暂不可生成`, and avoid current-plan refetches or automatic fallback actions after an unavailable response.
    - _Requirements: 5.12-5.14, 10.1-10.4_
  - [ ] 7.3 Replace static exercise detail data with current or snapshot API content
    - Refactor `src/pages/ExerciseDetailPage.tsx` to remove the direct exercise JSON import, fetch current content from `/api/exercises/:exerciseId`, and render passed navigation/persisted snapshots directly for historical-plan access.
    - Preserve the existing display contract for steps, tips, warnings, equipment, prescriptions, and timers without using the current library to replace historical data.
    - _Requirements: 1.3-1.4, 10.1, 10.5-10.6_
  - [ ]* 7.4 Write frontend component/API tests for generated, unavailable, current-content, and historical-snapshot states
    - Verify the unavailable UI shows `暂不可生成` without fallback generation, current detail uses API content, and a deprecated historical snapshot remains renderable.
    - _Requirements: 1.3, 5.12-5.14, 10.1, 10.5-10.6_

- [ ] 8. Retire runtime legacy-data reads and wire the complete solution together
  - [ ] 8.1 Remove or isolate all runtime legacy exercise imports
    - Remove the browser-local plan generator/static imports from `src/lib/planGenerator.ts` and current-content views, and remove legacy exercise-file reads from production Express routes.
    - Restrict `data/exercises.json` and `src/data/exercises.json` access to the offline migration CLI and test fixtures only; retain legacy files only as migration inputs until a separately approved cleanup.
    - _Requirements: 1.2-1.4, 8.1, 10.1_
  - [ ]* 8.2 Add a static regression test guarding legacy runtime imports
    - Scan server runtime routes and React current-content modules to fail if they import/read either legacy exercise path, while allowing the migration CLI and explicitly scoped fixtures.
    - _Requirements: 1.2-1.4, 8.1, 10.1_
  - [ ] 8.3 Checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Validate the integrated server and frontend deliverable
  - [ ] 9.1 Run the server single-run test suite and TypeScript build
    - Execute the configured non-watch server tests (including unit, integration, 12 property tests with at least 100 cases, and 63-combination regression) and `npm run build` in `server`; resolve failures without relaxing safety, approval, or no-fallback rules.
    - _Requirements: 1.1-1.5, 2.1-2.10, 3.1-3.5, 4.1-4.11, 5.1-5.14, 6.1-6.6, 7.1-7.7, 8.1-8.8, 9.1-9.5, 10.1-10.6, 11.1-11.6_
  - [ ] 9.2 Run frontend lint and production build
    - Execute `npm run lint` and `npm run build` from the frontend root; resolve typing and build regressions while preserving typed API discrimination and current-versus-historical content behavior.
    - _Requirements: 1.3-1.4, 5.12-5.14, 10.1, 10.5-10.6_
  - [ ] 9.3 Final checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; core implementation tasks are not optional.
- Test work is attached to the implementation that it verifies. The design defines correctness properties, so each of Properties 1–12 has its own property-test sub-task using pinned `fast-check@3.23.2`.
- `vitest@2.1.9` and `fast-check@3.23.2` must be installed as exact versions in the server development toolchain; test commands must run once rather than in watch mode.
- Publication and review are completely automatic: valid records become `approved`, invalid records are `needs_review`, unevaluated records are `draft`, and retained historical records may be `deprecated`; no human approval task is permitted.
- Safety and eligibility use structured fields only. Warning/tips/steps/LLM text cannot override a failed category, and any request with an unavailable project must return exactly one all-or-nothing `temporarily_unavailable` response with no fallback or persistence.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.1"] },
    { "id": 4, "tasks": ["3.5", "4.2", "4.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.9"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "6.1"] },
    { "id": 7, "tasks": ["6.2", "7.1"] },
    { "id": 8, "tasks": ["6.3", "6.4", "7.2", "7.3"] },
    { "id": 9, "tasks": ["7.4", "8.1"] },
    { "id": 10, "tasks": ["8.2"] },
    { "id": 11, "tasks": ["9.1", "9.2"] }
  ]
}
```
