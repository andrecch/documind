import {
  Controller,
  Get,
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
import { ApiBody, ApiConsumes, ApiNotFoundResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { DocumentsService } from "./documents.service";
import {
  DocumentNotFoundDto,
  ListDocumentsQueryDto,
  ListDocumentsResponseDto,
  type DocumentResponseDto,
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
