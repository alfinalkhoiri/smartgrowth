export function firstErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  }
  return null;
}

// DRF field errors come back as { fieldName: ["message", ...] } — already
// camelCase (djangorestframework-camel-case), so keys match form field names
// directly (e.g. { heightCm: [...] }). Used to highlight the specific input
// that's wrong instead of only showing one generic banner at the top.
export function parseFieldErrors(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      result[key] = value[0];
    }
  }
  return result;
}
