"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import {
  CELEBRATION_SLIDE_INTERVAL_MS,
  hasSlides,
  isSingleSlide,
  nextSlideIndex,
  previousSlideIndex,
  shouldAutoAdvance,
} from "@/lib/celebration-presentation";

export type CelebrationSlideshowSlide = {
  displayName: string;
  birthdayLabel: string;
  turningLabel: string | null;
  bornOnLine: string | null;
  photoUrl: string | null;
  initials: string;
};

type CelebrationSlideshowProps = {
  organizationName: string;
  heading: string;
  dateLabel: string | null;
  workspacePath: string;
  slides: CelebrationSlideshowSlide[];
};

const controlClass = cn(
  buttonVariants({ variant: "outline", size: "icon" }),
  "size-11 border-white/20 bg-white/90 text-[#142033] shadow-none"
);

const portraitClass =
  "aspect-square w-[min(72vw,46vh,28rem)] max-w-full rounded-[1.75rem] object-cover shadow-lg ring-4 ring-white/80";

export function CelebrationSlideshow({
  organizationName,
  heading,
  dateLabel,
  workspacePath,
  slides,
}: CelebrationSlideshowProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const transport = hasSlides(slides.length) && !isSingleSlide(slides.length);
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(shouldAutoAdvance(slides.length, media.matches));
  }, [slides.length]);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => nextSlideIndex(slides.length, current));
    }, CELEBRATION_SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [playing, slides.length]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === rootRef.current);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const onControl =
        target instanceof HTMLElement && target.closest("button, a") !== null;

      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          return;
        }

        event.preventDefault();
        router.push(workspacePath);
        return;
      }

      if (!transport) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setIndex((current) => nextSlideIndex(slides.length, current));
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setIndex((current) => previousSlideIndex(slides.length, current));
        return;
      }

      if ((event.key === " " || event.key === "Spacebar") && !onControl) {
        event.preventDefault();
        setPlaying((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, slides.length, transport, workspacePath]);

  async function enterFullscreen() {
    const root = rootRef.current;

    if (!root || typeof root.requestFullscreen !== "function") {
      return;
    }

    try {
      await root.requestFullscreen();
    } catch {
      setFullscreen(false);
    }
  }

  async function leaveFullscreen() {
    if (!document.fullscreenElement || typeof document.exitFullscreen !== "function") {
      return;
    }

    try {
      await document.exitFullscreen();
    } catch {
      setFullscreen(document.fullscreenElement === rootRef.current);
    }
  }

  function showNext() {
    setPlaying(false);
    setIndex((current) => nextSlideIndex(slides.length, current));
  }

  function showPrevious() {
    setPlaying(false);
    setIndex((current) => previousSlideIndex(slides.length, current));
  }

  if (!slide) {
    return null;
  }

  return (
    <main
      ref={rootRef}
      className="presentation-stage flex min-h-dvh w-full flex-col items-center px-4 py-6 text-center text-white sm:px-8 sm:py-8"
    >
      <div className="flex w-full max-w-6xl flex-1 flex-col items-center justify-center">
        <p className="text-xs font-medium tracking-[0.16em] text-white/75 uppercase sm:text-sm">
          {organizationName}
        </p>
        <h1 className="mt-2 max-w-3xl text-balance text-[clamp(1.25rem,2.4vw,2.25rem)] font-medium tracking-tight text-white/90">
          {heading}
        </h1>
        {dateLabel ? (
          <p className="mt-1 text-sm text-white/75 sm:text-base">{dateLabel}</p>
        ) : null}
        {slide.photoUrl ? (
          <img
            src={slide.photoUrl}
            alt={slide.displayName}
            className={cn(portraitClass, "mt-6 sm:mt-8")}
          />
        ) : (
          <div
            className={cn(
              portraitClass,
              "mt-6 flex items-center justify-center bg-white/15 text-[clamp(2.75rem,8vw,6rem)] font-medium text-white sm:mt-8"
            )}
            aria-hidden="true"
          >
            {slide.initials}
          </div>
        )}
        <h2 className="mt-5 max-w-full px-2 text-balance break-words text-[clamp(2.25rem,6.5vw,6.75rem)] leading-[1.05] font-semibold tracking-tight">
          {slide.displayName}
        </h2>
        <p className="mt-3 text-[clamp(1.125rem,2.2vw,2rem)]">{slide.birthdayLabel}</p>
        {slide.turningLabel ? (
          <p className="mt-1 text-[clamp(1rem,1.8vw,1.5rem)] text-white/80">
            {slide.turningLabel}
          </p>
        ) : null}
        {slide.bornOnLine ? (
          <p className="mt-1 text-[clamp(1rem,1.6vw,1.25rem)] text-white/80">
            {slide.bornOnLine}
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex w-full max-w-3xl flex-col items-center gap-3">
        <p className="text-sm text-white/75">
          {index + 1} of {slides.length}
        </p>
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          {transport ? (
            <button
              type="button"
              className={controlClass}
              aria-label="Previous"
              title="Previous"
              onClick={showPrevious}
            >
              <ChevronLeft />
            </button>
          ) : null}
          {transport ? (
            <button
              type="button"
              className={controlClass}
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause" : "Play"}
              onClick={() => setPlaying((current) => !current)}
            >
              {playing ? <Pause /> : <Play />}
            </button>
          ) : null}
          {transport ? (
            <button
              type="button"
              className={controlClass}
              aria-label="Next"
              title="Next"
              onClick={showNext}
            >
              <ChevronRight />
            </button>
          ) : null}
          <button
            type="button"
            className={controlClass}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={fullscreen ? leaveFullscreen : enterFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </button>
          <Link
            href={workspacePath}
            className={controlClass}
            aria-label="Exit presentation"
            title="Exit presentation"
          >
            <X />
          </Link>
        </div>
      </div>
    </main>
  );
}
