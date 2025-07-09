const { documentProcessor } = require('./server/services/document-processor.ts');

async function testDocumentProcessing() {
  try {
    // Test PDF parsing
    const pdfParse = require('pdf-parse');
    console.log('PDF parser loaded successfully:', typeof pdfParse);
    
    // Test DOCX parsing
    const mammoth = require('mammoth');
    console.log('Mammoth loaded successfully:', typeof mammoth);
    
    console.log('All document processing libraries loaded successfully!');
  } catch (error) {
    console.error('Error loading libraries:', error);
  }
}

testDocumentProcessing();