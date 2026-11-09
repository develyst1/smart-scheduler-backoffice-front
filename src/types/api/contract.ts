// Shared API response shapes for the Finance API (smart-scheduler-backoffice-back).
// Domain DTOs land here per-feature as each wave is wired.

/** Standard error envelope returned by the backend on failure. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    /** extra facts of the failure (e.g. NEGATIVE_BALANCE: `{model, name, resultingBalance}`); absent on most errors */
    details?: unknown;
  };
}
