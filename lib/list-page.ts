export const LIST_PAGE_SIZE = 15;

function firstParam(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return "";
}

export function parseListPage(value: unknown) {
  const raw = firstParam(value);

  if (!/^[1-9][0-9]*$/.test(raw)) {
    return 1;
  }

  const page = Number(raw);

  if (!Number.isSafeInteger(page)) {
    return 1;
  }

  return page;
}

export function listPageCount(total: number, pageSize = LIST_PAGE_SIZE) {
  if (!Number.isInteger(total) || total < 1) {
    return 1;
  }

  return Math.ceil(total / pageSize);
}

export function listRange(page: number, pageSize = LIST_PAGE_SIZE) {
  const safePage = page < 1 ? 1 : page;
  const from = (safePage - 1) * pageSize;

  return {
    from,
    to: from + pageSize - 1,
  };
}

export function listPagePath(pathname: string, page: number) {
  if (!Number.isInteger(page) || page <= 1) {
    return pathname;
  }

  return `${pathname}?page=${page}`;
}
