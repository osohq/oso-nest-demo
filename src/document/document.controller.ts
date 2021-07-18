import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { getLogger } from 'log4js';
import { BasicAuthGuard } from '../auth/basic-auth.guard';
import { OsoInstance } from '../oso/oso-instance';
import { Authorize, AuthorizeFn, OsoGuard, Resource } from '../oso/oso.guard';
import { DocumentService } from './document.service';
import { Document } from './entity/document';
import { CreateDocumentDto, DocumentSetDto, FindDocumentDto } from './dto/document.dto';
import { EditActionDto } from './dto/edit-action.dto';

@UseGuards(BasicAuthGuard, OsoGuard, OsoInstance)
@Controller('document')
@Resource('Document')
export class DocumentController {

  private readonly logger = getLogger(DocumentController.name);

  constructor(private readonly documentService: DocumentService) {
  }

  @Get(':id')
  async findOne(@Param("id") id: string, @Authorize() authorize: AuthorizeFn): Promise<FindDocumentDto> | undefined {
    const document = await this.documentService.findOne(Number.parseInt(id));
    await authorize(document);
    return document ? new FindDocumentDto(document) : undefined;
  }

  @Get()
  async findAll(@Authorize() authorize: AuthorizeFn): Promise<DocumentSetDto> {
    const authorized: Document[] = [];
    for (const document of await this.documentService.findAll()) {
      try {
        await authorize(document);
        authorized.push(document);
      } catch (err) {
        this.logger.info('document is NOT authorized: ', document);
      }
    }
    return new DocumentSetDto(authorized);
  }

  @Post('create')
  async create(@Authorize() authorize: AuthorizeFn, @Request() request, @Body() document: CreateDocumentDto): Promise<number> {
    document.ownerId = request.user.id;
    return this.documentService.create(document, authorize);
  }

  @Post('edit')
  async edit(@Authorize() authorize: AuthorizeFn,
    @Request() request,
    @Body() editAction: EditActionDto): Promise<FindDocumentDto> {
    this.logger.info('Attempt to edit document: id: ', editAction.documentId);
    const document = await this.documentService.findOne(editAction.documentId);
    this.logger.info('Checking authorization on document: ', document);
    await authorize(document);
    editAction.userId = request.user.id;
    return new FindDocumentDto(await this.documentService.edit(editAction));
  }
}
