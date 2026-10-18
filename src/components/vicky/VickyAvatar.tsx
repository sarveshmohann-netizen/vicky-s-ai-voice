export function VickyAvatar({
  active = false,
  small = false,
}: {
  active?: boolean;
  small?: boolean;
}) {
  return (
    <span
      className={
        "vicky-avatar relative inline-flex shrink-0 flex-col items-center " +
        (active ? "is-speaking" : "")
      }
    >
      <img
        src="/brand/vicky-avatar.svg"
        alt="Vicky"
        className={"rounded-full border border-border " + (small ? "size-9" : "size-14")}
      />
      {active && (
        <span className="vicky-dots" aria-label="Vicky is speaking">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}
