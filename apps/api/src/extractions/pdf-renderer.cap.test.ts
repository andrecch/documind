import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pdf } from "pdf-to-img";
import { MAX_OCR_PAGES, TooManyPagesError } from "./pdf-renderer";

type FakeDocState = { destroyCalls: number; iterated: boolean };

function makeFakeDoc(length: number, state: FakeDocState): Pdf {
  return {
    length,
    metadata: {},
    isDestroyed: false,
    getPage: async () => Buffer.alloc(0),
    destroy: async () => {
      state.destroyCalls += 1;
    },
    [Symbol.asyncIterator]: () => {
      state.iterated = true;
      return {
        next: async () => ({ done: true as const, value: undefined }),
      };
    },
    [Symbol.asyncDispose]: async () => {},
  } as unknown as Pdf;
}

describe("renderPdf cap de páginas", () => {
  afterEach(() => {
    vi.doUnmock("pdf-to-img");
    vi.resetModules();
  });

  it("lanza TooManyPagesError sin iterar cuando supera el tope", async () => {
    const state: FakeDocState = { destroyCalls: 0, iterated: false };
    const fake = makeFakeDoc(MAX_OCR_PAGES + 1, state);
    vi.doMock("pdf-to-img", () => ({ pdf: async () => fake }));
    const { renderPdf } = await import("./pdf-renderer");

    await expect(renderPdf(Buffer.from("x"))).rejects.toBeInstanceOf(TooManyPagesError);
    expect(state.iterated).toBe(false);
    expect(state.destroyCalls).toBe(1);
  });

  it("renderiza exactamente cuando llega al tope", async () => {
    const state: FakeDocState = { destroyCalls: 0, iterated: false };
    const fake = makeFakeDoc(MAX_OCR_PAGES, state);
    vi.doMock("pdf-to-img", () => ({ pdf: async () => fake }));
    const { renderPdf } = await import("./pdf-renderer");

    const pages = await renderPdf(Buffer.from("x"));
    expect(pages).toHaveLength(0);
    expect(state.iterated).toBe(true);
    expect(state.destroyCalls).toBe(1);
  });
});
