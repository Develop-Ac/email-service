export function buildPagination(page = 1, pageSize = 20): { limit: number; offset: number } {
  const normalizedPage = page > 0 ? page : 1;
  const normalizedPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

  return {
    limit: normalizedPageSize,
    offset: (normalizedPage - 1) * normalizedPageSize,
  };
}