export type FieldErrors = Partial<Record<string, string>>;

export const formClass =
  "flex flex-col gap-5 rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]";
export const saveClass =
  "flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]";
const inputClass =
  "h-11 rounded-lg border border-black/[.12] bg-transparent px-3 text-base outline-none focus:border-foreground aria-[invalid=true]:border-red-500 dark:border-white/[.18]";

type FieldProps = {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function AccountField(props: FieldProps) {
  const { name, label, type, autoComplete, value, error, onChange } = props;
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={inputClass}
      />
      {error && (
        <span id={errorId} className="font-normal text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
