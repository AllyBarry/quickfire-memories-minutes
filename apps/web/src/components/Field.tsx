import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import "./Field.css";

interface Base {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Show a character counter against this limit. */
  limit?: number;
  value: string;
}

type InputProps = Base & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "id">;
type AreaProps = Base & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "id">;

/** Labelled input or textarea with hint, counter and error, used by every demo form. */
export function Field(props: InputProps | AreaProps) {
  const { id, label, hint, error, limit, value, multiline, ...rest } = props;
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    maxLength: limit,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <div className="field__top">
        <label htmlFor={id}>{label}</label>
        {limit !== undefined && (
          <span className={`field__count ${value.length > limit * 0.9 ? "is-near" : ""}`} aria-hidden="true">
            {value.length}/{limit}
          </span>
        )}
      </div>
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea rows={4} {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error && (
        <p className="field__err" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}
