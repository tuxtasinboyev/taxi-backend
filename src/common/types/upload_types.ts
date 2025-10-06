
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { getPathInFileType } from './generator.types';

export type AllowedMime =
  | 'application'   // archive, android fayllar, docs, binary
  | 'audio'         // mp3, wav, ogg, mpeg...
  | 'font'          // woff, ttf...
  | 'image'         // jpg, png, gif, svg...
  | 'message'       // email kabi
  | 'model'         // 3D fayllar
  | 'multipart'     // form data
  | 'text'          // txt, js, ts, html, css...
  | 'video';        // mp4, mkv, webm...

export const fileStorages = (allowedMimes: AllowedMime[]) => ({
  storage: diskStorage({
    destination: (req, file, cb) => {
      const filePath = getPathInFileType(file.originalname);
      cb(null, filePath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  fileFilter: fileFilters(allowedMimes),
});

function fileFilters(allowedMimes: AllowedMime[]) {
  return (req: Request, file: Express.Multer.File, cb) => {
    const mime = file.mimetype.split('/')[0] as AllowedMime;
    console.log(allowedMimes);

    if (!allowedMimes.includes(mime)) {
      cb(
        new UnsupportedMediaTypeException(
          `Fayl turi [${allowedMimes.join(', ')}] bo'lishi kerak`
        ),
        false,
      );
    } else {
      cb(null, true);
    }
  };
}

