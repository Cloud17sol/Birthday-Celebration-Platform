import { parseListPage } from "@/lib/list-page";

export const MEMBER_DIRECTORY_SEARCH_MAX_LENGTH = 254;

export const MEMBER_DIRECTORY_SEARCH_TOO_LONG =
  "Search must be 254 characters or fewer.";

const searchColumns = [
  "display_name",
  "first_name",
  "last_name",
  "email",
  "phone",
] as const;

export type MemberDirectoryStatus = "active" | "inactive" | "all";
export type MemberDirectoryMonth = "all" | "this" | "next";

export type MemberDirectoryParams = {
  q?: unknown;
  status?: unknown;
  month?: unknown;
  page?: unknown;
};

export type ParsedMemberDirectoryQuery = {
  rawQuery: string;
  searchTerm: string | null;
  searchError: string | null;
  status: MemberDirectoryStatus;
  month: MemberDirectoryMonth;
  page: number;
};

function firstParam(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return "";
}

export function parseMemberDirectoryQuery(
  input: MemberDirectoryParams
): ParsedMemberDirectoryQuery {
  const rawQuery = firstParam(input.q).trim();
  const statusValue = firstParam(input.status);
  const monthValue = firstParam(input.month);
  const status: MemberDirectoryStatus =
    statusValue === "inactive" || statusValue === "all" ? statusValue : "active";
  const month: MemberDirectoryMonth =
    monthValue === "this" || monthValue === "next" ? monthValue : "all";

  const page = parseListPage(input.page);

  if (rawQuery.length > MEMBER_DIRECTORY_SEARCH_MAX_LENGTH) {
    return {
      rawQuery,
      searchTerm: null,
      searchError: MEMBER_DIRECTORY_SEARCH_TOO_LONG,
      status,
      month,
      page,
    };
  }

  return {
    rawQuery,
    searchTerm: rawQuery.length > 0 ? rawQuery : null,
    searchError: null,
    status,
    month,
    page,
  };
}

// PostgREST reads a quoted filter value and treats a backslash as an escape.
// It then turns every remaining * into the SQL % wildcard.
// The quotes keep commas, periods, and parentheses inside one value.
// \% and \_ reach SQL as literal percent and underscore.
// A user backslash is doubled again so SQL keeps one literal backslash.
// A user asterisk is sent as \* so the later * -> % step becomes \%,
// a literal percent, instead of a match-everything wildcard.
function quoteIlikeContains(term: string) {
  let escaped = "";

  for (const character of term) {
    if (character === "\\") {
      escaped += "\\\\\\\\";
    } else if (character === "%" || character === "_" || character === "*") {
      escaped += `\\\\${character}`;
    } else if (character === '"') {
      escaped += '\\"';
    } else {
      escaped += character;
    }
  }

  return `"*${escaped}*"`;
}

export function memberDirectorySearchFilter(term: string) {
  if (!term) {
    return null;
  }

  const quoted = quoteIlikeContains(term);

  return searchColumns
    .map((column) => `${column}.ilike.${quoted}`)
    .join(",");
}

export function birthMonthForFilter(
  month: MemberDirectoryMonth,
  currentMonth: number
) {
  if (
    month === "all" ||
    !Number.isInteger(currentMonth) ||
    currentMonth < 1 ||
    currentMonth > 12
  ) {
    return null;
  }

  if (month === "this") {
    return currentMonth;
  }

  return currentMonth === 12 ? 1 : currentMonth + 1;
}

export function memberDirectoryEmptyMessage(query: ParsedMemberDirectoryQuery) {
  if (query.searchTerm || query.month !== "all") {
    return "No members match your search or filters.";
  }

  if (query.status === "inactive") {
    return "No inactive members";
  }

  if (query.status === "all") {
    return "No members yet";
  }

  return "No active members";
}

export function memberDirectoryPath(state: {
  q?: string | null;
  status?: MemberDirectoryStatus;
  month?: MemberDirectoryMonth;
  page?: number;
}) {
  const params = new URLSearchParams();
  const query = state.q?.trim() ?? "";

  if (query.length > 0 && query.length <= MEMBER_DIRECTORY_SEARCH_MAX_LENGTH) {
    params.set("q", query);
  }

  if (state.status === "inactive" || state.status === "all") {
    params.set("status", state.status);
  }

  if (state.month === "this" || state.month === "next") {
    params.set("month", state.month);
  }

  if (state.page != null && state.page > 1) {
    params.set("page", String(state.page));
  }

  const search = params.toString();

  return search ? `/members?${search}` : "/members";
}

export function memberDeactivatePath(
  memberId: string,
  state: {
    q?: string | null;
    status?: MemberDirectoryStatus;
    month?: MemberDirectoryMonth;
    page?: number;
  }
) {
  const directoryPath = memberDirectoryPath(state);
  const search = directoryPath.startsWith("/members?")
    ? directoryPath.slice("/members".length)
    : "";

  return `/members/${memberId}/deactivate${search}`;
}

export function memberDeletePath(
  memberId: string,
  state: {
    q?: string | null;
    status?: MemberDirectoryStatus;
    month?: MemberDirectoryMonth;
    page?: number;
  }
) {
  const directoryPath = memberDirectoryPath(state);
  const search = directoryPath.startsWith("/members?")
    ? directoryPath.slice("/members".length)
    : "";

  return `/members/${memberId}/delete${search}`;
}
