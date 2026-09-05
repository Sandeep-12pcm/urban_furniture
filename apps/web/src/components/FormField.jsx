export function FormField({ label, htmlFor, required, error, hint, children }) {
  return (
    <label className="block text-sm font-semibold text-ink" htmlFor={htmlFor}>
      {label} {required && <span className="text-danger">*</span>}
      <div className="mt-2 font-normal">{children}</div>
      {hint && !error && <p className="mt-1.5 text-xs font-normal text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </label>
  );
}
