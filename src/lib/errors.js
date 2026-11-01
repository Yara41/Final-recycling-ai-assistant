// Error thrown by the website's API helpers. `code` is a short machine-readable
// reason from the server (e.g. needs_onboarding, rate_limited, insufficient_privilege).
export class ApiError extends Error {
  constructor(message, status = 0, code = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
