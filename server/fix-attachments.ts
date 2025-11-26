
import { db } from "./db.js";
import * as schema from "@shared/schema";

async function fixAttachmentsFormat() {
  console.log('Starting attachment format fix...');
  
  try {
    // Get all documents with attachments
    const documents = await db.select().from(schema.libraryDocuments);
    
    let fixedCount = 0;
    
    for (const doc of documents) {
      if (doc.attachments && Array.isArray(doc.attachments) && doc.attachments.length > 0) {
        let needsUpdate = false;
        
        const fixedAttachments = doc.attachments.map((att: any) => {
          // If it's already an object, keep it
          if (typeof att === 'object' && att.filename) {
            return att;
          }
          
          // If it's a string, convert to object format
          if (typeof att === 'string') {
            needsUpdate = true;
            
            // Check if it's a UUID filename
            if (att.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
              const extension = att.split('.').pop();
              return {
                filename: att,
                originalName: `Documento.${extension}`,
                size: 0,
                mimetype: getMimetypeFromExtension(extension)
              };
            } else {
              return {
                filename: att,
                originalName: att,
                size: 0,
                mimetype: 'application/octet-stream'
              };
            }
          }
          
          return att;
        });
        
        if (needsUpdate) {
          await db.update(schema.libraryDocuments)
            .set({ 
              attachments: fixedAttachments,
              updatedAt: new Date()
            })
            .where(schema.libraryDocuments.id === doc.id);
          
          fixedCount++;
          console.log(`Fixed attachments for document: ${doc.title} (${doc.id})`);
        }
      }
    }
    
    console.log(`Migration completed. Fixed ${fixedCount} documents.`);
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

function getMimetypeFromExtension(extension?: string): string {
  if (!extension) return 'application/octet-stream';
  
  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

// Run the migration if this file is executed directly
if (require.main === module) {
  fixAttachmentsFormat()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { fixAttachmentsFormat };
