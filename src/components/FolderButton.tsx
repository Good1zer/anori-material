import clsx from "clsx";
import "@material/web/list/list-item.js";
import { type ComponentProps, useState } from "react";
import { Icon } from "./icon/Icon";
import "./FolderButton.scss";
import { useCurrentlyDragging } from "@anori/utils/drag-and-drop";
import { DropDestination } from "./DropDestination";

export type FolderButtonProps = {
  name: string;
  icon: string;
  materialSymbol?: string;
  active?: boolean;
  withRedDot?: boolean;
  sidebarOrientation: "vertical" | "horizontal";
  layoutId?: string;
  dropDestination?: {
    id: string;
  };
} & ComponentProps<"div">;

export const FolderButton = ({
  name,
  active,
  icon,
  materialSymbol,
  className,
  withRedDot,
  sidebarOrientation,
  dropDestination,
  layoutId,
  ...props
}: FolderButtonProps) => {
  const currentlyDraggingWidget = useCurrentlyDragging({ type: "widget" });
  const [highlightDrop, setHighlightDrop] = useState(false);

  const content = (
    <div
      className={clsx("FolderButton-wrap", className, {
        "drop-destination": currentlyDraggingWidget && !!dropDestination,
        "highlight-drop": highlightDrop,
      })}
      data-layout-id={layoutId}
      {...props}
    >
      <md-list-item type="button" selected={active} title={name}>
        <span slot="start" className="folder-icon">
          {materialSymbol ? (
            <span className="material-symbols-outlined" aria-hidden="true">
              {materialSymbol}
            </span>
          ) : (
            <Icon icon={icon} width={24} height={24} />
          )}
        </span>
        <span slot="headline">{name}</span>
        {withRedDot && <span slot="end" className="red-dot" aria-hidden="true" />}
      </md-list-item>
    </div>
  );

  if (dropDestination) {
    return (
      <DropDestination
        type="folder"
        id={dropDestination.id}
        filter="widget"
        onDragEnter={() => setHighlightDrop(true)}
        onDragLeave={() => setHighlightDrop(false)}
      >
        {content}
      </DropDestination>
    );
  }

  return content;
};
