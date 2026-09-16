# Requirements Document

## Introduction

Flourish AI currently maintains exercise content in `data/exercises.json` and `src/data/exercises.json`. This feature establishes one Canonical_Exercise_Library for all newly generated plans and current exercise-content responses while preserving historical plan snapshots. The library uses validated structured data for eligibility and safety. Display text and LLM-generated text remain informational and cannot determine whether an exercise is safe or eligible.

The training-experience values remain `zero`, `occasional`, and `regular`; their difficulty ranges remain 1–2, 2–3, and 3–4. A record that completely passes deterministic validation becomes `approved` automatically. This feature has no human reviewer and no manual approval step. If any requested project has no safe, eligible candidate, the complete generation request returns `temporarily_unavailable` with display message `暂不可生成`; the application does not relax constraints or use a fallback.

## Glossary

- **Application**: Flourish AI services that provide plan generation and exercise content to supported consumers.
- **Canonical_Exercise_Library**: The sole authoritative collection of Canonical_Exercise records and its controlled-vocabulary registry.
- **Canonical_Exercise**: One normalized exercise record identified by a unique `exercise_id`.
- **Published_Library**: The most recent Canonical_Exercise_Library that passed every publication gate.
- **Candidate_Library**: A Canonical_Exercise_Library evaluated for publication before replacing the Published_Library.
- **Legacy_Exercise_Source**: Either `data/exercises.json` or `src/data/exercises.json` before unification.
- **Exercise_Schema**: The required field names, JSON types, value domains, cardinalities, uniqueness rules, and cross-record rules for a Canonical_Exercise.
- **Controlled_Vocabulary_Registry**: The versioned, machine-readable registry in the Canonical_Exercise_Library that enumerates allowed Equipment_ID and Muscle_Group values.
- **Injury_Tag**: One of `shoulder_impingement`, `rotator_cuff`, `neck_pain`, `elbow_pain`, `wrist_pain`, `lower_back`, `sciatica`, `knee_pain`, or `meniscus`.
- **Injury_Selection**: One of `shoulder`, `neck`, `elbow`, `wrist`, `back`, or `knee`.
- **Equipment_ID**: One value enumerated by the active Controlled_Vocabulary_Registry, including `bodyweight`.
- **Project_ID**: One of `tricep_tone`, `hip_thigh_tone`, `lower_abs_tone`, `trap_relax`, `round_shoulder_fix`, or `full_body_basic`.
- **Muscle_Group**: One value enumerated by the active Controlled_Vocabulary_Registry.
- **Exercise_Category**: One of `strength`, `warmup`, `stretch`, or `cardio`.
- **Review_Status**: One of `draft`, `needs_review`, `approved`, or `deprecated`.
- **Safety_Filter**: The deterministic mapping and comparison rules that determine contraindication eligibility.
- **Eligibility_Category**: One of `project`, `review_status`, `safety`, `equipment`, `experience`, or `alternative`.
- **Eligibility_Assessment**: The machine-readable per-exercise result containing an eligibility outcome for every Eligibility_Category and a failure reason for every failed category.
- **Eligibility_Candidate**: A Canonical_Exercise whose Eligibility_Assessment passes every applicable Eligibility_Category.
- **Alternative_Exercise**: A Canonical_Exercise referenced by an `alternative_exercise_ids` value.
- **Structured_Unavailable_Result**: A machine-readable result with outcome `temporarily_unavailable`, display message `暂不可生成`, requested Project_ID values, failed Eligibility_Category values by Project_ID, and any unknown input values.
- **Library_Validator**: The deterministic process that validates Exercise_Schema, controlled vocabularies, references, safety data, and publication gates.
- **Library_Migration**: The repeatable conversion of all Legacy_Exercise_Source records and legacy references into Canonical_Exercise records and compatibility mappings.
- **Migration_Report**: A machine-readable report containing a record-level outcome for every Legacy_Exercise_Source record, field-level conflicts, validation failures, selected canonical values, and unresolved records.
- **Compatibility_Adapter**: The application contract that derives supported client and persistence fields from Canonical_Exercise data during transition.
- **Plan_Generator**: The application service that selects exercises and returns training-plan data.

## Requirements

### Requirement 1: Use One Published Exercise Library

**User Story:** As a product team member, I want newly generated content to use one published library, so that data cannot diverge between plan, safety, and content workflows.

#### Acceptance Criteria

