
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import { parseDocxFile, saveToDocx } from './services/docxService';
import { exportToPdf } from './services/pdfService';
import { DEFAULT_CONTENT, FONTS, FONT_SIZES } from './constants';
import { PageSettings } from './types';
import { X } from 'lucide-react';

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
    footerText: "Footer content..."
  });

  const [currentStyle, setCurrentStyle] = useState({
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
  
  const updateCurrentStyles = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');
    
    let alignment = 'left';
    if (document.queryCommandState('justifyCenter')) alignment = 'center';
    else if (document.queryCommandState('justifyRight')) alignment = 'right';
    else if (document.queryCommandState('justifyFull')) alignment = 'justify';

    let node = selection.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    
    let fontName = 'Inter, sans-serif';
    let fontSize = '16px';
    let lineHeight = '1.0';
    let foreColor = '#000000';
    let hiliteColor = 'transparent';

    if (node && node instanceof Element) {
      const computed = window.getComputedStyle(node);
      const primaryComputed = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
      const matchedFont = FONTS.find(f => f.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase() === primaryComputed);
      fontName = matchedFont ? matchedFont.value : computed.fontFamily;

      let sizeVal = computed.fontSize;
      if (sizeVal && sizeVal.endsWith('px')) {
          const num = parseFloat(sizeVal);
          if (!isNaN(num)) sizeVal = Math.round(num) + 'px';
      }
      fontSize = sizeVal || '16px';

      let lh = computed.lineHeight;
      if (lh === 'normal') lineHeight = '1.0';
      else if (lh.endsWith('px')) {
          const lhNum = parseFloat(lh);
          const fsNum = parseFloat(sizeVal);
          if (fsNum > 0) lineHeight = (Math.round((lhNum / fsNum) * 20) / 20).toFixed(2).replace(/[.,]00$/, '');
      } else if (!isNaN(parseFloat(lh))) lineHeight = parseFloat(lh).toString();
      
      const rgbToHex = (col: string) => {
          if (!col || col === 'rgba(0, 0, 0, 0)') return null;
          if (col.startsWith('#')) return col.toUpperCase();
          const digits = col.match(/\d+/g);
          if (!digits || digits.length < 3) return null;
          if (digits.length > 3 && (digits[3] === '0')) return null;
          return "#" + ((1 << 24) + (parseInt(digits[0]) << 16) + (parseInt(digits[1]) << 8) + (parseInt(digits[2]))).toString(16).slice(1).toUpperCase();
      };
      foreColor = rgbToHex(computed.color) || '#000000';
      hiliteColor = rgbToHex(computed.backgroundColor) || 'transparent';
    }

    setCurrentStyle({ fontName, fontSize, lineHeight, isBold, isItalic, isUnderline, alignment, foreColor, hiliteColor });
  }, []);

  const handleFormat = (command: string, value?: string) => {
    if (command === 'lineHeight' && value) {
        // Line height logic block
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType === 3 && container.parentElement) container = container.parentElement;
        let block = container as HTMLElement;
        while (block && block.tagName !== 'DIV' && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(block.tagName)) {
            if (!block.parentElement) break;
            block = block.parentElement;
        }
        if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(block.tagName)) block.style.lineHeight = value;
        else { document.execCommand('formatBlock', false, 'p'); const newBlock = document.getSelection()?.anchorNode?.parentElement?.closest('p'); if(newBlock) newBlock.style.lineHeight = value; }
        setTimeout(updateCurrentStyles, 10);
        return;
    }

    const useCSS = ['foreColor', 'hiliteColor', 'fontName'].includes(command);
    if (useCSS) document.execCommand('styleWithCSS', false, 'true');
    
    if (command === 'fontSize' && value) {
       document.execCommand('styleWithCSS', false, 'true');
       document.execCommand('fontSize', false, '7'); 
       document.execCommand('styleWithCSS', false, 'false');
       const fontElements = document.getElementsByTagName('span');
       Array.from(fontElements).forEach((span) => { if (span.style.fontSize === 'xxx-large') span.style.fontSize = value; });
    } else {
       document.execCommand(command, false, value);
    }
    
    if (useCSS) document.execCommand('styleWithCSS', false, 'false');
    setTimeout(updateCurrentStyles, 10);
  };

  const handleInsertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
            document.execCommand('insertHTML', false, `<img src="${result}" style="max-width: 100%; height: auto;" />`);
        }
    };
    reader.readAsDataURL(file);
  };

  const handleInsertTable = (rows: number, cols: number) => {
    let html = '<table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin: 1em 0;"><tbody>';
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            html += '<td style="border: 1px solid #ccc; padding: 4px;">&nbsp;</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table><p><br/></p>';
    document.execCommand('insertHTML', false, html);
  };

  const handleImportDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { html, settings } = await parseDocxFile(file);
        setContent(html);
        if (settings) setPageSettings(prev => ({ ...prev, ...settings }));
      } catch (err) {
        console.error(err);
        alert("Failed to read DOCX file.");
      }
    }
  };

  const handleSaveDocx = async () => {
      try {
          const blob = await saveToDocx(content, pageSettings);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'document.docx';
          a.click();
          URL.revokeObjectURL(url);
      } catch (err) {
          console.error(err);
          alert("Failed to save DOCX.");
      }
  };

  const handleExportPdf = async () => {
    try { await exportToPdf('editor-container', 'my-document.pdf'); } 
    catch (err) { alert("Failed to export PDF."); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <Toolbar 
        onFormat={handleFormat} 
        onExportPdf={handleExportPdf}
        onSaveOdt={handleSaveDocx}
        onImportOdt={handleImportDocx}
        onOpenPageSettings={() => setShowPageSettings(true)}
        onInsertImage={handleInsertImage}
        onInsertTable={handleInsertTable}
        zoom={zoom}
        setZoom={setZoom}
        
        currentFont={currentStyle.fontName}
        currentSize={currentStyle.fontSize}
        currentLineHeight={currentStyle.lineHeight}
        isBold={currentStyle.isBold}
        isItalic={currentStyle.isItalic}
        isUnderline={currentStyle.isUnderline}
        alignment={currentStyle.alignment}
        foreColor={currentStyle.foreColor}
        hiliteColor={currentStyle.hiliteColor}
      />
      
      <Editor 
        content={content} 
        onContentChange={setContent}
        editorRef={editorRef}
        pageSettings={pageSettings}
        onSelectionChange={updateCurrentStyles}
        zoom={zoom}
        onHeaderFooterChange={(type, html) => {
            setPageSettings(prev => ({
                ...prev,
                [type === 'header' ? 'headerText' : 'footerText']: html
            }));
        }}
      />
      
      <div className="bg-white border-t border-gray-200 px-4 py-1 text-xs text-gray-500 flex justify-between items-center select-none z-50 shadow-inner">
         <span>DocuGenius v4.1</span>
         <span>{content.replace(/<[^>]*>/g, '').length} chars</span>
      </div>

      {showPageSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-xl w-96 p-6 relative animate-fade-in">
                  <button onClick={() => setShowPageSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  <h2 className="text-xl font-bold mb-4">Page Setup</h2>
                  <div className="space-y-4">
                      <div>
                          <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Margins (mm)</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <div><label className="block text-sm text-gray-600 mb-1">Top</label><input type="number" value={pageSettings.marginTop} onChange={(e) => setPageSettings(p => ({...p, marginTop: parseFloat(e.target.value)}))} className="w-full border rounded px-2 py-1"/></div>
                              <div><label className="block text-sm text-gray-600 mb-1">Bottom</label><input type="number" value={pageSettings.marginBottom} onChange={(e) => setPageSettings(p => ({...p, marginBottom: parseFloat(e.target.value)}))} className="w-full border rounded px-2 py-1"/></div>
                              <div><label className="block text-sm text-gray-600 mb-1">Left</label><input type="number" value={pageSettings.marginLeft} onChange={(e) => setPageSettings(p => ({...p, marginLeft: parseFloat(e.target.value)}))} className="w-full border rounded px-2 py-1"/></div>
                              <div><label className="block text-sm text-gray-600 mb-1">Right</label><input type="number" value={pageSettings.marginRight} onChange={(e) => setPageSettings(p => ({...p, marginRight: parseFloat(e.target.value)}))} className="w-full border rounded px-2 py-1"/></div>
                          </div>
                      </div>
                      
                      <div>
                          <h3 className="font-medium text-gray-700 mb-2 border-b pb-1">Layout</h3>
                          <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={pageSettings.hasHeader}
                                    onChange={(e) => setPageSettings(p => ({...p, hasHeader: e.target.checked}))}
                                  />
                                  Enable Header
                              </label>
                              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={pageSettings.hasFooter}
                                    onChange={(e) => setPageSettings(p => ({...p, hasFooter: e.target.checked}))}
                                  />
                                  Enable Footer
                              </label>
                          </div>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                      <button onClick={() => setShowPageSettings(false)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow">Done</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
