
import React, { useState, useRef, useCallback } from 'react';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import PageSetupModal from './components/PageSetupModal';
import StatusBar from './components/StatusBar';
import { ToastContainer, useToast } from './components/Toast';
import { parseDocxFile, saveToDocx } from './services/docxService';
import { exportToPdf } from './services/pdfService';
import { DEFAULT_CONTENT, FONTS } from './constants';
import { PageSettings, EditorStyleState } from './types';
import { rgbToHex, normalizeFontSize } from './utils';

function App() {
  const [content, setContent] = useState<string>(DEFAULT_CONTENT.replace('.odt', '.docx'));
  const [zoom, setZoom] = useState(1.0);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  
  const [pageSettings, setPageSettings] = useState<PageSettings>({
    marginTop: 25.4,
    marginBottom: 25.4,
    marginLeft: 25.4,
    marginRight: 25.4,
    firstLineIndent: 0,
    hasHeader: true,
    hasFooter: true,
    headerText: "Header content...",
    footerText: '<div style="text-align: center;"><span class="page-number"><span>#</span></span></div>'
  });

  const [currentStyle, setCurrentStyle] = useState<EditorStyleState>({
    fontName: 'Inter, sans-serif',
    fontSize: '16px',
    lineHeight: '1.0',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    alignment: 'left',
    foreColor: '#000000',
    hiliteColor: 'transparent'
  });

  const editorRef = useRef<HTMLDivElement>(null);
  
  // --- Style Detection ---
  const updateCurrentStyles = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node = selection.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    
    if (node instanceof Element) {
      const computed = window.getComputedStyle(node);
      const primaryComputed = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
      const matchedFont = FONTS.find(f => f.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase() === primaryComputed);
      
      const detectedColor = rgbToHex(computed.color) || '#000000';
      const detectedBg = rgbToHex(computed.backgroundColor) || 'transparent';

      setCurrentStyle({
        fontName: matchedFont ? matchedFont.value : computed.fontFamily,
        fontSize: normalizeFontSize(computed.fontSize),
        lineHeight: computed.lineHeight === 'normal' ? '1.0' : computed.lineHeight,
        isBold: document.queryCommandState('bold'),
        isItalic: document.queryCommandState('italic'),
        isUnderline: document.queryCommandState('underline'),
        alignment: document.queryCommandState('justifyCenter') ? 'center' : 
                   document.queryCommandState('justifyRight') ? 'right' : 
                   document.queryCommandState('justifyFull') ? 'justify' : 'left',
        foreColor: detectedColor, 
        hiliteColor: detectedBg
      });
    }
  }, []);

  // --- Actions ---
  const handleFormat = (command: string, value?: string) => {
    // Special handling for Line Height to ensure block application
    if (command === 'lineHeight' && value) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        let container = selection.getRangeAt(0).commonAncestorContainer;
        if (container.nodeType === 3 && container.parentElement) container = container.parentElement;
        
        let block = container as HTMLElement;
        const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV'];
        while (block && !blockTags.includes(block.tagName)) {
            if (!block.parentElement) break;
            block = block.parentElement;
        }

        if (block && blockTags.includes(block.tagName)) {
            block.style.lineHeight = value;
        } else {
            document.execCommand('formatBlock', false, 'p');
            const newBlock = document.getSelection()?.anchorNode?.parentElement?.closest('p');
            if(newBlock) newBlock.style.lineHeight = value;
        }
        setTimeout(updateCurrentStyles, 10);
        return;
    }

    // Standard CSS-based styling
    document.execCommand('styleWithCSS', false, 'true'); 
    
    if (command === 'fontSize' && value) {
        document.execCommand('fontSize', false, '7'); 
        const spans = document.querySelectorAll('span[style*="font-size: xxx-large"], font[size="7"]');
        spans.forEach(el => {
            (el as HTMLElement).style.fontSize = value;
            (el as HTMLElement).removeAttribute('size');
        });
    } else {
        document.execCommand(command, false, value);
    }
    
    document.execCommand('styleWithCSS', false, 'false');
    setTimeout(updateCurrentStyles, 10);
  };

  const handleFileAction = async (action: 'import' | 'save' | 'pdf', e?: React.ChangeEvent<HTMLInputElement>) => {
    if (action === 'import' && e?.target.files?.[0]) {
        try {
            const { html, settings } = await parseDocxFile(e.target.files[0]);
            setContent(html);
            if (settings) setPageSettings(prev => ({ ...prev, ...settings }));
            addToast("Document loaded successfully", 'success');
        } catch { 
            addToast("Failed to read file", 'error'); 
        }
    }
    if (action === 'save') {
        try {
            const blob = await saveToDocx(content, pageSettings);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'document.docx';
            a.click();
            addToast("Document saved", 'success');
        } catch { 
            addToast("Failed to save document", 'error'); 
        }
    }
    if (action === 'pdf') {
        try {
            await exportToPdf('editor-container', 'document.pdf');
            addToast("PDF Exported", 'success');
        } catch {
            addToast("PDF Export failed", 'error');
        }
    }
  };

  const handleInsert = (type: 'image' | 'table' | 'pageNumber', data?: any) => {
      if (type === 'image' && data) {
          const reader = new FileReader();
          reader.onload = (e) => document.execCommand('insertHTML', false, `<img src="${e.target?.result}" style="max-width:100%" />`);
          reader.readAsDataURL(data);
      }
      if (type === 'table') {
          // FIX: Explicitly set color: #000000 to prevent white text bug in dark mode browsers
          const baseStyle = 'border:1px solid #000; padding:4px;';
          let html = `<table style="width:100%; border-collapse:collapse; border:1px solid #000; color: #000000;"><tbody>`;
          for(let r=0; r<data.rows; r++) {
              html += '<tr>' + new Array(data.cols).fill(`<td style="${baseStyle}"><br></td>`).join('') + '</tr>';
          }
          document.execCommand('insertHTML', false, html + '</tbody></table><p><br/></p>');
      }
      if (type === 'pageNumber') document.execCommand('insertHTML', false, '<span class="page-number"><span>#</span></span>');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <Toolbar 
        onFormat={handleFormat} 
        onExportPdf={() => handleFileAction('pdf')}
        onSaveDocx={() => handleFileAction('save')}
        onImportDocx={(e) => handleFileAction('import', e)}
        onOpenPageSettings={() => setShowPageSettings(true)}
        onInsertImage={(f) => handleInsert('image', f)}
        onInsertTable={(r, c) => handleInsert('table', {rows: r, cols: c})}
        onInsertPageNumber={() => handleInsert('pageNumber')}
        zoom={zoom}
        setZoom={setZoom}
        {...currentStyle}
      />
      
      <Editor 
        content={content} 
        onContentChange={setContent}
        editorRef={editorRef}
        pageSettings={pageSettings}
        onSelectionChange={updateCurrentStyles}
        zoom={zoom}
        onHeaderFooterChange={(type, html) => {
            setPageSettings(prev => ({ ...prev, [type === 'header' ? 'headerText' : 'footerText']: html }));
        }}
      />
      
      <StatusBar content={content} version="DocuGenius v5.3" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {showPageSettings && (
          <PageSetupModal 
            settings={pageSettings} 
            onUpdate={setPageSettings} 
            onClose={() => setShowPageSettings(false)} 
          />
      )}
    </div>
  );
}

export default App;
