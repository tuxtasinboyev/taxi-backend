import { Injectable } from "@nestjs/common";
import { Response } from "express";
import { existsSync } from 'fs';
import { getPathInFileType, headerDataStream } from "../../common/types/generator.types";
import { join } from "path";

@Injectable()
export class FileStreamService {
    async fileStream(
        res: Response,
        fileName: string,
    ) {
        const filePath = join(getPathInFileType(fileName), fileName)
        if (!existsSync(filePath)) {
            return res.status(404).json({ message: 'Video not found' });
        }
        headerDataStream(res, filePath, fileName)
    }
}