import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";

export const imageExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
    '.tiff', '.ico', '.jfif', '.pjpeg', '.pjp', '.avif'
];

export const videoExtensions = [
    '.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm',
    '.mpeg', '.mpg', '.3gp', '.3g2', '.mts', '.m2ts', '.vob',
    '.ogv', '.ts', '.m4v'
];

export const documentExtensions = ['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.rtf','.odt','.ods','.odp','.md','.csv','.json','.xml','.yml','.yaml','.epub','.js','.ts','.html','.css','.c','.cpp','.h','.hpp','.py','.java','.cs','.go','.rb','.php','.swift','.rs']

export const archiveExtensions = [
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
    '.iso', '.cab', '.lz', '.lzma', '.z', '.tgz', '.txz'
];


export const mimeTypes: [string, string][] = [
  ['.avi', 'video/x-msvideo'],
  ['.mp4', 'video/mp4'],
  ['.mpeg', 'video/mpeg'],
  ['.webm', 'video/webm'],

  ['.zip', 'application/zip'],
  ['.rar', 'application/vnd.rar'],
  ['.7z', 'application/x-7z-compressed'],
  ['.tar', 'application/x-tar'],
  ['.gz', 'application/gzip'],

  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],

  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.txt', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.csv', 'text/csv'],
  ['.json', 'application/json'],
  ['.xml', 'application/xml'],
  ['.yaml', 'application/yaml'],

  // Dasturlash tillari
  ['.js', 'application/javascript'],
  ['.ts', 'application/typescript'],
  ['.html', 'text/html'],
  ['.css', 'text/css'],
  ['.c', 'text/x-c'],
  ['.cpp', 'text/x-c'],
  ['.h', 'text/x-c'],
  ['.py', 'text/x-python'],
  ['.java', 'text/x-java-source'],
  ['.cs', 'text/x-csharp'],
  ['.go', 'text/x-go-source'],
  ['.rb', 'text/x-ruby'],
  ['.php', 'application/x-httpd-php'],
  ['.rs', 'text/x-rust']
];


export function getMymtype(fileName: string) {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const found = mimeTypes.find(([key]) => key === ext);
  return found?.[1] || 'application/octet-stream';
}
