type IconName = "arrow" | "paste" | "send" | "play" | "sparkle" | "plus";

export default function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    paste: (
      <>
        <path d="M8 5V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
        <rect x="5" y="5" width="14" height="17" rx="2" />
        <path d="M9 10h6M9 14h6" />
      </>
    ),
    send: <path d="m21 3-7.6 18-3.7-7.7L2 9.6 21 3ZM9.7 13.3 15 8" />,
    play: <path d="m9 7 8 5-8 5V7Z" fill="currentColor" stroke="none" />,
    sparkle: (
      <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