1. THE Canonical_Exercise_Library SHALL contain each active exercise as exactly one Canonical_Exercise with one unique `exercise_id`.
2. WHEN the Plan_Generator creates a plan, THE Plan_Generator SHALL read Canonical_Exercise records only from the Published_Library.
3. WHEN an application API returns current exercise content, THE Compatibility_Adapter SHALL derive the content only from the Published_Library.
4. WHEN a newly generated plan or current-content request would read a Legacy_Exercise_Source, THEN THE Application SHALL redirect the request to the Published_Library or return a request error without returning Legacy_Exercise_Source data.
5. WHEN a Candidate_Library passes every publication gate, THE Canonical_Exercise_Library SHALL expose the same published Canonical_Exercise record to every supported consumer.

### Requirement 2: Define Complete, Typed Exercise Records

**User Story:** As a content operator, I want complete structured metadata for every exercise, so that plan and safety logic can use validated data rather than interpret prose.

#### Acceptance Criteria

1. THE Exercise_Schema SHALL require the fields `exercise_id`, `name`, `name_en`, `muscle_group.primary`, `muscle_group.secondary`, `difficulty`, `equipment`, `function.primary`, `function.secondary`, `category`, `target_projects`, `contraindications`, `alternative_exercise_ids`, `review_status`, `rest_seconds`, `steps`, `tips`, and `warning` for every Canonical_Exercise.
2. THE Exercise_Schema SHALL require `exercise_id`, `name`, `name_en`, `function.primary`, `function.secondary`, and `warning` to be non-empty JSON strings.
3. THE Exercise_Schema SHALL require `muscle_group.primary`, `muscle_group.secondary`, `equipment`, `target_projects`, `contraindications`, `alternative_exercise_ids`, `steps`, and `tips` to be JSON arrays.
4. THE Exercise_Schema SHALL require `muscle_group.primary`, `equipment`, and `target_projects` to contain at least one unique value.
5. THE Exercise_Schema SHALL require `muscle_group.secondary`, `contraindications`, `alternative_exercise_ids`, and `tips` to contain zero or more unique values.
6. THE Exercise_Schema SHALL require every `steps` array to contain at least one non-empty JSON string in its stored order.
7. THE Exercise_Schema SHALL require `difficulty` to be an integer from 1 through 5 and `rest_seconds` to be an integer from 0 through 600.
8. THE Exercise_Schema SHALL require `category` to contain one Exercise_Category value and `review_status` to contain one Review_Status value.
9. WHEN a Canonical_Exercise has no known contraindication, THE Canonical_Exercise_Library SHALL store an empty `contraindications` array for the Canonical_Exercise.
10. WHEN two Canonical_Exercise records have the same `exercise_id`, THEN THE Library_Validator SHALL report both records as invalid duplicate identifiers.

### Requirement 3: Maintain Exact Controlled Vocabularies

**User Story:** As a developer, I want closed, machine-readable vocabularies, so that structured exercise records can be consistently validated and filtered.

#### Acceptance Criteria

1. THE Canonical_Exercise_Library SHALL maintain a versioned Controlled_Vocabulary_Registry that contains exact JSON arrays of allowed Equipment_ID values and allowed Muscle_Group values.
2. THE Canonical_Exercise_Library SHALL maintain the Injury_Tag, Injury_Selection, Project_ID, Exercise_Category, and Review_Status value sets defined in this document as closed vocabularies.
3. THE Controlled_Vocabulary_Registry SHALL include `bodyweight` in its allowed Equipment_ID array.
4. WHEN a Canonical_Exercise references a value outside a closed vocabulary or the active Controlled_Vocabulary_Registry, THEN THE Library_Validator SHALL report the Canonical_Exercise as invalid with the field name and unsupported value.
5. WHEN a Candidate_Library changes an allowed Equipment_ID or Muscle_Group array, THE Library_Validator SHALL publish the registry version and complete allowed-value arrays in the machine-readable validation result.

### Requirement 4: Apply Contraindication Rules Deterministically

**User Story:** As a user with injury considerations, I want unsafe exercises excluded by explicit rules, so that safety decisions do not depend on warning text or generated advice.

#### Acceptance Criteria

