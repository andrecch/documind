import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { SearchRequest, SearchResponse } from "@documind/shared";
import { searchRequestSchema } from "@documind/shared";
import { BadRequestException } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchQueryDto, SearchResponseDto, SearchValidationErrorDto } from "./dto";

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(@Inject(SearchService) private readonly service: SearchService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Búsqueda semántica kNN (coseno halfvec) con filtros" })
  @ApiBody({ type: SearchQueryDto })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiBadRequestResponse({ type: SearchValidationErrorDto })
  async search(@Body() body: unknown): Promise<SearchResponse> {
    const parsed = searchRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "La consulta de búsqueda no cumple el formato",
        details: parsed.error instanceof Error ? parsed.error.message : String(parsed.error),
      });
    }
    return this.service.search(parsed.data);
  }
}
