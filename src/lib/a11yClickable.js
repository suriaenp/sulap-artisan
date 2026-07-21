// Spread onto a non-<button> element (span/div) that has an onClick handler,
// so keyboard users (Enter/Space) and screen readers (role="button", real
// focus) can activate it too — this app has ~26 such "action" elements
// styled as plain text/icon links rather than actual <button>s, which
// previously could never receive keyboard focus at all, let alone be
// activated without a mouse.
export function clickable(onClick) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
    },
  };
}
