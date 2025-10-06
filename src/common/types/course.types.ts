import { diskStorage } from 'multer';
import { extname } from 'path';

export const FileWriter = diskStorage({
  destination: './uploads/courses',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
  },
});


export const filesInPut = [
  { name: 'banner', maxCount: 1 },
  { name: 'introVideo', maxCount: 1 },
];
