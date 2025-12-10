
import html2pdf from 'html2pdf.js';

export const exportToPdf = async (elementId: string, filename: string = 'document.pdf') => {
  // In the new multi-page architecture, 'elementId' might point to a container holding multiple pages.
  // We need to ensure we capture them.
  // Since we are using html2pdf, it can generate pages automatically if we feed it a long element,
  // OR we can rely on its page-break detection.
  
  // However, since we are now rendering explicit pages visually (white boxes on gray bg),
  // simply printing the container might print the gray background and shadows, which is bad.
  
  // To fix this, we will temporarily apply a 'print-mode' class or clone the content.
  // A simple hack for MVP is to select all .prose-editor (the white pages) and print them.
  
  // Actually, html2pdf respects CSS @media print.
  // Our CSS in index.html hides everything but the editor.
  // We need to make sure the "pages" look continuous or page-break properly in PDF.
  
  // Best approach for this setup:
  // Iterate through all `.prose-editor` elements and append them to a temporary container
  // that mimics a clean document flow, then print that.
  
  const pages = document.querySelectorAll('.prose-editor');
  if (!pages.length) return;

  const printContainer = document.createElement('div');
  printContainer.style.width = '210mm';
  printContainer.style.background = 'white';
  
  pages.forEach(page => {
      const clone = page.cloneNode(true) as HTMLElement;
      // Remove shadows and fixed heights if we want natural flow, 
      // BUT we want to keep the exact layout user sees.
      clone.style.boxShadow = 'none';
      clone.style.margin = '0';
      clone.style.pageBreakAfter = 'always';
      clone.style.height = '297mm'; // Maintain the fixed height for exact fidelity
      clone.style.overflow = 'hidden';
      printContainer.appendChild(clone);
  });

  const opt = {
    margin: 0, // We have internal margins in the pages
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(printContainer).save();
  } catch (error) {
    console.error("PDF Export failed:", error);
    throw error;
  }
};
