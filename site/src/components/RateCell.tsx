import { percent, rateBucket } from "../lib/grid.js";

export const RateCell = ({ passed, total, onClick }: {
  passed: number; total: number; onClick: () => void;
}) => total === 0 ? <span className="rate-empty" title="Not run yet">–</span> : (
  <button type="button" className={`rate-cell rate-${rateBucket(percent(passed, total))}`} onClick={onClick}
    aria-label={`${passed} of ${total} runs passed. Open runs`} aria-haspopup="dialog">
    <span className="rate-value">{percent(passed, total)}%</span>
    <span className="rate-count">of {total}</span>
  </button>
);