1. WHEN an Injury_Selection is `shoulder`, THE Safety_Filter SHALL expand the Injury_Selection to `shoulder_impingement` and `rotator_cuff`.
2. WHEN an Injury_Selection is `neck`, THE Safety_Filter SHALL expand the Injury_Selection to `neck_pain`.
3. WHEN an Injury_Selection is `elbow`, THE Safety_Filter SHALL expand the Injury_Selection to `elbow_pain`.
4. WHEN an Injury_Selection is `wrist`, THE Safety_Filter SHALL expand the Injury_Selection to `wrist_pain`.
5. WHEN an Injury_Selection is `back`, THE Safety_Filter SHALL expand the Injury_Selection to `lower_back` and `sciatica`.
6. WHEN an Injury_Selection is `knee`, THE Safety_Filter SHALL expand the Injury_Selection to `knee_pain` and `meniscus`.
7. IF a profile contains an Injury_Selection outside the Injury_Selection vocabulary, THEN THE Plan_Generator SHALL return a Structured_Unavailable_Result that identifies the unknown injury value.
8. WHEN a Canonical_Exercise contains an Injury_Tag in the union of expanded profile injury values, THE Safety_Filter SHALL mark the `safety` Eligibility_Category as failed and record every matching Injury_Tag.
9. WHEN a profile contains no Injury_Selection values, THE Safety_Filter SHALL mark the `safety` Eligibility_Category as passed for every Canonical_Exercise regardless of the Canonical_Exercise `contraindications` array.
10. WHEN the Safety_Filter evaluates a Canonical_Exercise, THE Safety_Filter SHALL determine the `safety` Eligibility_Category solely from structured `contraindications` values and the deterministic Injury_Selection mapping.
11. THE Safety_Filter SHALL classify `warning`, `tips`, `steps`, and LLM-generated text as display content that does not alter the `safety` Eligibility_Category.

### Requirement 5: Select and Explain Structured Eligibility

**User Story:** As a user, I want generated plans to contain appropriate and explainable exercises, so that recommendations respect equipment, experience, review state, targets, and safety.

#### Acceptance Criteria

1. WHEN the Plan_Generator evaluates a Canonical_Exercise for a requested Project_ID, THE Plan_Generator SHALL create one Eligibility_Assessment containing a passed, failed, or not-applicable outcome for every Eligibility_Category.
2. WHEN an Eligibility_Category is failed, THE Plan_Generator SHALL record a machine-readable failure reason code and the input or record value that caused the failure.
3. WHEN the Plan_Generator evaluates the `project` Eligibility_Category, THE Plan_Generator SHALL pass the category only when the requested Project_ID occurs in the Canonical_Exercise `target_projects` array.
4. WHEN the Plan_Generator evaluates the `review_status` Eligibility_Category, THE Plan_Generator SHALL pass the category only when the Canonical_Exercise Review_Status is `approved`.
5. THE Plan_Generator SHALL treat Equipment_ID `bodyweight` as available to every user.
6. WHEN no Equipment_ID in a Canonical_Exercise equals `bodyweight` or an Equipment_ID in the user equipment profile, THE Plan_Generator SHALL fail the `equipment` Eligibility_Category.
7. WHEN the Plan_Generator evaluates experience `zero`, THE Plan_Generator SHALL pass the `experience` Eligibility_Category only for difficulty values 1 through 2.
8. WHEN the Plan_Generator evaluates experience `occasional`, THE Plan_Generator SHALL pass the `experience` Eligibility_Category only for difficulty values 2 through 3.
9. WHEN the Plan_Generator evaluates experience `regular`, THE Plan_Generator SHALL pass the `experience` Eligibility_Category only for difficulty values 3 through 4.
10. IF a profile contains a training-experience value outside `zero`, `occasional`, or `regular`, THEN THE Plan_Generator SHALL return a Structured_Unavailable_Result that identifies the unsupported experience value.
11. WHILE a Canonical_Exercise Review_Status is `draft`, `needs_review`, or `deprecated`, THE Plan_Generator SHALL exclude the Canonical_Exercise from newly generated plans.
12. WHEN any requested Project_ID has no Eligibility_Candidate after every applicable Eligibility_Category and alternative rule is evaluated, THEN THE Plan_Generator SHALL return one Structured_Unavailable_Result for the complete generation request with the requested Project_ID values and failed Eligibility_Category values by Project_ID.
13. WHEN the Plan_Generator returns a Structured_Unavailable_Result, THE Plan_Generator SHALL select no exercise for the generation request and SHALL preserve the requested Project_ID values and experience constraint.
14. WHEN the Plan_Generator returns a Structured_Unavailable_Result, THE Plan_Generator SHALL not use unsafe content, non-approved content, warning text, LLM-generated text, or an alternative that fails an applicable Eligibility_Category as an eligibility override.

### Requirement 6: Select Alternatives in Stable Order

**User Story:** As a user whose preferred exercise is ineligible, I want qualified alternatives selected predictably, so that adaptation does not weaken safety constraints.

