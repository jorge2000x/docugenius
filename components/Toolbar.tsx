
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  Type, Download, FileUp, Save, Highlighter, Settings, Scissors, ArrowUpDown,
  Image as ImageIcon, Table as TableIcon, ZoomIn, ZoomOut, Undo, Redo
} from 'lucide-react';
import { COLORS, FONTS, FONT_SIZES } from '../constants';

interface ToolbarProps {
  onFormat: (command: string, value?: string) => void;
  onExportPdf: () => void;
  onSaveOdt: () => void;
  onImportOdt: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenPageSettings: () => void;
  onInsertImage: (file: File) => void;
  onInsertTable: (rows: number, cols: number) => void;
  zoom: number;
  setZoom: (z: number) => void;
  
  // State props
  currentFont?: string;
  currentSize?: string;
  currentLineHeight?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  alignment?: string; // 'left' | 'center' | 'right' | 'justify'
  foreColor?: string;
  hiliteColor?: string;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onFormat, 
  onExportPdf, 
  onSaveOdt,
  onImportOdt,
  onOpenPageSettings,
  onInsertImage,
  onInsertTable,
  zoom,
  setZoom,
  currentFont,
  currentSize,
  currentLineHeight,
  isBold,
  isItalic,
  isUnderline,
  alignment,
  foreColor,
  hiliteColor
}) => {
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableDims, setTableDims] = useState({ rows: 3, cols: 3 });
  const tablePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tablePickerRef.current && !tablePickerRef.current.contains(event.target as Node)) {
        setShowTablePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onImportOdt(e);
    e.target.value = ''; // Reset input
  }, [onImportOdt]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onInsertImage(e.target.files[0]);
          e.target.value = '';
      }
  };

  const handleAction = (e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault();
    onFormat(command, value);
  };

  const handleInsertPageBreak = (e: React.MouseEvent) => {
    e.preventDefault();
    const breakHtml = '<div class="page-break" contenteditable="false"></div><p><br/></p>';
    document.execCommand('insertHTML', false, breakHtml);
  };

  const ButtonBase = "p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors disabled:opacity-50 active:scale-95 flex flex-col items-center justify-center min-w-[34px] min-h-[34px]";
  const ActiveStyle = "bg-blue-100 text-blue-700 hover:bg-blue-200";
  const getButtonStyle = (isActive: boolean) => `${ButtonBase} ${isActive ? ActiveStyle : ''}`;
  const SelectBase = "border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-900 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer";

  // Helpers
  const fontValue = currentFont || FONTS[0].value;
  const sizeValue = currentSize || '16px';
  const lineHeightValue = currentLineHeight || '1.0';
  const isCustomFont = !FONTS.some(f => f.value === fontValue);
  const isCustomSize = !FONT_SIZES.some(s => s.value === sizeValue);
  const LINE_HEIGHTS = ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'];

  return (
    <div className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm px-4 py-2 flex items-center justify-between gap-2 flex-wrap select-none h-auto">
      
      {/* File Operations */}
      <div className="flex items-center gap-1 border-r pr-2 border-gray-300">
        <label className={`${ButtonBase} cursor-pointer flex-row gap-1 group relative`} title="Open .DOCX">
          <input type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
          <FileUp size={18} />
        </label>
        
        <button onMouseDown={(e) => { e.preventDefault(); onSaveOdt(); }} className={ButtonBase} title="Save as .DOCX">
          <Save size={18} />
        </button>
        
        <button onMouseDown={(e) => { e.preventDefault(); onExportPdf(); }} className={ButtonBase} title="Export to PDF">
          <Download size={18} />
        </button>

        <button onMouseDown={(e) => { e.preventDefault(); onOpenPageSettings(); }} className={ButtonBase} title="Page Setup">
            <Settings size={18} />
        </button>
      </div>

      {/* History */}
      <div className="flex items-center gap-1 border-r pr-2 border-gray-300">
        <button onMouseDown={(e) => handleAction(e, 'undo')} className={ButtonBase} title="Undo">
            <Undo size={18} />
        </button>
        <button onMouseDown={(e) => handleAction(e, 'redo')} className={ButtonBase} title="Redo">
            <Redo size={18} />
        </button>
      </div>

      {/* Insert Objects */}
      <div className="flex items-center gap-1 border-r pr-2 border-gray-300 relative">
          <label className={`${ButtonBase} cursor-pointer`} title="Insert Image">
             <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
             <ImageIcon size={18} />
          </label>
          
          <div className="relative" ref={tablePickerRef}>
            <button 
                onMouseDown={(e) => { e.preventDefault(); setShowTablePicker(!showTablePicker); }} 
                className={`${ButtonBase} ${showTablePicker ? 'bg-gray-100' : ''}`} 
                title="Insert Table"
            >
                <TableIcon size={18} />
            </button>
            {showTablePicker && (
                <div className="absolute top-full left-0 mt-2 bg-white border shadow-xl rounded p-3 z-50 w-48 animate-fade-in">
                    <div className="mb-2 text-xs font-semibold text-gray-500">Table Size</div>
                    <div className="flex items-center gap-2 mb-3">
                        <input 
                            type="number" min="1" max="20" 
                            className="w-12 border rounded px-1" 
                            value={tableDims.cols} 
                            onChange={(e) => setTableDims(p => ({...p, cols: parseInt(e.target.value) || 1}))}
                        />
                        <span className="text-gray-400">x</span>
                        <input 
                            type="number" min="1" max="20" 
                            className="w-12 border rounded px-1" 
                            value={tableDims.rows} 
                            onChange={(e) => setTableDims(p => ({...p, rows: parseInt(e.target.value) || 1}))}
                        />
                    </div>
                    <button 
                        className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onInsertTable(tableDims.rows, tableDims.cols);
                            setShowTablePicker(false);
                        }}
                    >
                        Insert Table
                    </button>
                </div>
            )}
          </div>
      </div>

      {/* Formatting */}
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        <select 
          className={`${SelectBase} w-32`} 
          onChange={(e) => onFormat('fontName', e.target.value)}
          value={fontValue}
          title="Font Family"
        >
          {isCustomFont && <option value={fontValue} className="text-gray-900 bg-white">{fontValue.split(',')[0].replace(/['"]/g, '')}</option>}
          {FONTS.map(f => <option key={f.name} value={f.value} className="text-gray-900 bg-white">{f.name}</option>)}
        </select>

        <select 
          className={`${SelectBase} w-20`}
          onChange={(e) => onFormat('fontSize', e.target.value)}
          value={sizeValue} 
          title="Font Size"
        >
          {isCustomSize && <option value={sizeValue} className="text-gray-900 bg-white">{sizeValue}</option>}
          {FONT_SIZES.map(s => <option key={s.value} value={s.value} className="text-gray-900 bg-white">{s.label}</option>)}
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <div className="flex bg-gray-50 rounded border border-gray-200 p-0.5">
          <button onMouseDown={(e) => handleAction(e, 'bold')} className={getButtonStyle(!!isBold)} title="Bold">
            <Bold size={16} />
          </button>
          <button onMouseDown={(e) => handleAction(e, 'italic')} className={getButtonStyle(!!isItalic)} title="Italic">
            <Italic size={16} />
          </button>
          <button onMouseDown={(e) => handleAction(e, 'underline')} className={getButtonStyle(!!isUnderline)} title="Underline">
            <Underline size={16} />
          </button>
        </div>
        
        {/* Colors (Text & Highlight) */}
        <div className="relative group">
           <button className={`${ButtonBase}`} title="Text Color" onMouseDown={(e) => e.preventDefault()}>
              <Type size={18} className="text-gray-700" />
              <div className="h-1 w-full mt-0.5 rounded-full border border-gray-200" style={{ background: foreColor }}></div>
           </button>
           <div className="absolute top-full left-0 mt-1 p-2 bg-white border rounded shadow-xl hidden group-hover:grid grid-cols-5 gap-1 w-40 z-50">
             {COLORS.map(c => (
               <button 
                 key={`text-${c}`}
                 className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform shadow-sm"
                 style={{ backgroundColor: c }}
                 onMouseDown={(e) => handleAction(e, 'foreColor', c)}
               />
             ))}
           </div>
        </div>

         <div className="relative group">
           <button className={`${ButtonBase}`} title="Highlight" onMouseDown={(e) => e.preventDefault()}>
              <Highlighter size={18} />
              <div className="h-1 w-full mt-0.5 rounded-full border border-gray-200" style={{ backgroundColor: hiliteColor === 'transparent' ? '#f3f4f6' : hiliteColor }}></div>
           </button>
           <div className="absolute top-full left-0 mt-1 p-2 bg-white border rounded shadow-xl hidden group-hover:grid grid-cols-4 gap-1 w-32 z-50">
            <button className="col-span-4 text-xs text-center border mb-1 rounded hover:bg-gray-100 py-1" onMouseDown={(e) => handleAction(e, 'hiliteColor', 'transparent')}>None</button>
             {['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF'].map(c => (
               <button key={`bg-${c}`} className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} onMouseDown={(e) => handleAction(e, 'hiliteColor', c)} />
             ))}
           </div>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Alignment & Spacing */}
        <div className="flex bg-gray-50 rounded border border-gray-200 p-0.5">
          <button onMouseDown={(e) => handleAction(e, 'justifyLeft')} className={getButtonStyle(alignment === 'left')} title="Align Left"><AlignLeft size={16} /></button>
          <button onMouseDown={(e) => handleAction(e, 'justifyCenter')} className={getButtonStyle(alignment === 'center')} title="Align Center"><AlignCenter size={16} /></button>
          <button onMouseDown={(e) => handleAction(e, 'justifyRight')} className={getButtonStyle(alignment === 'right')} title="Align Right"><AlignRight size={16} /></button>
        </div>
        
        <div className="relative group">
           <button className={`${ButtonBase} w-10`} title="Line Spacing" onMouseDown={(e) => e.preventDefault()}>
              <ArrowUpDown size={16} />
              <span className="text-[10px] leading-none mt-0.5 font-bold">{lineHeightValue}</span>
           </button>
           <div className="absolute top-full left-0 mt-1 p-1 bg-white border rounded shadow-xl hidden group-hover:block w-20 z-50">
             {LINE_HEIGHTS.map(h => (
               <button key={`lh-${h}`} className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded`} onMouseDown={(e) => handleAction(e, 'lineHeight', h)}>{h}</button>
             ))}
           </div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 border-l pl-2 border-gray-300 ml-auto">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className={ButtonBase} title="Zoom Out"><ZoomOut size={16} /></button>
          <span className="text-xs w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className={ButtonBase} title="Zoom In"><ZoomIn size={16} /></button>
      </div>
    </div>
  );
};

export default Toolbar;
