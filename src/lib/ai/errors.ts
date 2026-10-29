export type ProviderErrorKind = "not_configured" | "rate_limited" | "timeout" | "http_error" | "empty" | "invalid_output" | "unsupported";

export class ProviderError extends Error {
  constructor(message: string, public retryable: boolean, public kind: ProviderErrorKind) {
    super(message);
  }
}
