import browser from "webextension-polyfill";
import { applyTheme, defaultTheme, themes } from "@anori/utils/user-data/theme";
import {
  applyMaterialYouTheme,
  coerceMaterialThemeMode,
  DEFAULT_MATERIAL_SEED,
  getDerivedSeedFromTheme,
  resolveMaterialDark,
} from "@anori/utils/user-data/material-theme";

browser.storage.local
  .get({
    theme: { value: defaultTheme.name },
    customThemes: { value: [] },
    themeMode: { value: "auto" },
    themeSeedColor: { value: null },
  })
  .then(({ theme, customThemes, themeMode, themeSeedColor }) => {
    const themeName = theme.value;
    const activeTheme = [...themes, ...(customThemes.value || [])].find((t) => t.name === themeName) || defaultTheme;
    const derivedSeed = getDerivedSeedFromTheme(activeTheme);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const resolvedMode = coerceMaterialThemeMode(themeMode?.value);
    applyMaterialYouTheme({
      seedColor: themeSeedColor?.value ?? derivedSeed ?? DEFAULT_MATERIAL_SEED,
      dark: resolveMaterialDark(resolvedMode, prefersDark),
    });

    return applyTheme(activeTheme);
  });
