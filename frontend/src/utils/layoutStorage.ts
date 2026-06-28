const LAYOUT_KEY_PREFIX = "react-resizable-panels:";

export const DARLA_LAYOUT_RESET_EVENT = "darla:reset-layout";

/** Group ids used by resizable panel layouts across the dashboard. */
/** Bump when default panel proportions change to reset saved layouts once. */
export const DARLA_LAYOUT_DEFAULTS_VERSION = "2";

export const DARLA_LAYOUT_GROUP_IDS = [
  "darla-map-outer-v",
  "darla-map-h",
  "darla-overview-outer-v",
  "darla-overview-h",
  "darla-replay-moment-columns",
  "darla-replay-drawer-v",
  "darla-replay-workbench-v",
  "darla-cosim-v",
  "darla-cosim-top-h",
  "darla-cosim-bottom-v",
  "darla-coa-root-v",
  "darla-coa-h",
  "darla-coa-center-v",
  "darla-causal-h",
  "darla-modules-h",
] as const;

export function clearSavedPanelLayouts() {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(LAYOUT_KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    localStorage.removeItem(key);
  }
}

export function ensureDefaultPanelLayouts() {
  const marker = "darla.layout.defaults.version";
  const stored = localStorage.getItem(marker);
  if (stored === DARLA_LAYOUT_DEFAULTS_VERSION) return;
  clearSavedPanelLayouts();
  localStorage.setItem(marker, DARLA_LAYOUT_DEFAULTS_VERSION);
  window.dispatchEvent(new CustomEvent(DARLA_LAYOUT_RESET_EVENT));
}

export function resetPanelLayoutsToDefaults() {
  clearSavedPanelLayouts();
  localStorage.setItem("darla.layout.defaults.version", DARLA_LAYOUT_DEFAULTS_VERSION);
  window.dispatchEvent(new CustomEvent(DARLA_LAYOUT_RESET_EVENT));
}
