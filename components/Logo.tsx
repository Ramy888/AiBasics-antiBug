/** The antiBug mark: a review lens that has checked the code and found it good. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--panel-2)" stroke="var(--border-strong)" />
      <circle cx="14" cy="14" r="7.5" fill="none" stroke="var(--found)" strokeWidth="2.5" />
      <path d="M10.6 14.2l2.3 2.3 4.4-4.6" fill="none" stroke="var(--found)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.6 19.6l5 5" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