#### Acceptance Criteria

1. WHEN a Canonical_Exercise contains an `alternative_exercise_ids` value, THE Exercise_Schema SHALL require the value to reference one existing Canonical_Exercise with a different `exercise_id`.
2. WHEN a Canonical_Exercise contains an `alternative_exercise_ids` value, THE Exercise_Schema SHALL require every referenced identifier to occur once in the array.
3. WHEN the Plan_Generator replaces an ineligible Canonical_Exercise, THE Plan_Generator SHALL consider referenced Alternative_Exercise records in stored `alternative_exercise_ids` order.
4. WHEN one or more referenced Alternative_Exercise records are Eligibility_Candidate records, THE Plan_Generator SHALL select the first referenced Eligibility_Candidate record in stored `alternative_exercise_ids` order.
5. WHEN a Canonical_Exercise has no referenced Alternative_Exercise that is an Eligibility_Candidate, THEN THE Plan_Generator SHALL return a Structured_Unavailable_Result instead of selecting the Canonical_Exercise or an unqualified substitute.
6. WHEN the Plan_Generator selects an Alternative_Exercise, THE Plan_Generator SHALL record the replaced `exercise_id`, selected alternative `exercise_id`, stored alternative index, and selection reason in the Eligibility_Assessment or decision log.

### Requirement 7: Automate Review Status and Publication

**User Story:** As a content operator, I want deterministic review states and publication gates, so that unvalidated or retired content cannot enter newly generated plans.

#### Acceptance Criteria

1. THE Canonical_Exercise_Library SHALL store exactly one Review_Status for every Canonical_Exercise.
2. WHEN a Canonical_Exercise is created, imported, or edited and passes every Library_Validator rule, THE Canonical_Exercise_Library SHALL assign Review_Status `approved` automatically.
3. IF a Canonical_Exercise fails a required-field, type, cardinality, vocabulary, reference, or safety-data validation rule, THEN THE Canonical_Exercise_Library SHALL assign or retain Review_Status `needs_review` and exclude the Canonical_Exercise from newly generated plans.
4. WHEN a Canonical_Exercise has not completed Library_Validator evaluation, THE Canonical_Exercise_Library SHALL assign Review_Status `draft` and exclude the Canonical_Exercise from newly generated plans.
5. WHEN a Canonical_Exercise is superseded or retired, THE Canonical_Exercise_Library SHALL assign Review_Status `deprecated` and retain the Canonical_Exercise for historical-plan readability.
6. WHEN a Candidate_Library has any validation failure or blocking Migration_Report outcome, THEN THE Canonical_Exercise_Library SHALL retain the existing Published_Library for supported consumers.
7. WHEN a Candidate_Library has no validation failure and no blocking Migration_Report outcome, THE Canonical_Exercise_Library SHALL make the Candidate_Library the Published_Library automatically without a human reviewer or manual approval decision.

### Requirement 8: Migrate Both Sources With Complete Reconciliation

**User Story:** As a maintainer, I want both JSON sources migrated predictably, so that unification retains content and exposes unresolved data rather than silently losing it.

#### Acceptance Criteria

1. WHEN Library_Migration runs, THE Library_Migration SHALL process every record from `data/exercises.json` and `src/data/exercises.json`.
2. WHEN Library_Migration processes a Legacy_Exercise_Source record, THE Migration_Report SHALL contain one record-level entry with source path, legacy record identifier, conversion outcome, and canonical `exercise_id` or unresolved marker.
3. WHEN a Legacy_Exercise_Source uses legacy equipment, difficulty, category, muscle, project, injury, or text field representations, THE Library_Migration SHALL map each representation to an Exercise_Schema value or record the source value as unresolved.
4. WHEN Legacy_Exercise_Source records represent the same exercise, THE Library_Migration SHALL create one Canonical_Exercise only after the Migration_Report records every source record, each selected canonical value, and every field-level conflict.
5. WHEN a Legacy_Exercise_Source record cannot satisfy a required Exercise_Schema field or controlled vocabulary, THEN THE Migration_Report SHALL contain the legacy record identifier, failed field, source value, and `needs_review` outcome.
6. WHEN a migrated Canonical_Exercise passes every Library_Validator rule and has no unresolved migration outcome, THE Canonical_Exercise_Library SHALL assign Review_Status `approved` automatically.
7. WHEN Library_Migration completes, THE Migration_Report SHALL report each source-record count and an equal count of record-level outcomes classified as migrated, merged, or unresolved.
8. IF the Migration_Report contains an unresolved record, a conflict without a selected canonical value, or an invalid Canonical_Exercise, THEN THE Canonical_Exercise_Library SHALL prevent the Candidate_Library from replacing the Published_Library.

