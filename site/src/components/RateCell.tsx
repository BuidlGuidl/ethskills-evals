import { percent, rateBucket } from "../lib/grid.js";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export const RateCell = ({ passed, total, onClick }: {
  passed: number; total: number; onClick: () => void;
}) => {
  const [tip, setTip] = useState<{ left: number; top: number } | null>(null);
  const tipId = useId();
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, [tip]);
  const showTip = (element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    setTip({ left: bounds.left + bounds.width / 2, top: bounds.top - 6 });
  };
  return total === 0 ? <>
    <button type="button" className="rate-empty" aria-label="Not run yet" aria-describedby={tip ? tipId : undefined}
      onMouseEnter={event => showTip(event.currentTarget)} onMouseLeave={() => setTip(null)}
      onFocus={event => showTip(event.currentTarget)} onBlur={() => setTip(null)}>–</button>
    {tip && createPortal(<span className="cell-tooltip" role="tooltip" id={tipId} style={tip}>Not run yet</span>, document.body)}
  </> : (
  <button type="button" className={`rate-cell rate-${rateBucket(percent(passed, total))}`}
    onClick={event => { event.stopPropagation(); onClick(); }}
    aria-label={`${passed} of ${total} runs passed. Open runs`} aria-haspopup="dialog">
    <span className="rate-value">{percent(passed, total)}%</span>
    <span className="rate-count">of {total}</span>
  </button>
);
};
