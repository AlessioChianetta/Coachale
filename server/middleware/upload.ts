import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow common file types
  const allowedExtensions = /\.(jpeg|jpg|png|gif|bmp|webp|pdf|doc|docx|txt|rtf|odt|xls|xlsx|ppt|pptx|mp4|mov|avi|mkv|webm|mp3|wav)$/i;
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
    'application/rtf',
    'application/vnd.oasis.opendocument.text',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Presentations  
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Videos
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/webm', 'audio/ogg'
  ];

  const extname = allowedExtensions.test(file.originalname);
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error(`File type not supported. Allowed types: images (jpg, png, gif), documents (pdf, doc, docx, txt, rtf), spreadsheets (xls, xlsx), presentations (ppt, pptx), videos (mp4, mov, avi), and audio files (mp3, wav). Received: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: fileFilter,
});
