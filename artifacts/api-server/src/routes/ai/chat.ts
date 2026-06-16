import { Router, Request, Response } from "express";

const router = Router();

router.post("/stream", async (req: Request, res: Response) => {
  const { messages, systemPrompt } = req.body as {
    messages: Array<{ role: string; content: string }>;
    systemPrompt?: string;
  };

  const apiKey = req.headers["x-anthropic-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: "Anthropic API key required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        stream: true,
        system:
          systemPrompt ??
          "You are an expert coding assistant similar to GitHub Copilot. Help users understand, improve, and extend their code.",
        messages: messages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        ),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(
        `data: ${JSON.stringify({ error: `Anthropic error: ${response.status}` })}\n\n`
      );
      res.end();
      req.log.warn({ status: response.status, body: errorText }, "Anthropic API error");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify({ error: "No response stream" })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (
            parsed["type"] === "content_block_delta" &&
            typeof parsed["delta"] === "object" &&
            parsed["delta"] !== null &&
            (parsed["delta"] as Record<string, unknown>)["type"] === "text_delta"
          ) {
            const text = (parsed["delta"] as Record<string, unknown>)["text"];
            if (typeof text === "string") {
              res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    req.log.error({ err }, "AI chat stream error");
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

router.options("/stream", (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-anthropic-key");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.sendStatus(204);
});

export default router;
