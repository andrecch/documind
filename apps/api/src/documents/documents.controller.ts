import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { DocumentsService } from "./documents.service";
import {
  DeletedDto,
  DocumentNotFoundDto,
  DocumentResponseDto,
  ListDocumentsQueryDto,
  ListDocumentsResponseDto,
} from "./dto";
import { MAX_FILE_BYTES } from "./mime";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<DocumentResponseDto> {
    return this.documents.create(file);
  }

  @Get()
  async list(@Query() query: ListDocumentsQueryDto): Promise<ListDocumentsResponseDto> {
    return this.documents.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: DocumentResponseDto })
  @ApiNotFoundResponse({ type: DocumentNotFoundDto })
  async get(@Param("id") id: string): Promise<DocumentResponseDto> {
    const row = await this.documents.getOrFail(id);
    return this.documents.toDto(row);
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOkResponse({ type: DeletedDto })
  @ApiNotFoundResponse({ type: DocumentNotFoundDto })
  async delete(@Param("id") id: string): Promise<DeletedDto> {
    await this.documents.remove(id);
    return { ok: true };
  }

  @Get(":id/file")
  @ApiNotFoundResponse({ type: DocumentNotFoundDto })
  async file(@Param("id") id: string, @Res() res: Response): Promise<void> {
    const meta = await this.documents.getFileMeta(id);
    if (!meta)
      throw new NotFoundException({
        code: "DOCUMENT_NOT_FOUND",
        message: "Documento no encontrado",
      });
    res.setHeader("Content-Type", meta.row.mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(meta.row.filename)}"`,
    );
    res.setHeader("Accept-Ranges", "bytes");
    res.sendFile(meta.absolutePath);
  }
}
