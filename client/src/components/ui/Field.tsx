import { useId, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  full?: boolean;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, optional, full, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-msg`;
  return (
    <div className={full ? 'q-field q-field--full' : 'q-field'}>
      <label className="q-field__label" htmlFor={id}>
        {label}
        {optional ? <span className="q-field__optional">optional</span> : null}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? messageId : undefined })}
      {error ? (
        <p className="q-field__error" id={messageId}>
          {error}
        </p>
      ) : hint ? (
        <p className="q-field__hint" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

/** Two-to-four way switch. Used for connection mode and Bedrock auth mode. */
export function Segmented<T extends string>({ value, options, onChange, disabled, ariaLabel, size = 'md' }: SegmentedProps<T>) {
  return (
    <div className={`q-segmented q-segmented--${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          className={value === option.value ? 'q-segmented__option q-segmented__option--active' : 'q-segmented__option'}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? 'q-switch q-switch--on' : 'q-switch'}
      onClick={() => onChange(!checked)}
    />
  );
}
