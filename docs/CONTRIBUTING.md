# Contributing Guidelines

Thank you for your interest in contributing to NETRA! We welcome contributions from developers worldwide.

---

## Development Workflow

1. **Fork & Clone:** Fork the repository on GitHub and clone your fork locally.

2. **Environment Setup:** Ensure you have Java 25 LTS, Gradle 9, Docker, Node.js 20+ & npm, and Python 3.9+ installed.

3. **Branching Model:** Create a descriptive branch from `main`:

   ```bash
   git checkout -b feat/intelligent-failover     # Feature
   git checkout -b fix/cache-boundary-leak      # Fix / Bug / Chore
   ```

4. **Code Standards:**
   - Adhere to modern Java 25 practices (Records, Pattern Matching, Virtual Threads).
   - Maintain strict `BigDecimal` financial arithmetic.
   - Run unit and integration tests before committing:

     ```bash
     make test
     ```

5. **Evaluation Verification:** Ensure all benchmark and verification suites pass:

   ```bash
   # Core Verification Suite (v1)
   make smoke
   make routing-eval
   make cache-eval
   make load

   # Hardening Verification Suite (v2)
   make chaos
   make cache-fuzz
   make stress

   # Or execute all verification gates at once:
   make verify-all
   ```

6. **Commit Message Conventions:**
   NETRA adheres to the **Conventional Commits** specification (`v1.0.0`) to drive automated semantic releases via Google's Release Please bot:
   - `feat:` Introduces a new feature or capability (triggers a minor release, e.g. `0.7.1` &rarr; `0.8.0`).
   - `fix:` Fixes a bug or recovers degraded behavior (triggers a patch release, e.g. `0.7.1` &rarr; `0.7.2`).
   - `feat!:` or `BREAKING CHANGE:` Introduces a breaking API change (triggers a major release).
   - `docs:`, `chore:`, `refactor:`, `test:`, `ci:` Internal maintenance or documentation updates (no release triggered).

7. **Submitting Pull Requests:** Push your branch and open a PR against `main`. Provide a clear summary of changes, rationale, and test results.

8. **Questions & Maintenance:** For questions, architectural discussions, or project maintenance inquiries, contact the project maintainer at **shashankchandel@gmail.com** or open a GitHub Discussion.
