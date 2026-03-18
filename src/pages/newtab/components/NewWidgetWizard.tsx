import type { Folder } from "@anori/utils/user-data/types";
import "./NewWidgetWizard.scss";
import { EmptyState } from "@anori/components/EmptyState";
import { Modal } from "@anori/components/Modal";
import { MotionScrollArea, ScrollArea } from "@anori/components/ScrollArea";
import { WidgetCard } from "@anori/components/WidgetCard";
import { availablePluginsWithWidgets } from "@anori/plugins/all";
import type { GridContent, GridDimensions } from "@anori/utils/grid/types";
import { findPositionForItemInGrid } from "@anori/utils/grid/utils";
import type { AnoriPlugin, ConfigFromWidgetDescriptor, WidgetDescriptor } from "@anori/utils/plugins/types";
import { isWidgetNonConfigurable } from "@anori/utils/plugins/widget";
import type { Mapping } from "@anori/utils/types";
import { useFolderWidgets } from "@anori/utils/user-data/hooks";
import { useDirection } from "@radix-ui/react-direction";
import { AnimatePresence, m } from "framer-motion";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@material/web/button/text-button.js";
import "@material/web/labs/card/outlined-card.js";
import "@material/web/list/list.js";
import "@material/web/list/list-item.js";
import "@material/web/textfield/outlined-text-field.js";

export type NewWidgetWizardProps = {
  folder: Folder;
  gridDimensions: GridDimensions;
  layout: GridContent;
  onClose: () => void;
};

export const NewWidgetWizard = ({ onClose, folder, gridDimensions, layout }: NewWidgetWizardProps) => {
  const tryAddWidget = async <WD extends WidgetDescriptor[], W extends WD[number]>(
    plugin: AnoriPlugin<string, Mapping, WD>,
    widget: W,
    config: ConfigFromWidgetDescriptor<W>,
  ) => {
    console.log({ gridDimensions, layout });
    let position = findPositionForItemInGrid({ grid: gridDimensions, layout, item: widget.appearance.size });
    if (!position) {
      const numberOfColumns = Math.max(...layout.map((w) => w.x + w.width), 0);
      position = {
        x: numberOfColumns,
        y: 0,
      };
    }
    const { instanceId } = await addWidget({ plugin, widget, config, position });
    setTimeout(() => {
      document.querySelector(`#WidgetCard-${instanceId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }, 200);
    onClose();
  };

  const onWidgetClick = <WD extends WidgetDescriptor[], W extends WD[number]>(
    widget: W,
    plugin: AnoriPlugin<string, Mapping, WD>,
  ) => {
    if (isWidgetNonConfigurable(widget)) {
      tryAddWidget(plugin, widget, {} as ConfigFromWidgetDescriptor<typeof widget>);
    } else {
      setSelectedPlugin(plugin);
      setSelectedWidget(widget);
    }
  };

  const { addWidget } = useFolderWidgets(folder);
  const [_searchQuery, setSearchQuery] = useState("");
  const searchQuery = _searchQuery.toLowerCase();
  const [selectedPlugin, setSelectedPlugin] = useState<AnoriPlugin | undefined>(undefined);
  const [selectedWidget, setSelectedWidget] = useState<WidgetDescriptor | undefined>(undefined);
  const { t } = useTranslation();
  const dir = useDirection();
  const pluginSectionRefs = useRef<Record<string, HTMLElement | null>>({});

  console.log("Render NewWidgetWizard", { selectedPlugin, selectedWidget });
  const inConfigurationStage = !!(selectedPlugin && selectedWidget);

  const pluginsList = availablePluginsWithWidgets.filter((plugin) => {
    return (
      plugin.name.toLowerCase().includes(searchQuery) ||
      plugin.widgets.some((widget) => widget.name.toLowerCase().includes(searchQuery))
    );
  });

  const scrollToPlugin = (pluginId: string) => {
    const section = pluginSectionRefs.current[pluginId];
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Modal
      title={inConfigurationStage ? t("configureWidget") : t("addWidget")}
      headerButton={
        inConfigurationStage ? (
          <md-text-button
            onClick={() => {
              setSelectedPlugin(undefined);
              setSelectedWidget(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedPlugin(undefined);
                setSelectedWidget(undefined);
              }
            }}
          >
            <span className="material-symbols-outlined">{dir === "ltr" ? "arrow_back" : "arrow_forward"}</span>
          </md-text-button>
        ) : undefined
      }
      closable
      onClose={onClose}
      className="NewWidgetWizard-wrapper"
    >
      <AnimatePresence initial={false} mode="wait">
        {inConfigurationStage && !!selectedWidget.configurationScreen && (
          <MotionScrollArea
            key="configuration"
            className="NewWidgetWizard"
            transition={{ duration: 0.18 }}
            initial={{ translateX: "-50%", opacity: 0 }}
            animate={{ translateX: "0%", opacity: 1 }}
            exit={{ translateX: "-50%", opacity: 0 }}
          >
            <selectedWidget.configurationScreen
              widgetId={selectedWidget.id}
              saveConfiguration={(config) => tryAddWidget(selectedPlugin, selectedWidget, config)}
            />
          </MotionScrollArea>
        )}

        {!inConfigurationStage && (
          <m.div
            key="select"
            className="NewWidgetWizard"
            transition={{ duration: 0.18 }}
            initial={{ translateX: "50%", opacity: 0 }}
            animate={{ translateX: "0%", opacity: 1 }}
            exit={{ translateX: "50%", opacity: 0 }}
          >
            <div className="wizard-topbar">
              <md-outlined-text-field
                className="search-input"
                type="search"
                value={_searchQuery}
                onInput={(e: Event) => {
                  const value = (e.target as HTMLInputElement).value;
                  setSearchQuery(value);
                }}
                label={t("search")}
                placeholder={t("search")}
              />
            </div>

            {pluginsList.length === 0 ? (
              <EmptyState title={t("noResults")} />
            ) : (
              <div className="two-column-content">
                <div className="plugins-sidebar">
                  <md-outlined-card>
                    <ScrollArea className="plugins-list">
                      <md-list>
                        {pluginsList.map((plugin) => (
                          <md-list-item
                            key={plugin.id}
                            type="button"
                            headline={plugin.name}
                            onClick={() => scrollToPlugin(plugin.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                scrollToPlugin(plugin.id);
                              }
                            }}
                          >
                            <span slot="start" className="material-symbols-outlined">
                              extension
                            </span>
                          </md-list-item>
                        ))}
                      </md-list>
                    </ScrollArea>
                  </md-outlined-card>
                </div>

                <ScrollArea className="widgets-area">
                  <div className="new-widget-content">
                    {pluginsList.map((plugin) => {
                      return (
                        <section
                          key={plugin.id}
                          ref={(el) => {
                            pluginSectionRefs.current[plugin.id] = el;
                          }}
                        >
                          <div className="section-header">
                            <h2>{plugin.name}</h2>
                          </div>
                          <md-outlined-card>
                            <div className="widgets-mock-background">
                              <div className="widgets-mocks">
                                {plugin.widgets.map((widget) => (
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    key={widget.id}
                                    onClick={() => onWidgetClick(widget, plugin)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        onWidgetClick(widget, plugin);
                                      }
                                    }}
                                  >
                                    <WidgetCard type="mock" widget={widget} plugin={plugin} />
                                    <div className="widget-name">{widget.name}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </md-outlined-card>
                        </section>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};
