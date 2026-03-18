import browser from "webextension-polyfill";
import { applyTheme, defaultTheme, themes } from "@anori/utils/user-data/theme";
import {
  applyMaterialYouTheme,
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

    applyMaterialYouTheme({
      seedColor: themeSeedColor?.value ?? derivedSeed ?? DEFAULT_MATERIAL_SEED,
      dark: resolveMaterialDark(themeMode?.value ?? "auto", prefersDark),
    });

    return applyTheme(activeTheme);
  });
