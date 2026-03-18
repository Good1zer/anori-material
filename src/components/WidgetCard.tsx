import { Component, type ComponentProps, createContext, createRef, useContext, useRef, useState } from "react";
import "./WidgetCard.scss";
import "@material/web/labs/card/elevated-card.js";
import "@material/web/button/filled-tonal-button.js";
import { useParentFolder } from "@anori/utils/FolderContentContext";
import { useSizeSettings } from "@anori/utils/compact";
import { type DndItemMeta, ensureDndItemType, useDraggable } from "@anori/utils/drag-and-drop";
import type { GridItemSize, GridPosition } from "@anori/utils/grid/types";
import { positionToPixelPosition, snapToSector } from "@anori/utils/grid/utils";
import { useOnChangeLayoutEffect, useRunAfterNextRender } from "@anori/utils/hooks";
import { minmax } from "@anori/utils/misc";
import { useDerivedMotionValue } from "@anori/utils/motion/derived-motion.value";
import type { AnoriPlugin, ConfigFromWidgetDescriptor, WidgetDescriptor } from "@anori/utils/plugins/types";
import { WidgetMetadataContext } from "@anori/utils/plugins/widget";
import type { Mapping } from "@anori/utils/types";
import clsx from "clsx";
import { type PanInfo, m, useMotionValue } from "framer-motion";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Error happened inside widget");
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <h2>Oops</h2>
          <div className="error-description">Widget failed to render, check console for details.</div>
        </>
      );
    }

    return this.props.children;
  }
}

const WidgetCardContext = createContext({
  cardRef: createRef<HTMLDivElement>(),
});

type WidgetCardProps<WD extends WidgetDescriptor[], W extends WD[number]> = {
  widget: W;
  plugin: AnoriPlugin<string, Mapping, WD>;
} & (
  | {
      type: "mock";
      config?: undefined;
      instanceId?: undefined;
      size?: undefined;
      position?: undefined;
      onUpdateConfig?: undefined;
      onRemove?: undefined;
      onEdit?: undefined;
      onResize?: undefined;
      onPositionChange?: undefined;
      onMoveToFolder?: undefined;
    }
  | {
      type: "widget";
      config: ConfigFromWidgetDescriptor<W>;
      instanceId: string;
      size: GridItemSize;
      position: GridPosition;
      onUpdateConfig: (config: Partial<ConfigFromWidgetDescriptor<W>>) => void;
      onRemove?: () => void;
      onEdit?: () => void;
      onResize?: (newWidth: number, newHeight: number) => boolean | undefined;
      onPositionChange?: (newPosition: GridPosition) => void;
      onMoveToFolder?: (folderId: string) => void;
    }
) &
  Omit<ComponentProps<typeof m.div>, "children" | "onDragEnd" | "onResize">;

