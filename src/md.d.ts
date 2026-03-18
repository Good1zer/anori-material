import "react";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    type MdProps = Omit<
      DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>,
      "onInput" | "onChange" | "onCancel" | "onClose"
    > & {
      selected?: boolean;
      disabled?: boolean;
      open?: boolean;
      type?: string;
      label?: string;
      value?: string;
      min?: number | string;
      max?: number | string;
      placeholder?: string;
      onCancel?: (event: Event) => void;
      onClose?: (event?: Event) => void;
      onInput?: (event: Event) => void;
      onChange?: (event: Event) => void;
    };

    interface IntrinsicElements {
      "md-switch": MdProps;
      "md-outlined-text-field": MdProps;
      "md-filled-button": MdProps;
      "md-text-button": MdProps;
      "md-outlined-button": MdProps;
      "md-filled-tonal-button": MdProps;
      "md-elevated-card": MdProps;
      "md-outlined-card": MdProps;
      "md-list": MdProps;
      "md-list-item": MdProps & { headline?: string; "supporting-text"?: string };
      "md-dialog": MdProps;
    }
  }
}
