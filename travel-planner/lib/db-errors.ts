export function isConnectTimeoutError(error: unknown): boolean {
  const seen = new Set<unknown>();

  const visit = (value: unknown): boolean => {
    if (!value || seen.has(value)) return false;
    seen.add(value);

    if (typeof value === 'string') {
      return /CONNECT_TIMEOUT/i.test(value);
    }

    if (typeof value !== 'object') return false;

    const record = value as Record<string, unknown>;
    const code = record.code;
    if (typeof code === 'string' && code.toUpperCase() === 'CONNECT_TIMEOUT') {
      return true;
    }

    const message = record.message;
    if (typeof message === 'string' && /CONNECT_TIMEOUT/i.test(message)) {
      return true;
    }

    const stack = record.stack;
    if (typeof stack === 'string' && /CONNECT_TIMEOUT/i.test(stack)) {
      return true;
    }

    if (visit(record.cause)) return true;

    try {
      const serialized = JSON.stringify(value);
      if (typeof serialized === 'string' && /CONNECT_TIMEOUT/i.test(serialized)) {
        return true;
      }
    } catch {
      // ignore serialization errors
    }

    return false;
  };

  return visit(error);
}
