import {
  Controller,
  Get,
  Param,
  Res,
  SetMetadata,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { FileStreamService } from './file.stream.service';


@SetMetadata("isPublic", true)
@Controller()
export class FileStreamerController {

  constructor(
    private readonly fileService: FileStreamService
  ) { }

  @Get('video/:file')
  async streamVideo(
    @Param('file') fileName: string,
    @Res() res: Response
  ) {
    return this.fileService.fileStream(res, fileName)
  }

  @Get('archive/:file')
  async streamArchie(
    @Param('fileName') fileName: string,
    @Res() res: Response
  ) {
    
    return this.fileService.fileStream(res, fileName)
  }
  
  @Get('image/:file')
  async streamImage(
    @Param('file') fileName: string,
    @Res() res: Response
  ) {
    console.log(fileName);
    return this.fileService.fileStream(res, fileName)
  }

  @Get('docs/:file')
  async streamDocs(
    @Param('file') fileName: string,
    @Res() res: Response
  ) {
    return this.fileService.fileStream(res, fileName)
  }
}