### Requirement 9: Produce Machine-Readable Validation Evidence

**User Story:** As a developer, I want deterministic integrity evidence, so that invalid records and broken references cannot reach plan generation.

#### Acceptance Criteria

1. WHEN the Canonical_Exercise_Library is created, imported, edited, or evaluated for publication, THE Library_Validator SHALL validate every Canonical_Exercise against the Exercise_Schema and Controlled_Vocabulary_Registry.
2. WHEN the Library_Validator evaluates `alternative_exercise_ids`, THE Library_Validator SHALL report missing references, self-references, duplicate references, and references to Canonical_Exercise records without Review_Status `approved`.
3. WHEN the Library_Validator detects a validation failure, THE Library_Validator SHALL produce a machine-readable validation result containing the Canonical_Exercise identifier, validation rule, field, invalid value, validation outcome, and registry version.
4. WHEN the Library_Validator completes a Candidate_Library evaluation, THE Library_Validator SHALL produce a machine-readable summary containing the candidate identifier, each validation result, publication-gate outcome, and blocking Migration_Report entries.
5. WHEN a release candidate is prepared, THE Canonical_Exercise_Library SHALL provide the latest machine-readable validation result and Migration_Report.

### Requirement 10: Preserve Transition and Historical Contracts

**User Story:** As an existing Flourish AI user, I want current screens and historical plans to remain usable while exercise data is unified, so that migration does not disrupt training.

#### Acceptance Criteria

1. WHEN an existing Express plan-generation route returns a newly generated plan, THE Compatibility_Adapter SHALL provide the exercise identifier, name, category, steps, tips, warning, sets, repetitions or duration, and rest interval required by the current React training experience.
2. WHEN an existing profile contains a legacy Injury_Selection representation, THE Compatibility_Adapter SHALL convert the representation to one controlled Injury_Selection value before the Safety_Filter evaluates eligibility.
3. WHEN an existing profile contains a legacy injury representation that cannot map to an Injury_Selection, THEN THE Compatibility_Adapter SHALL return a Structured_Unavailable_Result that identifies the unmatched representation and prevent plan generation.
4. WHEN an existing profile contains a legacy equipment representation, THE Compatibility_Adapter SHALL convert the representation to supported Equipment_ID values or return a compatibility result that identifies each unmatched representation.
5. WHEN an existing persisted weekly plan is retrieved, THE Compatibility_Adapter SHALL return the stored exercise snapshot without requiring the historical exercise to remain Review_Status `approved`.
6. WHEN a migrated Canonical_Exercise replaces a legacy exercise record used by a supported client, THE Compatibility_Adapter SHALL provide the same semantic exercise identity or a documented canonical replacement identity.

### Requirement 11: Run Deterministic Safety and Availability Regressions

**User Story:** As a product and QA team member, I want verifiable safety and migration regressions, so that releases can be assessed against the product safety baseline.

#### Acceptance Criteria

1. WHEN deterministic safety regression checks run for the 63 non-empty combinations of the six Injury_Selection values, THE Library_Validator SHALL verify that every Canonical_Exercise matching any expanded Injury_Tag fails the `safety` Eligibility_Category.
2. WHEN deterministic safety regression checks run with an empty Injury_Selection set, THE Library_Validator SHALL verify that every Canonical_Exercise passes the `safety` Eligibility_Category regardless of `contraindications` values.
3. WHEN Library_Migration runs against both Legacy_Exercise_Source files, THE Library_Validator SHALL verify that the Migration_Report outcome count for each source path equals the source-record count for that path.
4. WHEN a Canonical_Exercise has Review_Status `approved`, THE Library_Validator SHALL verify that the Canonical_Exercise has no unresolved required-field, type, cardinality, vocabulary, reference, or safety-data validation result.
5. WHEN a plan-generation regression check leaves any requested Project_ID without an Eligibility_Candidate after all eligibility and alternative rules are evaluated, THE Library_Validator SHALL verify that the Plan_Generator returns one Structured_Unavailable_Result for the complete request and selects no fallback exercise.
6. WHEN a plan-generation regression check evaluates an ineligible exercise with multiple eligible referenced alternatives, THE Library_Validator SHALL verify that the Plan_Generator selects the first eligible alternative in stored `alternative_exercise_ids` order.
