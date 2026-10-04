import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ChatRequestDto {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 4000,
    example: "¿Cuánto costó la instalación eléctrica?",
  })
  message!: string;

  @ApiPropertyOptional({ type: String, format: "uuid" })
  sessionId?: string;
}

export class ChatSseErrorDto {
  @ApiProperty({ example: "LLM_ERROR", type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;
}
