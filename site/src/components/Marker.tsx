// A native `title` takes a second to appear, cannot be reached from the keyboard, and gives a
// one-character hover target. This is the same sentence as the footnote under the table, shown
// on hover or focus.
const Marker = ({ symbol, note, className }: { symbol: string; note: string; className?: string }) => (
  <span className={className === undefined ? "marker" : `marker ${className}`} tabIndex={0} role="note" aria-label={note}>
    {symbol}
    <span className="tip">{note}</span>
  </span>
);

export default Marker;
