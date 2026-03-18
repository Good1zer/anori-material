import { toCss, toHex } from "@anori/utils/color";
import { type CustomTheme, anoriSchema, getAnoriStorage } from "@anori/utils/storage";
import { useStorageValue } from "@anori/utils/storage-lib";
import { DEFAULT_MATERIAL_SEED, getDerivedSeedFromTheme } from "@anori/utils/user-data/material-theme";
import {
  type PartialCustomTheme,
  type Theme,
  applyTheme,
  applyThemeColors,
  defaultTheme,
  deleteThemeBackgrounds,
  getThemeBackground,
  getThemeBackgroundOriginal,
  saveThemeBackground,
  themes,
} from "@anori/utils/user-data/theme";
import clsx from "clsx";
import { m } from "framer-motion";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import browser from "webextension-polyfill";
import "./ThemesScreen.scss";
import { showOpenFilePicker } from "@anori/utils/files";
import { useMirrorStateToRef, useRunAfterNextRender } from "@anori/utils/hooks";
import { guid } from "@anori/utils/misc";
import { setPageBackground } from "@anori/utils/page";
import { useCurrentTheme } from "@anori/utils/user-data/theme-hooks";
import { useTranslation } from "react-i18next";
import "@material/web/switch/switch.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/button/filled-button.js";
import "@material/web/button/text-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/labs/card/outlined-card.js";

const hexToColor = (hex: string) => {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    hue: h / 360,
    saturation: s,
    lightness: l,
    alpha: 1,
  };
};

const ThemePlate = ({
  theme,
  className,
  onEdit,
  onDelete,
  ...props
}: { theme: Theme; onEdit?: VoidFunction; onDelete?: VoidFunction } & ComponentProps<"div">) => {
  const isClickable = typeof props.onClick === "function";
  const [backgroundUrl, setBackgroundUrl] = useState(() => {
    return theme.type === "builtin"
      ? browser.runtime.getURL(`/assets/images/backgrounds/previews/${theme.background}`)
      : null;
  });
  const backgroundUrlRef = useMirrorStateToRef(backgroundUrl);

  useEffect(() => {
    const main = async () => {
      if (theme.type === "custom") {
        const blob = await getThemeBackground(theme.name);
        const url = URL.createObjectURL(blob);
        setBackgroundUrl(url);
      }
    };
    main();
    if (theme.type === "custom") {
      return () => {
        if (backgroundUrlRef.current) {
          URL.revokeObjectURL(backgroundUrlRef.current);
        }
      };
    }
  }, [theme]);

  return (
    <div
      className={clsx("BackgroundPlate", className)}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      {...props}
    >
      <md-outlined-card>
        <div className="theme-plate-body" style={{ backgroundImage: `url(${backgroundUrl})` }}>
          <div className="color-cirles-wrapper">
            <div className="color-circle" style={{ backgroundColor: toCss(theme.colors.background) }} />
            <div className="color-circle" style={{ backgroundColor: toCss(theme.colors.text) }} />
            <div className="color-circle" style={{ backgroundColor: toCss(theme.colors.accent) }} />
          </div>
          <div className="theme-actions">
            {!!onEdit && (
              <md-text-button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit();
                  }
                }}
              >
                <span className="material-symbols-outlined">edit</span>
              </md-text-button>
            )}
            {!!onDelete && (
              <md-text-button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </md-text-button>
            )}
          </div>
        </div>
      </md-outlined-card>
    </div>
  );
};

