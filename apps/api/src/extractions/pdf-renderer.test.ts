import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderPdf } from "./pdf-renderer";

const PDF_1P_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKQlQgL0YxIDI0IFRmIDcyIDcwMCBUZCAoRG9jdU1pbmQgZml4dHVyZSkgVGogRVQKZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMwNCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjM3NAolJUVPRgo=";

describe("renderPdf", () => {
  it("renderiza una página como PNG desde el base64 hardcodeado", async () => {
    const pages = await renderPdf(Buffer.from(PDF_1P_BASE64, "base64"));
    expect(pages).toHaveLength(1);
    expect(pages[0]?.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("renderiza el fixture en disco (mismo binario que usa la API)", async () => {
    const file = path.resolve(process.cwd(), "test", "fixtures", "sample-1p.pdf");
    const pages = await renderPdf(readFileSync(file));
    expect(pages).toHaveLength(1);
  });

  it("falla con PdfRenderError si el buffer no es un PDF", async () => {
    await expect(renderPdf(Buffer.from("esto no es un pdf"))).rejects.toThrow(/PDF/);
  });
});
