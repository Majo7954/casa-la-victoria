
import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';

import './Button.css';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger';

type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leftIcon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const clases = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    fullWidth ? 'ui-button--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      type={type}
      className={clases}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <span
          className="ui-button__spinner"
          aria-hidden="true"
        />
      ) : (
        leftIcon && (
          <span
            className="ui-button__icon"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )
      )}

      <span>
        {isLoading ? 'Procesando...' : children}
      </span>
    </button>
  );
}