const ThemeEditor = ({ theme: themeFromProps, onClose }: { theme?: CustomTheme; onClose: VoidFunction }) => {
  const loadBackground = async () => {
    const files = await showOpenFilePicker(false, ".jpg,.jpeg,.png");
    if (!files[0]) return;
    const background = files[0];
    originalBackgroundBlob.current = background;
    applyBlur(theme.blur);
  };

  const applyBlur = useCallback((blur: number) => {
    if (!originalBackgroundBlob.current) return;
    const bgUrl = URL.createObjectURL(originalBackgroundBlob.current);
    const img = new Image();
    img.src = bgUrl;
    img.onload = () => {
      const PADDING = blur * 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.width + PADDING * 2;
      canvas.height = img.height + PADDING * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(`couldn't get 2D context from canvas`);
      }
      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = img.width;
      croppedCanvas.height = img.height;
      const croppedCtx = croppedCanvas.getContext("2d");
      if (!croppedCtx) {
        throw new Error(`couldn't get 2D context from canvas`);
      }
      croppedCtx.drawImage(canvas, PADDING, PADDING, img.width, img.height, 0, 0, img.width, img.height);

      // TODO: we should probably switch to image/webp with compression as current custom backgrounds are quite
      // big. But we need to check if it will affect current users and/or if we can migrate them automatically
      croppedCanvas.toBlob((blob) => {
        if (!blob) return;
        blurredBackgroundBlob.current = blob;
        const url = URL.createObjectURL(blurredBackgroundBlob.current);
        setBackgroundUrl(url);
        setPageBackground(url);
        URL.revokeObjectURL(bgUrl);
      }, "image/png");
    };
  }, []);

  const applyPreview = () => {
    runAfterRender(() => applyThemeColors(theme.colors));
  };

  const saveTheme = async () => {
    if (!originalBackgroundBlob.current || !blurredBackgroundBlob.current) return;

    const id = theme.name;
    await saveThemeBackground(id, "original", originalBackgroundBlob.current);
    await saveThemeBackground(id, "blurred", blurredBackgroundBlob.current);

    const storage = await getAnoriStorage();
    let customThemes = storage.get(anoriSchema.customThemes);
    if (themeFromProps) {
      customThemes = customThemes.map((t) => {
        if (t.name === id) return theme;
        return t;
      });
    } else {
      customThemes.push(theme);
    }
    await storage.set(anoriSchema.customThemes, customThemes);
    setCurrentTheme(theme.name);
    onClose();
  };

  const [currentTheme, setCurrentTheme] = useCurrentTheme();

  const [theme, setTheme] = useState<PartialCustomTheme>(() => {
    if (themeFromProps) return themeFromProps;
    return {
      name: guid(),
      type: "custom",
      blur: 5,
      colors: {
        accent: currentTheme.colors.accent,
        background: currentTheme.colors.background,
        text: currentTheme.colors.text,
      },
    };
  });

  useEffect(() => {
    const main = async () => {
      try {
        const original = await getThemeBackgroundOriginal(theme.name);
        const blurred = await getThemeBackground(theme.name);
        originalBackgroundBlob.current = original;
        blurredBackgroundBlob.current = blurred;
        applyBlur(theme.blur);
      } catch (err) {
        console.log("Error while trying to load background", err);
      }
    };

    main();
  }, [applyBlur, theme.blur, theme.name]);

  const { t } = useTranslation();
  const originalBackgroundBlob = useRef<Blob | null>(null);
  const blurredBackgroundBlob = useRef<Blob | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  useEffect(() => {
    return () => (backgroundUrl ? URL.revokeObjectURL(backgroundUrl) : undefined);
  }, [backgroundUrl]);

  const bgStyles = backgroundUrl
    ? {
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundImage: `url(${backgroundUrl})`,
      }
    : {};

  const runAfterRender = useRunAfterNextRender();

  return (
    <>
      <div className="theme-editor">
        <div className="theme-preview" style={bgStyles} />

        <md-filled-button
          className="select-bg-btn"
          onClick={loadBackground}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              loadBackground();
            }
          }}
        >
          {t("settings.theme.selectBackground")}
        </md-filled-button>

        <div className="blur-settings">
          <label>{t("settings.theme.blur")}:</label>
          <md-outlined-text-field
            type="number"
            min={0}
            max={50}
            value={String(theme.blur)}
            onInput={(e: Event) => {
              const value = Number((e.target as HTMLInputElement & { value: string }).value);
              const next = Number.isNaN(value) ? 0 : Math.min(50, Math.max(0, value));
              setTheme((p) => ({ ...p, blur: next }));
              applyBlur(next);
            }}
          />
        </div>
        <div className="swatches">
          <div className="swatch-wrapper">
            <md-outlined-text-field
              type="color"
              label={t("settings.theme.colorAccent")}
              value={toHex(theme.colors.accent)}
              onInput={(e: Event) => {
                const value = (e.target as HTMLInputElement & { value: string }).value;
                setTheme((p) => ({
                  ...p,
                  colors: {
                    ...p.colors,
                    accent: hexToColor(value),
                  },
                }));
                applyPreview();
              }}
            />
          </div>
          <div className="swatch-wrapper">
            <md-outlined-text-field
              type="color"
              label={t("settings.theme.colorBackground")}
              value={toHex(theme.colors.background)}
              onInput={(e: Event) => {
                const value = (e.target as HTMLInputElement & { value: string }).value;
                setTheme((p) => ({
                  ...p,
                  colors: {
                    ...p.colors,
                    background: hexToColor(value),
                  },
                }));
                applyPreview();
              }}
            />
          </div>
          <div className="swatch-wrapper">
            <md-outlined-text-field
              type="color"
              label={t("settings.theme.colorText")}
              value={toHex(theme.colors.text)}
              onInput={(e: Event) => {
                const value = (e.target as HTMLInputElement & { value: string }).value;
                setTheme((p) => ({
                  ...p,
                  colors: {
                    ...p.colors,
                    text: hexToColor(value),
                  },
                }));
                applyPreview();
              }}
            />
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <md-text-button
          onClick={() => {
            onClose();
            applyTheme(currentTheme);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClose();
              applyTheme(currentTheme);
            }
          }}
        >
          {t("back")}
        </md-text-button>
        <md-filled-button
          disabled={!backgroundUrl}
          onClick={saveTheme}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              saveTheme();
            }
          }}
        >
          {t("save")}
        </md-filled-button>
      </div>
    </>
  );
};

