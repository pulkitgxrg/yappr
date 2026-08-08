export async function readApiError(
  response: Response,
  fallback = "Something went wrong.",
): Promise<string> {
  const text = await response.text();
  if (!text) return fallback;

  try {
    const json = JSON.parse(text) as { detail?: unknown };
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail)) {
      return json.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: string }).msg)
            : JSON.stringify(d),
        )
        .join("; ");
    }
  } catch {
  }
  return text.slice(0, 280) || fallback;
}
