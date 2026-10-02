import { cn } from "cn";

export function MemberAvatar({
  initials,
  imageUrl,
  size = "sm",
}: {
  initials: string;
  imageUrl: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "size-16 text-base" : "size-8 text-xs";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn(
          sizeClass,
          "shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        sizeClass,
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-1 ring-foreground/10"
      )}
    >
      {initials}
    </span>
  );
}
