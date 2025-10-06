import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { createReadStream, existsSync, mkdirSync } from "fs";
import { stat } from "fs/promises";
import { extname, join } from "path";
import { archiveExtensions, documentExtensions, getMymtype, imageExtensions, videoExtensions } from "./filter.file.types";


export function urlGenerator(config: ConfigService, param: string) {
  const extract = extname(param)
  const serverRot = (imageExtensions.includes(extract)) ? "image" :
    videoExtensions.includes(extract) ? "video" :
      archiveExtensions.includes(extract) ? "archive" :
        "docs"
  const host = config.get<string>("HOST")
  const port = config.get<string>("PORT")
  console.log("generator url faylida",host,port);

  const baseUrl = config.get<string>("APP_BASE_URL") || `http://${host}:${port}`
  const result = `${serverRot}/${param}`
  return result
}


export function homeworkFilesUrlGeneretor(fileName: string) {
  const extract = extname(fileName)
}

export function getPathInFileType(fileName: string) {
  const extract = extname(fileName).toLowerCase()
  let filePath = join(process.cwd(), "..", "core", "uploads", "unknown")

  if (imageExtensions.includes(extract)) {
    filePath = join(process.cwd(), "..", "core", "uploads", "images")
  }
  if (videoExtensions.includes(extract)) {
    filePath = join(process.cwd(), "..", "core", "uploads", "videos")
  }
  if (documentExtensions.includes(extract)) {
    filePath = join(process.cwd(), "..", "core", "uploads", "docs")
  }
  if (archiveExtensions.includes(extract)) {
    filePath = join(process.cwd(), "..", "core", "uploads", "axrchive")
  }
  if (!existsSync(filePath)) {
    mkdirSync(filePath, { recursive: true })
  }
  return filePath
}

export async function headerDataStream(res: Response, filePath: string, fileName: string) {
  const fileSize = (await stat(filePath)).size;
  const range = res.req.headers.range;
  const mimeType = getMymtype(fileName)

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const file = createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
    });
    createReadStream(filePath).pipe(res);
  }
}