import { Bot, User } from "lucide-react";

export default function Avatar({
  role,
}: {
  role: "user" | "assistant";
}) {
  const isUser = role === "user";

  return (
    <div
      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${
        isUser ? "bg-teal text-void" : "bg-elevated text-teal"
      }`}
      aria-hidden
    >
      {isUser ? (
        <User className="size-3.5" strokeWidth={2.2} />
      ) : (
        <Bot className="size-3.5" strokeWidth={2.2} />
      )}
    </div>
  );
}
