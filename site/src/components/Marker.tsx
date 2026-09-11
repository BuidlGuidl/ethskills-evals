import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

// A native `title` takes a second to appear, cannot be reached from the keyboard, and gives a
// one-character hover target. This is the same sentence as the footnote under the table, shown
// on hover or focus.
//
// The bubble is positioned against the viewport rather than the mark: the summary table sits
// in a box that scrolls sideways on narrow screens, and a box that scrolls on one axis clips
// on the other, so a bubble hanging off the last row was cut at the box's edge. Fixed
// positioning escapes the box; the bubble goes below the mark, or above it when below would
// run off the screen.
const TIP_WIDTH = 340;
const GAP = 6;

const Marker = ({ symbol, note, className }: { symbol: string; note: string; className?: string }) => {
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const show = () => {
    const rect = anchor.current?.getBoundingClientRect();

    if (rect === undefined) {
      return;
    }

    const left = Math.max(8, Math.min(rect.right - TIP_WIDTH, window.innerWidth - TIP_WIDTH - 8));

    setStyle({ left, top: rect.bottom + GAP });
  };

  const hide = () => setStyle(null);

  // Measured once it exists: a bubble that would end below the viewport is flipped above.
  useLayoutEffect(() => {
    const bubble = tip.current?.getBoundingClientRect();
    const rect = anchor.current?.getBoundingClientRect();

    if (style === null || bubble === undefined || rect === undefined || bubble.bottom <= window.innerHeight) {
      return;
    }

    setStyle({ left: style.left, top: Math.max(8, rect.top - GAP - bubble.height) });
  }, [style]);

  // Anchored to the viewport, the bubble would stay put while the page scrolls under it.
  useEffect(() => {
    if (style === null) {
      return;
    }

    window.addEventListener("scroll", hide, true);

    return () => window.removeEventListener("scroll", hide, true);
  }, [style]);

  return (
    <span
      ref={anchor}
      className={className === undefined ? "marker" : `marker ${className}`}
      tabIndex={0}
      role="note"
      aria-label={note}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {symbol}
      {style !== null && (
        <span ref={tip} className="tip" style={style}>
          {note}
        </span>
      )}
    </span>
  );
};

export default Marker;
