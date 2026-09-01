Development & Refactoring Principles
Core Rule

DO NOT DUPLICATE CODE.

Before creating new code, components, controls, styles, validation, business logic, API calls, state handling, or UI patterns, investigate the existing codebase first.

The existing codebase is the source of truth.

If equivalent or substantially similar functionality already exists, reuse, extract, compose, or extend it instead of creating another implementation.

Follow the DRY (Don't Repeat Yourself) principle throughout the codebase.

1. Mandatory Codebase Discovery Before Coding

Before modifying or adding functionality:

Search the entire relevant codebase.
Identify existing:
Components
UI controls
Forms
Inputs
Buttons
Icons
Modals
Cards
Layouts
Hooks
Utilities
Validation logic
API clients
Services
Types/interfaces
State management
Business rules
Constants
Styling patterns
CSS/Tailwind classes
Error handling
Loading states
Authentication/authorization logic
Feature flags
Test/dev-mode behavior
Search for similar functionality by:
Component name
Function name
Variable name
API endpoint
UI text
CSS/class patterns
Business terminology
Similar user flows
Determine whether an existing implementation can be reused or generalized.
Only create new code when an existing implementation genuinely cannot satisfy the requirement.

Never assume something does not exist without searching first.

2. DRY — Don't Repeat Yourself

Avoid duplicate or near-duplicate implementations.

This includes more than exact copy/paste duplication.

The following are also considered duplication:

Two components doing essentially the same thing
Two forms with almost identical structure
Two verification cards implemented independently
Two copies of the same validation logic
Two API functions performing the same operation
Repeated state-management logic
Repeated conditional rendering
Repeated Tailwind/CSS class combinations
Repeated error/loading/success handling
Repeated business rules
Repeated formatting/masking logic
Repeated constants
Repeated types/interfaces
Repeated hooks
Repeated event handlers
Slightly modified copies of existing components
"Temporary" duplicate implementations that become permanent

Similar code is duplication even when variable names or small details differ.

3. Reuse Before Abstraction, Abstract Before Duplication

Use this decision order:

1. Can I reuse an existing component/function/hook/utility?
        ↓
2. Can I configure the existing implementation?
        ↓
3. Can I compose existing components?
        ↓
4. Can I extract the shared behavior into a reusable abstraction?
        ↓
5. Only then create genuinely new functionality.


Do not immediately create a new component because it is "similar".

First determine whether the existing component can support the new use case through:

Props
Configuration
Composition
Variants
Slots
Callbacks
Generic types
Shared hooks
Shared utilities
4. Component Reuse

If multiple screens contain the same or substantially similar UI, prefer a shared component.

For example, do NOT independently implement:

EmailVerificationCard
PhoneVerificationCard


if the only meaningful difference is:

type = email | phone


Prefer a reusable abstraction where appropriate:

VerificationCard
    ├── type
    ├── value
    ├── verified
    ├── onVerify
    ├── onEdit
    └── verification controls


However, do not over-abstract.

Only create an abstraction when there is meaningful shared behavior or structure.

The goal is:

One source of truth for shared behavior, without creating unnecessary abstraction complexity.

5. Reuse Existing Controls

Do not create a new button, input, dropdown, modal, card, tooltip, date picker, OTP control, etc. if an equivalent existing control already exists.

Before creating a UI control:

Search existing components.
Search shared UI directories.
Search feature components.
Search imports/usages.
Check whether an existing component already solves the problem.


If an existing component is close but missing a capability, prefer extending it safely rather than creating a parallel component.

6. Reuse Existing Styles

Do not unnecessarily recreate styling.

Avoid repeatedly writing slightly different versions of:

padding
margin
border
border-radius
colors
font sizes
hover states
focus states
disabled states
loading states
error states
success states


Look for existing design-system conventions and shared classes/components.

Maintain visual consistency.

Do not introduce a new styling pattern when an existing pattern already exists.

7. Reuse Business Logic

Business rules must have a clear source of truth.

Do not duplicate rules such as:

verification requirements
permissions
eligibility
validation
pricing
status calculations
authentication rules
checkout rules
account rules
feature availability


If the same business rule is needed in multiple places, extract or reuse the existing source of truth.

A business rule should not silently diverge between two screens.

8. Separate UI From Business Logic

Keep responsibilities separated.

Prefer:

UI
↓
Hook / Controller
↓
Service / API
↓
Business/domain logic


Avoid putting large amounts of business logic directly inside JSX/rendering code.

Avoid duplicating API calls, validation, state transitions, or business rules inside multiple components.

9. Single Responsibility Principle

Components, functions, hooks, and services should have clear responsibilities.

Avoid creating components that simultaneously handle:

UI rendering
API communication
business rules
data transformation
validation
state management
formatting
navigation


When responsibilities become too large, identify appropriate reusable abstractions.

Do not blindly split everything into tiny files.

Use sensible boundaries.

10. Refactoring Must Preserve Behavior

Refactoring means improving internal implementation without unintentionally changing external behavior.

During refactoring:

MUST NOT change
Business rules
User permissions
Authentication behavior
Authorization behavior
API contracts
Database behavior
Validation rules
Verification requirements
Error handling semantics
User workflows
Navigation behavior
Existing feature behavior
Test/dev-mode behavior
Feature flags
Existing integrations
Existing edge-case behavior

unless the task explicitly requires a behavior change.

The application should behave exactly as designed before and after the refactor.

The goal is:

Same behavior
+
Less duplication
+
Better reuse
+
Better maintainability
+
Better consistency

11. No Regression Principle

Every refactor must be treated as a behavior-preserving change.

Before changing code, understand:

What the current code does
Why it does it
Which states it supports
Which users depend on it
Which API calls it makes
Which edge cases exist
Which tests cover it
Which other components depend on it

Do not remove code simply because it appears unused without investigating its purpose.

Do not "clean up" unrelated behavior during a refactor.

Keep the change focused.

12. Preserve Test/Development Behavior

Special test and development behavior must remain functional.

For example:

testEmail


or any similar test/dev-mode mechanism must continue working exactly as before unless the task explicitly says otherwise.

Before modifying code related to test/dev behavior:

Find where it is defined.
Find where it is consumed.
Understand why it exists.
Identify tests covering it.
Preserve its behavior during refactoring.

Never remove test/dev functionality simply because it looks unusual.

13. Comprehensive Duplication Audit

When asked to refactor or improve existing code, do not only fix the file currently being discussed.

Perform a broader investigation.

Search the codebase for:

Duplicate components
Near-duplicate components
Duplicate functions
Duplicate hooks
Duplicate API calls
Duplicate validation
Duplicate business rules
Duplicate UI patterns
Duplicate forms
Duplicate controls
Duplicate state logic
Duplicate error handling
Duplicate loading states
Duplicate formatting
Duplicate Tailwind/CSS patterns
Duplicate constants
Duplicate types
Copy/pasted JSX
Similar code with slightly different variable names
Multiple implementations of the same workflow

Identify both:

Exact duplication


and:

Semantic duplication


Semantic duplication means two pieces of code are different syntactically but solve essentially the same problem.

14. Do Not Perform Blind Mechanical Refactoring

Do not simply extract code because two sections look similar.

First understand whether they actually share:

Behavior
Business rules
Lifecycle
State model
Error handling
API behavior
User interaction
Security requirements

If they do, create an appropriate shared abstraction.

If they do not, keep them separate.

DRY does not mean forcing unrelated things into one abstraction.

Avoid:

Over-abstraction
God components
God hooks
Huge generic components
Complex prop APIs
Premature abstraction


The objective is appropriate reuse, not maximum reuse at any cost.

15. Before Implementing a New Component

Ask:

Does this component already exist?

Is there a similar component?

Is there a shared component that can be extended?

Is there a reusable primitive for this?

Is the same UI pattern already implemented elsewhere?

Can this be represented as a variant of an existing component?

Would creating this introduce another source of truth?


If the answer indicates existing functionality, reuse it.

16. Before Implementing a New Function

Ask:

Does this logic already exist?

Is there an existing utility?

Is there an existing hook?

Is there an existing service?

Is the same API operation already implemented?

Is the same validation already implemented?

Is the same transformation already implemented?


Do not create another implementation simply because finding the existing one takes effort.

17. Before Copying Code

STOP.

Do not copy/paste an existing implementation and modify it.

Instead:

Find the original.
Understand why it exists.
Determine what is common.
Determine what varies.
Extract shared behavior.
Parameterize the differences.
Reuse the resulting abstraction.
18. Refactoring Workflow

For significant refactoring tasks, follow this process.

Phase 1 — Discovery

Do not modify code yet.

Investigate:

Relevant files
Related components
Existing abstractions
Existing patterns
Dependencies
Call sites
Tests
API contracts
Business rules
Dev/test behavior
Duplicate implementations

Produce a concise discovery report.

Phase 2 — Duplication Analysis

Classify findings:

HIGH
    Exact duplicate or dangerous duplicated business logic.

MEDIUM
    Significant repeated UI/behavior that should probably be shared.

LOW
    Minor repetition that does not justify abstraction yet.


For every significant finding, identify:

Location
Current implementation
Duplicate/similar implementation
Why it is duplicated
Risk
Recommended abstraction

Phase 3 — Refactoring Plan

Before modifying code, create a plan.

The plan should describe:

What will be changed.
What will be extracted.
What will be reused.
Which components/functions will become shared.
Which code will be removed.
How behavior will remain unchanged.
What tests will be added or updated.
How regression will be verified.

Do not start a large refactor without a plan.

19. Safe Incremental Refactoring

Prefer small, verifiable changes.

Example:

Step 1
Create shared abstraction.

Step 2
Migrate implementation A.

Step 3
Run tests.

Step 4
Migrate implementation B.

Step 5
Run tests.

Step 6
Remove obsolete duplicate code.

Step 7
Run full test/build/type-check.

Step 8
Review diff for unintended behavior changes.


Avoid massive rewrites when incremental refactoring is possible.

20. Testing Requirements

After refactoring, verify:

TypeScript/type checking
Unit tests
Integration tests
Relevant feature tests
Build
Lint
Existing test/dev behavior


Where appropriate, test:

Happy paths
Error paths
Loading states
Empty states
Disabled states
Permission states
Verified/unverified states
Edge cases
Existing test/dev modes

Do not consider a refactor complete merely because the application builds.

21. Regression Review

Before declaring the work complete, explicitly review the diff and ask:

Did any business rule change?

Did any API behavior change?

Did any validation change?

Did any user workflow change?

Did any permissions change?

Did any error handling change?

Did any loading behavior change?

Did any edge case change?

Did any test/dev behavior change?

Did any existing component lose functionality?

Did any existing caller receive different behavior?

Did any UI state disappear?

Did any accessibility behavior change?

Did the refactor introduce another duplicate?


If any answer is unclear, investigate before completing the task.

22. Final Refactoring Quality Gate

A refactor is complete only when:

 Existing functionality still works.
 Business rules are unchanged.
 No intentional behavior was accidentally changed.
 Existing test/dev functionality still works.
 Existing tests pass.
 New/updated tests cover important refactored behavior.
 Type checking passes.
 Build passes.
 No unnecessary duplicate code remains.
 Shared functionality has one appropriate source of truth.
 Existing components were reused where appropriate.
 Existing controls were reused where appropriate.
 Existing styles/patterns were reused where appropriate.
 No unnecessary abstraction was introduced.
 No unrelated functionality was modified.
 The final diff has been manually reviewed.
23. Required Mindset

When working in this repository, think:

"Search first. Understand second. Reuse third. Abstract fourth. Create new code last."

Do not optimize for:

Fastest implementation
Fewest files changed
Copy/paste convenience
Making the current screen work in isolation


Optimize for:

Maintainability
Reusability
Consistency
Single source of truth
DRY
Separation of concerns
Clear architecture
Behavior preservation
Regression safety
Long-term code quality

24. Important Instruction to AI Coding Agents

DO NOT blindly implement the user's requested UI/code change directly in the nearest file.

First determine whether the requested functionality already exists elsewhere.

If similar code exists, investigate it.

If the repository already has a component, hook, utility, control, service, or pattern for the requested behavior, reuse it.

If multiple implementations exist already, identify the duplication and consider consolidating them into an appropriate shared abstraction.

Before a substantial refactor, provide a discovery and refactoring plan.

Do not change business behavior merely to make the code "cleaner".

Do not remove functionality because it appears redundant until its callers and purpose have been investigated.

Do not duplicate code simply because the existing implementation is located in another file.

Do not create a second source of truth.

The objective is not merely to make the requested change work.

The objective is to make the requested change work while improving the architecture, reducing duplication, preserving existing behavior, and preventing future divergence.

25. When You Discover Existing Duplication

If you discover duplicated or near-duplicated code while working on a task:

Stop and investigate the scope.
Identify all affected locations.
Determine whether the duplication is accidental or intentional.
Determine the safest shared abstraction.
Check all callers.
Check existing tests.
Create a refactoring plan.
Refactor incrementally.
Run tests after each meaningful step.
Verify that behavior remains unchanged.

Do not silently leave obvious duplication behind when it is directly related to the task.

26. Definition of Done

The implementation is NOT DONE simply because:

The requested screen looks correct.


It is done when:

The requested behavior works
AND
existing behavior is preserved
AND
existing abstractions were reused
AND
unnecessary duplication was avoided
AND
related duplication was investigated
AND
business rules remain unchanged
AND
test/dev behavior remains functional
AND
tests pass
AND
type checking passes
AND
build passes
AND
the final implementation is maintainable.


Always favor one reusable, well-designed implementation over multiple similar implementations.
Always update AGENTS.md and README.md files as and when required.