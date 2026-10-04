import { Body, Controller, HttpCode, Inject, Post, Res } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { BadRequestException } from "@nestjs/common";
import type { SseEvent } from "@documind/shared";
import { chatRequestSchema } from "@documind/shared";
import { ChatService } from "./chat.service";
import { ChatRequestDto, ChatSseErrorDto } from "./dto";

@ApiTags("chat")
@Controller("chat")
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Chat grounded: answered por SSE (delta… → citations → fin)",
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiBadRequestResponse({ type: ChatSseErrorDto })
  async chat(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const parsed = chatRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "El mensaje no cumple el formato",
        details: String(parsed.error.message),
      });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const answer = await this.chatService.chat(parsed.data, (text) => {
        res.write(sseFrame({ type: "delta", text } satisfies SseEvent));
      });
      res.write(
        sseFrame({
          type: "citations",
          citations: answer.citations,
          messageId: answer.messageId,
          sessionId: answer.sessionId,
        } satisfies SseEvent),
      );
      res.end();
    } catch {
      res.write(
        sseFrame({
          type: "error",
          code: "LLM_ERROR",
          message: "El proveedor de IA falló durante la respuesta",
        } satisfies SseEvent),
      );
      res.end();
    }
  }
}

function sseFrame(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
