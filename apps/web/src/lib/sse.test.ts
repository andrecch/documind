import { describe, expect, it } from "vitest";
import { readSse } from "./sse";

type ProbeEvent = { value: string };

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readSse", () => {
  it("parsea eventos partidos entre chunks", async () => {
    const response = {
      ok: true,
      status: 200,
      body: streamOf([
        'data: {"value":"Se',
        'gún"}\n\ndata:',
        ' {"value":"tus doc"}\n\ndata: [DONE]\n\n',
      ]),
    } as unknown as Response;

    const events: ProbeEvent[] = [];
    let finished = 0;
    await readSse<ProbeEvent>(
      response,
      (event) => events.push(event),
      (status) => {
        finished = status;
      },
    );
    expect(events).toEqual([{ value: "Según" }, { value: "tus doc" }]);
    expect(finished).toBe(200);
  });

  it("cierre normal sin [DONE]", async () => {
    const response = {
      ok: true,
      status: 200,
      body: streamOf(['data: {"value":"a"}\n\ndata: {"value":"b"}\n\n']),
    } as unknown as Response;
    const events: ProbeEvent[] = [];
    let finished = 0;
    await readSse<ProbeEvent>(
      response,
      (event) => events.push(event),
      (status) => {
        finished = status;
      },
    );
    expect(events).toHaveLength(2);
    expect(finished).toBe(200);
  });

  it("frames no parseables se descartan sin romper", async () => {
    const response = {
      ok: true,
      status: 200,
      body: streamOf(['data: basura\n\ndata: {"value":"ok"}\n\n']),
    } as unknown as Response;
    const events: ProbeEvent[] = [];
    await readSse<ProbeEvent>(
      response,
      (event) => events.push(event),
      () => {},
    );
    expect(events).toEqual([{ value: "ok" }]);
  });

  it("status no ok termina sin leer el body", async () => {
    const response = {
      ok: false,
      status: 400,
      body: null,
    } as unknown as Response;
    const events: ProbeEvent[] = [];
    let finished = 0;
    await readSse<ProbeEvent>(
      response,
      (event) => events.push(event),
      (status) => {
        finished = status;
      },
    );
    expect(events).toEqual([]);
    expect(finished).toBe(400);
  });
});
