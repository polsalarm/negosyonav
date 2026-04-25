import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeLLMWithPdf } from "./llm";

describe("invokeLLMWithPdf", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns parsed JSON when jsonMode and Gemini returns text part", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"hello":"world"}' }] } }],
        }),
        { status: 200 },
      ),
    );

    const result = await invokeLLMWithPdf<{ hello: string }>({
      pdfBytes: Buffer.from("%PDF-1.4 dummy"),
      prompt: "x",
      jsonMode: true,
    });

    expect(result).toEqual({ hello: "world" });
  });

  it("throws on non-200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("rate limit", { status: 429 }),
    );

    await expect(
      invokeLLMWithPdf({ pdfBytes: Buffer.from("x"), prompt: "x", jsonMode: true }),
    ).rejects.toThrow(/429/);
  });

  it("throws when jsonMode and Gemini text is not valid JSON", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "not json" }] } }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      invokeLLMWithPdf({ pdfBytes: Buffer.from("x"), prompt: "x", jsonMode: true }),
    ).rejects.toThrow(/non-JSON/);
  });
});
