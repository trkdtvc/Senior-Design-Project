import { useId, useState } from "react";

const PasswordInput = ({ id, disabled, visibilityLabel, ...inputProps }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [isVisible, setIsVisible] = useState(false);
  const fieldLabel = visibilityLabel || (
    inputProps.name === "confirmPassword" ? "confirm password" : "password"
  );
  const toggleLabel = `${isVisible ? "Hide" : "Show"} ${fieldLabel}`;

  return (
    <div className="auth-password-field">
      <input
        {...inputProps}
        id={inputId}
        type={isVisible ? "text" : "password"}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="none"
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={toggleLabel}
        aria-controls={inputId}
        title={toggleLabel}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {isVisible ? <path d="m3 3 18 18" /> : null}
        </svg>
      </button>
    </div>
  );
};

export default PasswordInput;
