export async function readSse<T>(
  response: Response,
  onEvent: (event: T) => void,
  onFinish: (status: number) => void,
): Promise<void> {
  if (!response.ok) {
    onFinish(response.status);
    return;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    onFinish(response.status);
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          onEvent(JSON.parse(payload) as T);
        } catch {
          continue;
        }
      }
    }
  }
  onFinish(response.status);
}
