/**
 * Host-agnostic, in-memory sliding-window rate limiter for AI server functions.
 * In-memory per process: restarts wipe counters; each serverless replica
 * enforces is own cop