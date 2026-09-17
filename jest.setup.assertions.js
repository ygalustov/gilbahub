/**
 * GH-457 — every test must make at least one assertion.
 *
 * Class A of the Q26 pass ("the assertion never runs"): a test that reaches
 * its end having checked nothing is green for the same reason an empty
 * function is green. It has appeared here as an early `return` inside the test
 * body (GH-425's `if (!declared) return`, which was always taken), as a loop
 * that never entered, and as a body that only printed. None of those can be
 * found by reading the name, and all of them are found by counting.
 *
 * This is the one class that a setting closes for good rather than a habit:
 * expect.hasAssertions() fails any test that finishes with zero assertions,
 * for every file in the corpus, including files written later.
 *
 * A test that deliberately asserts nothing -- a probe that prints a table --
 * says so in its own body with expect.assertions(0), which is a statement a
 * reader can see and disagree with, rather than an absence nobody notices.
 *
 * Registered through `setupFilesAfterEnv` because it needs the test framework
 * to exist: `setupFiles` runs before `expect` and `beforeEach` are defined.
 */
'use strict';

beforeEach(() => {
    expect.hasAssertions();
});
