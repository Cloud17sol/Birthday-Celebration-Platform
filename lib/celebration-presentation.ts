import type { CivilDate, MonthBirthday } from "@/lib/birthday";
import { strictCalendarMonth } from "@/lib/birthday-calendar";
import {
  bornOnLine,
  formatCelebrationDate,
  turningLabel,
} from "@/lib/dashboard-birthday";
import { memberInitials } from "@/lib/member-photo";

export const CELEBRATION_SLIDE_INTERVAL_MS = 7000;

export type CelebrationSlideInput = {
  birthday: MonthBirthday;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
};

export type CelebrationSlide = {
  id: string;
  displayName: string;
  occurrence: CivilDate;
  birthdayLabel: string;
  ageTurning: number | null;
  turningLabel: string | null;
  bornOnLine: string | null;
  photoUrl: string | null;
  initials: string;
};

function presentationPhotoUrl(photoUrl: string | null | undefined) {
  if (typeof photoUrl !== "string") {
    return null;
  }

  const trimmed = photoUrl.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed;
}

export function buildCelebrationSlides(
  people: readonly CelebrationSlideInput[]
): CelebrationSlide[] {
  return people.map((person) => {
    const birthday = person.birthday;

    return {
      id: birthday.id,
      displayName: birthday.displayName,
      occurrence: birthday.occurrence,
      birthdayLabel: formatCelebrationDate(birthday.occurrence),
      ageTurning: birthday.ageTurning,
      turningLabel: turningLabel(birthday.ageTurning),
      bornOnLine: bornOnLine(birthday),
      photoUrl: presentationPhotoUrl(person.photoUrl),
      initials: memberInitials(
        person.firstName,
        person.lastName,
        birthday.displayName
      ),
    };
  });
}

export function hasSlides(slideCount: number) {
  return Number.isInteger(slideCount) && slideCount > 0;
}

export function isSingleSlide(slideCount: number) {
  return slideCount === 1;
}

function usableSlideCount(slideCount: number) {
  if (!Number.isInteger(slideCount) || slideCount <= 0) {
    return 0;
  }

  return slideCount;
}

function normalizedSlideIndex(slideCount: number, currentIndex: number) {
  if (!Number.isInteger(currentIndex)) {
    return 0;
  }

  return ((currentIndex % slideCount) + slideCount) % slideCount;
}

export function nextSlideIndex(slideCount: number, currentIndex: number) {
  const count = usableSlideCount(slideCount);

  if (count <= 1) {
    return 0;
  }

  return (normalizedSlideIndex(count, currentIndex) + 1) % count;
}

export function previousSlideIndex(slideCount: number, currentIndex: number) {
  const count = usableSlideCount(slideCount);

  if (count <= 1) {
    return 0;
  }

  const index = normalizedSlideIndex(count, currentIndex);

  return (index - 1 + count) % count;
}

export function shouldAutoAdvance(
  slideCount: number,
  prefersReducedMotion: boolean
) {
  return usableSlideCount(slideCount) >= 2 && prefersReducedMotion === false;
}

export function celebrationPresentationPath(year: number, month: number) {
  const selected = strictCalendarMonth(String(year), String(month));

  if (!selected) {
    return null;
  }

  return `/celebrations/present?year=${selected.year}&month=${selected.month}`;
}
