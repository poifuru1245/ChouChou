import { installGlobalUiStates } from "../ui/pageState.js";

export function bootstrapPage({ pageName = "page" } = {}) {
  document.documentElement.dataset.page = pageName;
  installGlobalUiStates();
  document.documentElement.classList.add("js-ready");
}
