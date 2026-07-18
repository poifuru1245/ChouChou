export function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? "");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const escapeAttribute = escapeHtml;

export function announce(message, type = "status") {
  let region = document.getElementById("globalUiMessage");
  if (!region) {
    region = document.createElement("div");
    region.id = "globalUiMessage";
    region.className = "ui-announcer";
    region.setAttribute("role", type === "error" ? "alert" : "status");
    region.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    document.body.appendChild(region);
  }
  region.dataset.type = type;
  region.textContent = message;
}
