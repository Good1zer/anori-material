import { toHex } from "@anori/utils/color";
import { applyTheme, argbFromHex, themeFromSourceColor } from "@material/material-color-utilities";
import type { Theme } from "./theme";

export type MaterialThemeMode = "auto" | "light" | "dark";

export const DEFAULT_MATERIAL_SEED = "#6750A4";

const normalizeSeed = (seed: string | null | undefined) => {
  if (!seed) return null;
  const normalized = seed.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return null;
};

export const getDerivedSeedFromTheme = (theme: Theme | undefined) => {
  if (!theme) return null;
  return toHex(theme.colors.accent);
};

export const resolveMaterialDark = (mode: MaterialThemeMode, prefersDark: boolean) => {
  if (mode === "auto") return prefersDark;
  return mode === "dark";
};

export const applyMaterialYouTheme = (options: {
  seedColor: string | null | undefined;
  dark: boolean;
  target?: HTMLElement;
}) => {
  const seed = normalizeSeed(options.seedColor) ?? DEFAULT_MATERIAL_SEED;
  const theme = themeFromSourceColor(argbFromHex(seed));
  applyTheme(theme, { target: options.target ?? document.documentElement, dark: options.dark });
  return seed;
};
