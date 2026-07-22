export function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.3 15.3 9.7 14.1 13.7H9.9L8.7 9.7Z" />
      <path d="M12 7.3V3.8" />
      <path d="M15.3 9.7 18.7 8.3" />
      <path d="M14.1 13.7 15.9 17.3" />
      <path d="M9.9 13.7 8.1 17.3" />
      <path d="M8.7 9.7 5.3 8.3" />
    </svg>
  );
}
