
import type {
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import './InputField.css';

interface InputFieldProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightAction?: ReactNode;
  labelAction?: ReactNode;
}

export function InputField({
  id,
  label,
  error,
  hint,
  leftIcon,
  rightAction,
  labelAction,
  className = '',
  ...rest
}: InputFieldProps) {
  const inputId = id ?? rest.name;

  if (!inputId) {
    throw new Error(
      'InputField requiere id o name.',
    );
  }

  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const descripcion = [
    rest['aria-describedby'],
    hint ? hintId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={`ui-field ${className}`}>
      <div className="ui-field__heading">
        <label
          className="ui-field__label"
          htmlFor={inputId}
        >
          {label}
          {rest.required && (
            <span aria-hidden="true"> *</span>
          )}
        </label>

        {labelAction && (
          <div className="ui-field__label-action">
            {labelAction}
          </div>
        )}
      </div>

      <div
        className={[
          'ui-field__control',
          error ? 'ui-field__control--error' : '',
          rest.disabled ? 'ui-field__control--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {leftIcon && (
          <span
            className="ui-field__icon"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}

        <input
          {...rest}
          id={inputId}
          className="ui-field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
          aria-required={rest.required || undefined}
        />

        {rightAction && (
          <div className="ui-field__right-action">
            {rightAction}
          </div>
        )}
      </div>

      {hint && (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      )}

      {error && (
        <p
          className="ui-field__error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}