export const ThemesScreen = (props: ComponentProps<typeof m.div>) => {
  const { t } = useTranslation();
  const [customThemes, setCustomThemes] = useStorageValue(anoriSchema.customThemes);
  const [currentTheme, setTheme] = useStorageValue(anoriSchema.theme);
  const [themeMode, setThemeMode] = useStorageValue(anoriSchema.themeMode);
  const [themeSeedColor, setThemeSeedColor] = useStorageValue(anoriSchema.themeSeedColor);
  const [resolvedTheme] = useCurrentTheme();
  const [editorActive, setEditorActive] = useState(false);
  const [editorTheme, setEditorTheme] = useState<CustomTheme | undefined>(undefined);
  const derivedSeed = getDerivedSeedFromTheme(resolvedTheme);
  const effectiveSeed = themeSeedColor ?? derivedSeed ?? DEFAULT_MATERIAL_SEED;

  return (
    <m.div {...props} className="ThemesScreen">
      <div className="material-theme-controls">
        <div className="control-row">
          <span>{t("settings.theme.autoDarkMode")}</span>
          <md-switch
            selected={themeMode === "auto"}
            onChange={(e: Event) => {
              const selected = (e.target as HTMLInputElement & { selected: boolean }).selected;
              if (selected) {
                setThemeMode("auto");
                return;
              }
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              setThemeMode(prefersDark ? "dark" : "light");
            }}
          />
        </div>
        {themeMode !== "auto" && (
          <div className="control-row">
            <span>{t("settings.theme.darkMode")}</span>
            <md-switch
              selected={themeMode === "dark"}
              onChange={(e: Event) => {
                const selected = (e.target as HTMLInputElement & { selected: boolean }).selected;
                setThemeMode(selected ? "dark" : "light");
              }}
            />
          </div>
        )}
        <div className="control-row">
          <span>{t("settings.theme.autoSeed")}</span>
          <md-switch
            selected={themeSeedColor === null}
            onChange={(e: Event) => {
              const selected = (e.target as HTMLInputElement & { selected: boolean }).selected;
              if (selected) {
                setThemeSeedColor(null);
              } else {
                setThemeSeedColor(effectiveSeed);
              }
            }}
          />
        </div>
        <md-outlined-text-field
          type="color"
          label={t("settings.theme.seedColor")}
          value={effectiveSeed}
          disabled={themeSeedColor === null}
          onInput={(e: Event) => {
            const value = (e.target as HTMLInputElement & { value: string }).value;
            setThemeSeedColor(value);
          }}
        />
      </div>
      {editorActive ? (
        <>
          <ThemeEditor theme={editorTheme} onClose={() => setEditorActive(false)} />
        </>
      ) : (
        <>
          <div className="themes-grid">
            {[...themes, ...customThemes].map((theme) => {
              return (
                <ThemePlate
                  theme={theme}
                  className={clsx({ active: theme.name === currentTheme })}
                  onClick={() => {
                    setTheme(theme.name);
                    applyTheme(theme);
                  }}
                  onEdit={
                    theme.type === "custom"
                      ? () => {
                          setEditorTheme(theme);
                          setEditorActive(true);
                        }
                      : undefined
                  }
                  onDelete={
                    theme.type === "custom"
                      ? () => {
                          setCustomThemes((prev) => prev.filter((t) => t.name !== theme.name));
                          deleteThemeBackgrounds(theme.name);
                          if (currentTheme === theme.name) {
                            setTheme(defaultTheme.name);
                            applyTheme(defaultTheme);
                          }
                        }
                      : undefined
                  }
                  key={theme.name}
                />
              );
            })}
          </div>
          <md-filled-button
            onClick={() => setEditorActive(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEditorActive(true);
              }
            }}
          >
            {t("settings.theme.createCustom")}
          </md-filled-button>
        </>
      )}
    </m.div>
  );
};
