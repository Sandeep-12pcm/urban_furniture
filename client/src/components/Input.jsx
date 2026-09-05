export function Input(props) {
  return (
    <input
      className="h-11 w-full rounded-xl border border-borderSoft bg-white px-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-indigo focus:ring-4 focus:ring-lavender/60 disabled:bg-page disabled:text-muted"
      {...props}
    />
  );
}
