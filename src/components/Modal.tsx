import "./Modal.scss";
import "@material/web/dialog/dialog.js";
import "@material/web/button/text-button.js";
import clsx from "clsx";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalProps = {
  title: string;
  children: ReactNode;
  headerButton?: ReactNode;
  layoutId?: string;
  closable?: boolean;
  closeOnClickOutside?: boolean;
  onClose?: () => void;
  className?: string;
};

export const Modal = ({
  className,
  children,
  title,
  layoutId,
  closable,
  onClose,
  closeOnClickOutside,
  headerButton,
}: ModalProps) => {
  return createPortal(
    <md-dialog
      open
      className={clsx("Modal", className)}
      onCancel={(event: Event) => {
        if (!closable || !onClose) {
          event.preventDefault();
          return;
        }
        if (closeOnClickOutside === false) {
          event.preventDefault();
          return;
        }
        onClose();
      }}
      onClose={() => {
        if (!closable || !onClose) return;
        onClose();
      }}
      data-layout-id={layoutId}
    >
      <div slot="headline" className="modal-header">
        {headerButton}
        <h2>{title}</h2>
      </div>
      <div slot="content" className="modal-content">
        {children}
      </div>
      {closable && (
        <div slot="actions">
          <md-text-button
            onClick={onClose}
            onKeyDown={(e) => {
              if (!onClose) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClose();
              }
            }}
          >
            Close
          </md-text-button>
        </div>
      )}
    </md-dialog>,
    document.body,
  );
};
