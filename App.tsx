
import React, { useState, useRef, useCallback } from 'react';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import PageSetupModal from './components/PageSetupModal';
import { parseDocxFile, saveToDocx } from './services/docxService';
import { exportToPdf } from './services/pdfService';
import { DEFAULT_CONTENT, FONTS } from './constants';
import { PageSettings, EditorStyleState } from './types';

function App() {
  const [content, setContent] = useState<string>(DEFAULT_CONTENT.replace('.odt', '.docx'));
  const [zoom, setZoom] = useState(1.0);
  const [showPageSettings, setShowPageSettings] = useState(false);
  
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
  
  // --- Style Updates from Selection ---
  const updateCurrentStyles = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let node = selection.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    
    if (node instanceof Element) {
      const computed = window.getComputedStyle(node);
      const primaryComputed = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
      const matchedFont = FONTS.find(f => f.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase() === primaryComputed);
      
      setCurrentStyle({
        fontName: matchedFont ? matchedFont.value : computed.fontFamily,
        fontSize: computed.fontSize.replace(/(\d+(\.\d+)?)px/, (m, p1) => Math.round(parseFloat(p1)) + 'px'),
        lineHeight: computed.lineHeight === 'normal' ? '1.0' : computed.lineHeight,
        isBold: document.queryCommandState('bold'),
        isItalic: document.queryCommandState('italic'),
        isUnderline: document.queryCommandState('underline'),
        alignment: document.queryCommandState('justifyCenter') ? 'center' : 
                   document.queryCommandState('justifyRight') ? 'right' : 
                   document.queryCommandState('justifyFull') ? 'justify' : 'left',
        foreColor: computed.color, // Simplified for brevity
        hiliteColor: computed.backgroundColor
      });
    }
  }, []);

  // --- Actions ---
  const handleFormat = (command: string, value?: string) => {
    document.execCommand('styleWithCSS', false, 'true'); // Prefer CSS for colors/fonts
    if (command === 'fontSize' && value) {
        // Pixel-perfect font size hack
        document.execCommand('fontSize', false, '7'); 
        const spans = document.querySelectorAll('span[style*="font-size: xxx-large"], font[size="7"]');
        spans.forEach(el => (el as HTMLElement).style.fontSize = value);
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
        } catch { alert("Error reading file"); }
    }
    if (action === 'save') {
        try {
            const blob = await saveToDocx(content, pageSettings);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'doc.docx';
            a.click();
        } catch { alert("Error saving file"); }
    }
    if (action === 'pdf') {
        await exportToPdf('editor-container', 'doc.pdf');
    }
  };

  const handleInsert = (type: 'image' | 'table' | 'pageNumber', data?: any) => {
      if (type === 'image' && data) {
          const reader = new FileReader();
          reader.onload = (e) => document.execCommand('insertHTML', false, `<img src="${e.target?.result}" />`);
          reader.readAsDataURL(data);
      }
      if (type === 'table') {
          let html = '<table><tbody>';
          for(let r=0; r<data.rows; r++) {
              html += '<tr>' + new Array(data.cols).fill('<td><br></td>').join('') + '</tr>';
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
        onSaveOdt={() => handleFileAction('save')}
        onImportOdt={(e) => handleFileAction('import', e)}
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
      
      <div className="bg-white border-t border-gray-200 px-4 py-1 text-xs text-gray-500 flex justify-between select-none z-50 shadow-inner">
         <span>DocuGenius v5.1</span>
         <span>{content.replace(/<[^>]*>/g, '').length} chars</span>
      </div>

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
