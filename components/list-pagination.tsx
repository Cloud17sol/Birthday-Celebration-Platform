import Link from "next/link";

const pageLinkClass =
  "flex h-9 min-w-24 items-center justify-center rounded-lg px-3 text-sm font-medium text-[#52657a] ring-1 ring-[#e2e8f0]";

const pageMutedClass =
  "flex h-9 min-w-24 items-center justify-center rounded-lg px-3 text-sm font-medium text-[#52657a]/40 ring-1 ring-[#e2e8f0]";

export function ListPagination({
  page,
  pageCount,
  hrefForPage,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const current = Math.min(Math.max(page, 1), pageCount);

  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
      {current > 1 ? (
        <Link href={hrefForPage(current - 1)} className={pageLinkClass}>
          Previous
        </Link>
      ) : (
        <span className={pageMutedClass}>Previous</span>
      )}
      <p className="text-sm text-muted-foreground">
        Page {current} of {pageCount}
      </p>
      {current < pageCount ? (
        <Link href={hrefForPage(current + 1)} className={pageLinkClass}>
          Next
        </Link>
      ) : (
        <span className={pageMutedClass}>Next</span>
      )}
    </nav>
  );
}
