import { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonVariant = "primary" | "secondary" | "outline";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: CSSProperties;
  className?: string;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  style,
  className,
  onMouseEnter,
  onMouseLeave,
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`];
  if (className) {
    classes.push(className);
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes.join(" ")}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  children: ReactNode;
  to: string;
  variant?: ButtonVariant;
  style?: CSSProperties;
  className?: string;
}

export function ButtonLink({
  children,
  to,
  variant = "primary",
  style,
  className,
}: ButtonLinkProps) {
  const classes = ["btn", `btn--${variant}`];
  if (className) {
    classes.push(className);
  }

  return (
    <Link
      to={to}
      className={classes.join(" ")}
      style={style}
    >
      {children}
    </Link>
  );
}
