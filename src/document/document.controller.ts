import { Controller, Param, Get, UseGuards, Post, Body } from '@nestjs/common';
import { CreateDocumentDto } from './dto/document.dto';
import { DocumentService } from './document.service';
import { Action, Authorize, OsoGuard } from '../oso/oso.guard';
import { LocalAuthGuard } from '../auth/local-auth.guard';

@UseGuards(OsoGuard)
@UseGuards(LocalAuthGuard)
@Controller('document')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {
  }

  @Action('read')
  @Get(':id')
  async findOne(@Param() param: any, @Authorize() authorize: any): Promise<string> {
    const document = await this.documentService.findOne(Number.parseInt(param.id));
    await authorize(document);
    return document ? document.document : undefined;
  }

  @Get()
  async findAll(): Promise<string[]> {
    return (await this.documentService.findAll()).map(document => document.document);
  }

  @Post('create')
  async create(@Body() document: CreateDocumentDto): Promise<number> {
    return this.documentService.create(document.baseId, document.document);
  }
}
