import { listPageCount, listPagePath, listRange, parseListPage } from "../lib/list-page";
import {
  MEMBER_DIRECTORY_SEARCH_TOO_LONG,
  birthMonthForFilter,
  memberDirectoryEmptyMessage,
  memberDirectoryPath,
  memberDirectorySearchFilter,
  parseMemberDirectoryQuery,
} from "../lib/member-directory-query";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function topLevelParts(filter: string) {
  const parts: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < filter.length; index += 1) {
    const character = filter[index];

    if (quoted && character === "\\") {
      current += character + (filter[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      current += character;
      continue;
    }

    if (character === "," && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  parts.push(current);
  return parts;
}

function quotedValue(clause: string) {
  const marker = '.ilike."';
  const start = clause.indexOf(marker);
  assert(start >= 0, `missing ilike value in ${clause}`);
  const valueStart = start + marker.length - 1;
  assert(clause.endsWith('"'), `unclosed value in ${clause}`);
  return clause.slice(valueStart);
}

const blank = parseMemberDirectoryQuery({ q: "   " });
assert(blank.searchTerm === null, "blank search");
assert(blank.searchError === null, "blank search has no error");
assert(memberDirectorySearchFilter("") === null, "blank filter");

const trimmed = parseMemberDirectoryQuery({ q: "  Ada  " });
assert(trimmed.searchTerm === "Ada", "trimmed search");

const accepted = "a".repeat(254);
assert(
  parseMemberDirectoryQuery({ q: accepted }).searchTerm === accepted,
  "254 character search"
);

const rejected = parseMemberDirectoryQuery({ q: "b".repeat(255) });
assert(rejected.searchTerm === null, "255 character search is not queried");
assert(
  rejected.searchError === MEMBER_DIRECTORY_SEARCH_TOO_LONG,
  "255 character message"
);
assert(
  memberDirectoryPath({ q: rejected.rawQuery }) === "/members",
  "255 character search is omitted from the URL"
);

assert(parseMemberDirectoryQuery({}).status === "active", "default status");
assert(parseMemberDirectoryQuery({ status: "active" }).status === "active", "active");
assert(
  parseMemberDirectoryQuery({ status: "inactive" }).status === "inactive",
  "inactive"
);
assert(parseMemberDirectoryQuery({ status: "all" }).status === "all", "all");
assert(
  parseMemberDirectoryQuery({ status: "owner" }).status === "active",
  "invalid status"
);

assert(parseMemberDirectoryQuery({}).month === "all", "default month");
assert(parseMemberDirectoryQuery({ month: "all" }).month === "all", "all months");
assert(parseMemberDirectoryQuery({ month: "this" }).month === "this", "this month");
assert(parseMemberDirectoryQuery({ month: "next" }).month === "next", "next month");
assert(
  parseMemberDirectoryQuery({ month: "upcoming" }).month === "all",
  "invalid month"
);

assert(birthMonthForFilter("next", 12) === 1, "December wraps to January");
assert(birthMonthForFilter("next", 1) === 2, "January next is February");
assert(birthMonthForFilter("this", 10) === 10, "this month is unchanged");
assert(birthMonthForFilter("all", 12) === null, "all months has no predicate");

for (const term of ["%", "_", "\\", "a,b", "a.b", "a(b)", 'say "hi"']) {
  const filter = memberDirectorySearchFilter(term);
  assert(filter, `filter for ${term}`);
  const parts = topLevelParts(filter);
  assert(parts.length === 5, `${term} keeps five search clauses`);
  assert(
    parts.every((part) => part.includes(".ilike.")),
    `${term} stays on ilike`
  );
  const values = parts.map(quotedValue);
  assert(
    values.every((value) => value === values[0]),
    `${term} uses one quoted value`
  );
  assert(!filter.includes(".or("), `${term} does not add an or group`);
  assert(!filter.includes(".eq."), `${term} does not add an equality clause`);
}

assert(
  quotedValue(topLevelParts(memberDirectorySearchFilter("%") ?? "")[0]) ===
    '"*\\\\%*"',
  "percent stays escaped"
);
assert(
  quotedValue(topLevelParts(memberDirectorySearchFilter("_") ?? "")[0]) ===
    '"*\\\\_*"',
  "underscore stays escaped"
);
assert(
  quotedValue(topLevelParts(memberDirectorySearchFilter("\\") ?? "")[0]) ===
    '"*\\\\\\\\*"',
  "backslash stays escaped"
);

const statusChange = memberDirectoryPath({
  q: "john",
  status: "all",
  month: "this",
});
assert(
  statusChange === "/members?q=john&status=all&month=this",
  "status change preserves q and month"
);

const monthChange = memberDirectoryPath({
  q: "john",
  status: "inactive",
  month: "next",
});
assert(
  monthChange === "/members?q=john&status=inactive&month=next",
  "month change preserves q and status"
);

const cleared = memberDirectoryPath({
  status: "inactive",
  month: "this",
});
assert(
  cleared === "/members?status=inactive&month=this",
  "clear search removes q and preserves filters"
);

assert(memberDirectoryPath({}) === "/members", "defaults stay off the URL");
assert(parseMemberDirectoryQuery({}).page === 1, "default page");
assert(parseMemberDirectoryQuery({ page: "2" }).page === 2, "page two");
assert(parseMemberDirectoryQuery({ page: "0" }).page === 1, "page zero");
assert(parseMemberDirectoryQuery({ page: "15abc" }).page === 1, "page junk");
assert(memberDirectoryPath({ page: 1 }) === "/members", "page one stays off the URL");
assert(
  memberDirectoryPath({ status: "all", page: 2 }) === "/members?status=all&page=2",
  "later pages keep filters"
);
assert(parseListPage("3") === 3, "list page three");
assert(listPageCount(0) === 1, "empty page count");
assert(listPageCount(15) === 1, "one full page");
assert(listPageCount(16) === 2, "second page starts at 16");
assert(listRange(2).from === 15 && listRange(2).to === 29, "second page range");
assert(listPagePath("/departments", 1) === "/departments", "first catalog page");
assert(listPagePath("/groups", 2) === "/groups?page=2", "second catalog page");

const safeReturn = memberDirectoryPath({
  q: "https://evil.example/phish",
  status: "inactive",
  month: "next",
});
assert(safeReturn.startsWith("/members?"), "return URL stays on /members");
assert(!safeReturn.includes("://"), "return URL has no protocol");
assert(!safeReturn.startsWith("//"), "return URL is not protocol-relative");
assert(!safeReturn.includes("javascript:"), "return URL has no script URL");

assert(
  memberDirectoryEmptyMessage(
    parseMemberDirectoryQuery({ status: "active" })
  ) === "No active members",
  "active empty state"
);
assert(
  memberDirectoryEmptyMessage(parseMemberDirectoryQuery({ status: "all" })) ===
    "No members yet",
  "all empty state"
);
assert(
  memberDirectoryEmptyMessage(
    parseMemberDirectoryQuery({ status: "inactive" })
  ) === "No inactive members",
  "inactive empty state"
);
assert(
  memberDirectoryEmptyMessage(
    parseMemberDirectoryQuery({ q: "ada", status: "all" })
  ) === "No members match your search or filters.",
  "search empty state"
);

console.log("member directory query checks passed");
