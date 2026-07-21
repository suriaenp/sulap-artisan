import { useEffect, useRef } from 'react';

// Baseline WCAG dialog-pattern behavior — closes on Escape, traps Tab focus
// inside the dialog while it's open, and restores focus to whatever
// triggered it once it closes. None of this app's popups (the shared `Sheet`
// wrapper, PayModal, MobileNavDrawer) had any of this; each rendered a plain
// overlay `<div>` with no `role`, no keyboard handling, and no focus
// management at all.
//
// `existingRef` lets a caller that already has its own ref on the dialog
// node (MobileNavDrawer uses one for its swipe-gesture transform writes)
// pass it in instead of getting a second, separate ref to attach.
// Returns the ref to attach to the dialog's outermost element.
export function useModalA11y(onClose, active = true, existingRef) {
  const ownRef = useRef(null);
  const containerRef = existingRef || ownRef;
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    triggerRef.current = document.activeElement;
    const container = containerRef.current;
    const focusables = () => container
      ? [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null)
      : [];
    (focusables()[0] || container)?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [active, onClose]); // eslint-disable-line react-hooks/exhaustive-deps -- containerRef is a ref object, stable by React convention even when it's the caller's own (MobileNavDrawer's panelRef)

  return containerRef;
}
