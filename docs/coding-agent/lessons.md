# Lessons Log (Coding Agent)

## 2026-10-29: Validate dependency behavior at integration boundaries

- Symptom: A niconicomments update passed type checks and build, but review found that lazy timeline construction could suppress all rendered comments.
- Root cause: Validation checked type compatibility without exercising the renderer's dependency on the library's timeline behavior.
- Fix: Construct the timeline before checking it and add a regression check against the updated library.
- Prevention: For rendering dependency updates, inspect changed runtime semantics at integration boundaries and test a representative rendered frame, including lazy and empty states where applicable.
- Scope/tags: dependency updates, rendering, validation, review.
- Promotion: Retain as a repository lesson; no existing rule suite is present.
