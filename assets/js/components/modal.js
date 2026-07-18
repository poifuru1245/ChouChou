const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function setModalOpen(modal, open, options = {}) {
  if (!modal) return;
  modal.hidden = !open;
  modal.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle(options.bodyClass || "is-modal-open", open);
  if (open) modal.querySelector(FOCUSABLE)?.focus();
  else if (options.returnFocus instanceof HTMLElement) options.returnFocus.focus();
}

export function trapModalFocus(event, modal) {
  if (event.key !== "Tab" || !modal) return;
  const controls = [...modal.querySelectorAll(FOCUSABLE)].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
