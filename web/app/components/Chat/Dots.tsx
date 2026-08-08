export default function Dots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <i className="dot-bounce block size-1 rounded-full bg-current" />
      <i className="dot-bounce block size-1 rounded-full bg-current" />
      <i className="dot-bounce block size-1 rounded-full bg-current" />
    </span>
  );
}
