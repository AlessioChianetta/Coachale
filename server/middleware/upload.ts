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
  // Allow common file types including new knowledge base formats
  const allowedExtensions = /\.(jpeg|jpg|png|gif|bmp|webp|pdf|doc|docx|txt|md|markdown|rtf|odt|csv|xls|xlsx|ppt|pptx|mp4|mov|avi|mkv|webm|mp3|wav|m4a|ogg)$/i;
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/rtf',
    'application/rtf',
    'application/vnd.oasis.opendocument.text',
    // Data files
    'text/csv',
    'application/csv',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Presentations  
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Videos
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
    // Audio (for transcription)
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 
    'audio/webm', 'audio/ogg', 'audio/vorbis',
    'audio/mp4', 'audio/m4a', 'audio/x-m4a'
  ];

  const extname = allowedExtensions.test(file.originalname);
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error(`File type not supported. Allowed types: documents (pdf, doc, docx, txt, md, rtf, odt), data (csv, xls, xlsx), presentations (ppt, pptx), audio (mp3, wav, m4a, ogg). Received: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: fileFilter,
});
