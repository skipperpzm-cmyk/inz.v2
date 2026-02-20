export function isConnectTimeoutError(error: unknown): boolean {
  const seen = new Set<unknown>();
  const timeoutPattern = /CONNECT_TIMEOUT|statement timeout|canceling statement due to statement timeout|query[_\s-]?canceled|57014/i;

  const visit = (value: unknown): boolean => {
    if (!value || seen.has(value)) return false;
    seen.add(value);

    if (typeof value === 'string') {
      return timeoutPattern.test(value);
    }

    if (typeof value !== 'object') return false;

    const record = value as Record<string, unknown>;
    const code = record.code;
    if (typeof code === 'string' && (code.toUpperCase() === 'CONNECT_TIMEOUT' || code === '57014')) {
      return true;
    }

    const message = record.message;
    if (typeof message === 'string' && timeoutPattern.test(message)) {
      return true;
    }

    const stack = record.stack;
    if (typeof stack === 'string' && timeoutPattern.test(stack)) {
      return true;
    }

    const severity = record.severity;
    if (typeof severity === 'string' && severity.toUpperCase() === 'ERROR') {
      const routine = record.routine;
      if (typeof routine === 'string' && /ProcessInterrupts/i.test(routine) && typeof code === 'string' && code === '57014') {
        return true;
      }
    }

    if (visit(record.cause)) return true;

    try {
      const serialized = JSON.stringify(value);
      if (typeof serialized === 'string' && timeoutPattern.test(serialized)) {
        return true;
      }
    } catch {
      // ignore serialization errors
    }

    return false;
  };

  return visit(error);
}
