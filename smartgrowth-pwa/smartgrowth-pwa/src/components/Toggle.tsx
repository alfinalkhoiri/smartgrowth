interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// Pill switch, styled to match the checked/unchecked visual pattern used
// across the app's boolean fields (e.g. ASI Eksklusif) instead of a plain
// checkbox — same underlying <input type="checkbox">, so it stays fully
// keyboard/screen-reader accessible.
export function Toggle({ id, label, checked, onChange }: ToggleProps) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer select-none">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="relative inline-flex items-center shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="w-11 h-6 rounded-full bg-gray-300 peer-checked:bg-primary transition-colors
            peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30"
          aria-hidden="true"
        />
        <span
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform
            peer-checked:translate-x-5"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}
