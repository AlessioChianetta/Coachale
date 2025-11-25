import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export interface CertificateData {
  clientName: string;
  courseTitle: string;
  periodType: 'trimester' | 'year';
  issueDate: Date;
  averageGrade: number | null;
  consultantName?: string;
}

export async function generateCertificatePDF(certificateData: CertificateData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Ensure certificates directory exists
      const certificatesDir = path.join(process.cwd(), 'uploads', 'certificates');
      if (!fs.existsSync(certificatesDir)) {
        fs.mkdirSync(certificatesDir, { recursive: true });
      }

      // Generate unique filename
      const filename = `certificate_${nanoid()}.pdf`;
      const filepath = path.join(certificatesDir, filename);
      const relativePath = `/uploads/certificates/${filename}`;

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Attestato - ${certificateData.clientName}`,
          Author: 'Sistema Universitario',
          Subject: 'Attestato di Completamento',
        }
      });

      // Pipe to file
      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // Add decorative border
      doc.lineWidth(3);
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke('#1a56db');

      doc.lineWidth(1);
      doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).stroke('#93c5fd');

      // Add header
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor('#1a56db')
         .text('ATTESTATO DI COMPLETAMENTO', 60, 100, {
           align: 'center',
           width: doc.page.width - 120
         });

      // Add decorative line
      doc.moveTo(150, 150)
         .lineTo(doc.page.width - 150, 150)
         .lineWidth(2)
         .strokeColor('#93c5fd')
         .stroke();

      // Add "Si certifica che" text
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#374151')
         .text('Si certifica che', 60, 190, {
           align: 'center',
           width: doc.page.width - 120
         });

      // Add client name (prominent)
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .fillColor('#1a56db')
         .text(certificateData.clientName, 60, 230, {
           align: 'center',
           width: doc.page.width - 120
         });

      // Add completion text
      const periodText = certificateData.periodType === 'year' ? 'anno' : 'trimestre';
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#374151')
         .text(`ha completato con successo il ${periodText}`, 60, 280, {
           align: 'center',
           width: doc.page.width - 120
         });

      // Add course title (prominent)
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#1f2937')
         .text(certificateData.courseTitle, 60, 320, {
           align: 'center',
           width: doc.page.width - 120
         });

      // Add grade if available
      if (certificateData.averageGrade !== null) {
        doc.fontSize(14)
           .font('Helvetica')
           .fillColor('#374151')
           .text('con una media di', 60, 370, {
             align: 'center',
             width: doc.page.width - 120
           });

        doc.fontSize(36)
           .font('Helvetica-Bold')
           .fillColor('#10b981')
           .text(`${certificateData.averageGrade}/10`, 60, 400, {
             align: 'center',
             width: doc.page.width - 120
           });
      }

      // Add issue date
      const issueDateStr = certificateData.issueDate.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const yPosition = certificateData.averageGrade !== null ? 480 : 400;
      
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#6b7280')
         .text(`Rilasciato il ${issueDateStr}`, 60, yPosition, {
           align: 'center',
           width: doc.page.width - 120
         });

      // Add consultant signature area if consultant name is provided
      if (certificateData.consultantName) {
        const signatureY = yPosition + 80;
        
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#374151')
           .text('Il Consulente', 60, signatureY, {
             align: 'center',
             width: doc.page.width - 120
           });

        // Signature line
        doc.moveTo(doc.page.width / 2 - 80, signatureY + 50)
           .lineTo(doc.page.width / 2 + 80, signatureY + 50)
           .lineWidth(1)
           .strokeColor('#9ca3af')
           .stroke();

        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#1f2937')
           .text(certificateData.consultantName, 60, signatureY + 60, {
             align: 'center',
             width: doc.page.width - 120
           });
      }

      // Add footer with decorative elements
      const footerY = doc.page.height - 100;
      
      doc.fontSize(10)
         .font('Helvetica-Oblique')
         .fillColor('#9ca3af')
         .text('Questo documento certifica il completamento del percorso formativo', 60, footerY, {
           align: 'center',
           width: doc.page.width - 120
         });

      // Add decorative corner elements
      const cornerSize = 20;
      
      // Top-left corner
      doc.moveTo(50, 50 + cornerSize).lineTo(50, 50).lineTo(50 + cornerSize, 50)
         .lineWidth(2).strokeColor('#1a56db').stroke();
      
      // Top-right corner  
      doc.moveTo(doc.page.width - 50 - cornerSize, 50).lineTo(doc.page.width - 50, 50).lineTo(doc.page.width - 50, 50 + cornerSize)
         .lineWidth(2).strokeColor('#1a56db').stroke();
      
      // Bottom-left corner
      doc.moveTo(50, doc.page.height - 50 - cornerSize).lineTo(50, doc.page.height - 50).lineTo(50 + cornerSize, doc.page.height - 50)
         .lineWidth(2).strokeColor('#1a56db').stroke();
      
      // Bottom-right corner
      doc.moveTo(doc.page.width - 50 - cornerSize, doc.page.height - 50).lineTo(doc.page.width - 50, doc.page.height - 50).lineTo(doc.page.width - 50, doc.page.height - 50 - cornerSize)
         .lineWidth(2).strokeColor('#1a56db').stroke();

      // Finalize PDF
      doc.end();

      // Wait for file to be written
      writeStream.on('finish', () => {
        resolve(relativePath);
      });

      writeStream.on('error', (error) => {
        reject(new Error(`Failed to write PDF: ${error.message}`));
      });

    } catch (error: any) {
      reject(new Error(`Failed to generate PDF: ${error.message}`));
    }
  });
}
