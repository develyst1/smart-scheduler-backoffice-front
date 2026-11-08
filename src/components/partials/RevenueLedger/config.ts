/**
 * TASK-859: dev-only fake for the revenue ledger API (SPEC-098 §3), used until TASK-858's routes exist.
 * Must stay `false` in delivered code. Flip it locally to see the screens without the back end; never an env key.
 */
export const USE_FAKE_REVENUE = false;