export const WidgetCard = <WD extends WidgetDescriptor[], W extends WD[number]>({
  className,
  style,
  widget,
  plugin,
  type,
  config,
  instanceId,
  size,
  position,
  onUpdateConfig,
  onRemove,
  onEdit,
  onResize,
  onPositionChange,
  onMoveToFolder,
  ...props
}: WidgetCardProps<WD, W>) => {
  const startResize = () => {
    setIsResizing(true);
  };

  const convertUnitsToPixels = (unit: number) => unit * grid.boxSize - gapSize * 2;

  const convertPixelsToUnits = (px: number) => Math.round((px + gapSize * 2) / grid.boxSize);

  const updateResize = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!widget.appearance.resizable) return;
    const res = widget.appearance.resizable;
    const minWidth = res === true ? 1 : (res.min?.width ?? 1);
    const minHeight = res === true ? 1 : (res.min?.height ?? 1);
    const maxWidth = res === true ? 999 : (res.max?.width ?? 999);
    const maxHeight = res === true ? 999 : (res.max?.height ?? 999);
    const newWidth = minmax(
      convertUnitsToPixels(sizeToUse.width) + info.offset.x,
      convertUnitsToPixels(minWidth),
      convertUnitsToPixels(maxWidth),
    );
    const newHeight = minmax(
      convertUnitsToPixels(sizeToUse.height) + info.offset.y,
      convertUnitsToPixels(minHeight),
      convertUnitsToPixels(maxHeight),
    );
    const widthUnits = convertPixelsToUnits(newWidth);
    if (resizeWidthUnits !== widthUnits) setResizeWidthUnits(widthUnits);
    const heightUnits = convertPixelsToUnits(newHeight);
    if (resizeHeightUnits !== heightUnits) setResizeHeightUnits(heightUnits);
    resizeWidth.set(newWidth);
    resizeHeight.set(newHeight);
  };

  const finishResize = (_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    setIsResizing(false);
    let shouldReset = true;
    if (onResize) {
      shouldReset = !onResize(resizeWidthUnits, resizeHeightUnits);
    }
    if (shouldReset) {
      resizeWidth.set(convertUnitsToPixels(sizeToUse.width));
      resizeHeight.set(convertUnitsToPixels(sizeToUse.height));
      setResizeWidthUnits(sizeToUse.width);
      setResizeHeightUnits(sizeToUse.height);
    }
  };

  const onDragEnd = (
    foundDestination: DndItemMeta | null,
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    setIsDragging(false);
    if (foundDestination && ensureDndItemType(foundDestination, "folder")) {
      onMoveToFolder?.(foundDestination.id);
      return;
    }

    if (!gridRef.current) return;
    const mainBox = gridRef.current.getBoundingClientRect();
    const relativePoint = {
      x: info.point.x - mainBox.x,
      y: info.point.y - mainBox.y,
    };
    const possibleSnapPoints = snapToSector({ grid, position: relativePoint });
    if (possibleSnapPoints.length === 0) return;
    onPositionChange?.(possibleSnapPoints[0].position);
  };

  const { isEditing, grid, gridRef } = useParentFolder();

  const { gapSize } = useSizeSettings();
  const ref = useRef<HTMLDivElement>(null);
  const runAfterRender = useRunAfterNextRender();

  const sizeToUse = size ? size : widget.appearance.size;

  const resizeWidth = useMotionValue(convertUnitsToPixels(sizeToUse.width));
  const resizeHeight = useMotionValue(convertUnitsToPixels(sizeToUse.height));
  // We need a derived/readonly value to block framer motion from messing with value after initial render
  // More info: https://github.com/OlegWock/anori/issues/115
  const readonlyResizeWidth = useDerivedMotionValue(resizeWidth, (v) => v);
  const readonlyResizeHeight = useDerivedMotionValue(resizeHeight, (v) => v);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeWidthUnits, setResizeWidthUnits] = useState(sizeToUse.width);
  const [resizeHeightUnits, setResizeHeightUnits] = useState(sizeToUse.height);

  const [isDragging, setIsDragging] = useState(false);

  const pixelPosition = position ? positionToPixelPosition({ grid, position }) : { x: 0, y: 0 };

  const { dragControls, elementProps, dragHandleProps } = useDraggable(
    {
      type: "widget",
      id: instanceId || "",
    },
    {
      onDragEnd,
      whileDrag: { zIndex: 9 },
    },
  );
  const drag = type === "widget";
  const dragProps = drag
    ? {
        drag,
        dragSnapToOrigin: true,
        dragElastic: 0,
        ...elementProps,
      }
    : {};

  const children = type === "mock" ? <widget.mock /> : <widget.mainScreen instanceId={instanceId} config={config} />;

  useOnChangeLayoutEffect(() => {
    resizeWidth.set(convertUnitsToPixels(sizeToUse.width));
    resizeHeight.set(convertUnitsToPixels(sizeToUse.height));
    setResizeWidthUnits(sizeToUse.width);
    setResizeHeightUnits(sizeToUse.height);
    setIsResizing(false);
  }, [sizeToUse.width, sizeToUse.height, grid.boxSize, gapSize]);

  const card = (
    <m.div
      id={instanceId ? `WidgetCard-${instanceId}` : undefined}
      ref={ref}
      key={`card-${instanceId}`}
      className={clsx(className, "WidgetCard-shell")}
      transition={{ ease: "easeInOut", duration: 0.15 }}
      exit={isEditing ? { scale: 0 } : undefined}
      whileHover={
        widget.appearance.withHoverAnimation
          ? {
              scale: isEditing ? undefined : 1.05,
            }
          : undefined
      }
      whileTap={
        widget.appearance.withHoverAnimation
          ? {
              scale: isEditing ? undefined : 0.95,
            }
          : undefined
      }
      style={{
        width: readonlyResizeWidth,
        height: readonlyResizeHeight,
        margin: gapSize,
        zIndex: isResizing || isDragging ? 9 : 0,
        position: type === "widget" ? "absolute" : undefined,
        top: isDragging ? (gridRef.current?.getBoundingClientRect().top ?? 0) + pixelPosition.y : pixelPosition.y,
        left: isDragging ? (gridRef.current?.getBoundingClientRect().left ?? 0) + pixelPosition.x : pixelPosition.x,
        ...style,
      }}
      {...dragProps}
      {...props}
    >
      {isEditing && type === "widget" && !!onDragEnd && (
        <div className="widget-action drag-widget-btn">
          <md-filled-tonal-button
            aria-label="Drag widget"
            onPointerDown={(e: ReactPointerEvent) => {
              e.preventDefault();
              setIsDragging(true);
              runAfterRender(() => dragControls.start(e.nativeEvent));
            }}
            onPointerUp={() => setIsDragging(false)}
            {...dragHandleProps}
          >
            <span className="material-symbols-outlined">drag_indicator</span>
          </md-filled-tonal-button>
        </div>
      )}
      {isEditing && type === "widget" && !!onRemove && (
        <div className="widget-action remove-widget-btn">
          <md-filled-tonal-button
            aria-label="Remove widget"
            onClick={onRemove}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRemove();
              }
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </md-filled-tonal-button>
        </div>
      )}
      {isEditing && type === "widget" && !!onEdit && (
        <div className="widget-action edit-widget-btn">
          <md-filled-tonal-button
            aria-label="Edit widget"
            onClick={onEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit();
              }
            }}
          >
            <span className="material-symbols-outlined">edit</span>
          </md-filled-tonal-button>
        </div>
      )}
      {isEditing && type === "widget" && !!widget.appearance.resizable && (
        <div className="widget-action resize-handle">
          <m.div
            onPointerDown={(e) => e.preventDefault()}
            onPanStart={startResize}
            onPan={updateResize}
            onPanEnd={finishResize}
          >
            <md-filled-tonal-button aria-label="Resize widget">
              <span className="material-symbols-outlined">open_in_full</span>
            </md-filled-tonal-button>
          </m.div>
        </div>
      )}
      <md-elevated-card>
        <ErrorBoundary>
          <div className={clsx("WidgetCard-content", !widget.appearance.withoutPadding && "with-padding")}>
            {children}
            {(type === "mock" || isResizing || isDragging) && <div className="interaction-blocker" />}
          </div>
        </ErrorBoundary>
      </md-elevated-card>
    </m.div>
  );

  return (
    <WidgetCardContext.Provider value={{ cardRef: ref }}>
      <WidgetMetadataContext.Provider
        value={{
          pluginId: plugin.id,
          widgetId: widget.id,
          instanceId: instanceId ?? "mock",
          size: isResizing ? { width: resizeWidthUnits, height: resizeHeightUnits } : sizeToUse,
          config: config ?? {},
          updateConfig: (newConf) => onUpdateConfig?.(newConf as Partial<ConfigFromWidgetDescriptor<W>>),
        }}
      >
        {isDragging ? createPortal(card, document.body, `card-${instanceId}`) : card}
      </WidgetMetadataContext.Provider>
    </WidgetCardContext.Provider>
  );
};

export const useParentWidgetCardRef = () => {
  return useContext(WidgetCardContext).cardRef;
};
