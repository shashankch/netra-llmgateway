# Contributing Guidelines

Thank you for your interest in contributing to NETRA! We welcome contributions from developers worldwide.

---

## Development Workflow

1. **Fork & Clone:** Fork the repository on GitHub and clone your fork locally.

2. **Environment Setup:** Ensure you have Java 25 LTS, Gradle 9, Docker, and Python 3.9+ installed.

3. **Branching Model:** Create a descriptive branch from `main`:

   ```bash
   git checkout -b feat/intelligent-failover
   ```

4. **Code Standards:**
   - Adhere to modern Java 25 practices (Records, Pattern Matching, Virtual Threads).
   - Maintain strict `BigDecimal` financial arithmetic.
   - Run unit and integration tests before committing:

     ```bash
     make test
     ```

5. **Evaluation Verification:** Ensure all benchmark suites pass:

   ```bash
   make smoke
   make routing-eval
   make cache-eval
   make load
   ```

6. **Submitting Pull Requests:** Push your branch and open a PR against `main`. Provide a clear summary of changes, rationale, and test results.

7. **Questions & Maintenance:** For questions, architectural discussions, or project maintenance inquiries, contact the project maintainer at **shashankchandel@gmail.com** or open a GitHub Discussion.
