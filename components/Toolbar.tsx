
import React, { useRef, useState, useEffect } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  Type, Download, FileUp, Save, Highlighter, Settings, ArrowUpDown,
  Image as ImageIcon, Table as TableIcon, ZoomIn, ZoomOut, Undo, Redo, Hash, ChevronDown
} from 'lucide-react';
import { COLORS, FONTS, FONT_SIZES } from '../constants';

// --- Sub-Components ---

const ToolbarButton: React.FC<{
    icon: React.ReactNode;
    isActive?: boolean;
    onClick: (e: React.MouseEvent) => void;
    title: string;
    children?: React.ReactNode;
    className?: string;
}> = ({ icon, isActive, onClick, title, children, className }) => (
    <button 
        onMouseDown={(e) => { e.preventDefault(); onClick(e); }}
        className={`p-1.5 rounded flex items-center justify-center min-w-[32px] min-h-[32px] transition-colors
        ${isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'} 
        ${className || ''}`}
        title={title}
    >
        {icon}
        {children}
    </button>
);

const ToolbarSelect: React.FC<{
    value: string;
    options: { label?: string; name?: string; value: string }[];
    onChange: (val: string) => void;
    width?: string;
    title: string;
}> = ({ value, options, onChange, width = "w-32", title }) => (
    <div className={`relative ${width} h-8`}>
        <select 
            className="w-full h-full appearance-none bg-white border border-gray-300 hover:border-blue-400 rounded px-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            onChange={(e) => onChange(e.target.value)}
            value={value}
            title={title}
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                    {opt.label || opt.name || opt.value}
                </option>
            ))}
        </select>
        <div className="absolute right-2 top-2.5 pointer-events-none text-gray-500">
            <ChevronDown size={12} />
        </div>
    </div>
);

const ColorPicker: React.FC<{
    icon: React.ReactNode;
    color: string;
    onChange: (c: string) => void;
    palette: string[];
    title: string;
    isHighlight?: boolean;
}> = ({ icon, color, onChange, palette, title, isHighlight }) => {
    return (
        <div className="relative group">
            <button className="p-1.5 rounded hover:bg-gray-100 flex flex-col items-center justify-center min-w-[32px] min-h-[32px]" title={title} onMouseDown={e => e.preventDefault()}>
                {icon}
                <div 
                    className="h-1 w-full mt-0.5 rounded-full border border-gray-200" 
                    style={{ backgroundColor: color === 'transparent' ? '#f3f4f6' : color }}
                />
            </button>
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border rounded shadow-xl hidden group-hover:grid grid-cols-5 gap-1 w-40 z-50">
                {isHighlight && (
                    <button className="col-span-5 text-xs text-center border mb-1 rounded hover:bg-gray-100 py-1 text-gray-800" onMouseDown={(e) => { e.preventDefault(); onChange('transparent'); }}>None</button>
                )}
                {palette.map(c => (
                    <button 
                        key={c}
                        className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform shadow-sm"
                        style={{ backgroundColor: c }}
                        onMouseDown={(e) => { e.preventDefault(); onChange(c); }}
                    />
                ))}
            </div>
        </div>
    );
};

// --- Main Toolbar ---

interface ToolbarProps {
  onFormat: (command: string, value?: string) => void;
  onExportPdf: () => void;
  onSaveDocx: () => void;
  onImportDocx: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenPageSettings: () => void;
  onInsertImage: (file: File) => void;
  onInsertTable: (rows: number, cols: number) => void;
  onInsertPageNumber: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  
  // Style State
  currentFont?: string;
  currentSize?: string;
  currentLineHeight?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  alignment?: string;
  foreColor?: string;
  hiliteColor?: string;
}

const Toolbar: React.FC<ToolbarProps> = (props) => {
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          props.onInsertImage(e.target.files[0]);
          e.target.value = '';
      }
  };

  const fonts = props.currentFont && !FONTS.some(f => f.value === props.currentFont) 
    ? [{ name: props.currentFont.split(',')[0].replace(/['"]/g, ''), value: props.currentFont }, ...FONTS] 
    : FONTS;

  const sizes = props.currentSize && !FONT_SIZES.some(s => s.value === props.currentSize)
    ? [{ label: props.currentSize, value: props.currentSize }, ...FONT_SIZES]
    : FONT_SIZES;

  return (
    <div className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm px-4 py-2 flex items-center gap-2 flex-wrap select-none h-auto">
      
      {/* File Operations */}
      <div className="flex items-center gap-0.5 border-r pr-2 border-gray-300">
        <label className="p-1.5 rounded hover:bg-gray-100 cursor-pointer text-gray-700" title="Open .DOCX">
          <input type="file" accept=".docx" className="hidden" onChange={props.onImportDocx} />
          <FileUp size={18} />
        </label>
        <ToolbarButton icon={<Save size={18} />} onClick={props.onSaveDocx} title="Save .DOCX" />
        <ToolbarButton icon={<Download size={18} />} onClick={props.onExportPdf} title="Export PDF" />
        <ToolbarButton icon={<Settings size={18} />} onClick={props.onOpenPageSettings} title="Page Setup" />
      </div>

      {/* History */}
      <div className="flex items-center gap-0.5 border-r pr-2 border-gray-300">
         <ToolbarButton icon={<Undo size={18} />} onClick={() => props.onFormat('undo')} title="Undo" />
         <ToolbarButton icon={<Redo size={18} />} onClick={() => props.onFormat('redo')} title="Redo" />
      </div>

      {/* Insert */}
      <div className="flex items-center gap-0.5 border-r pr-2 border-gray-300 relative">
        <label className="p-1.5 rounded hover:bg-gray-100 cursor-pointer text-gray-700" title="Insert Image">
             <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
             <ImageIcon size={18} />
        </label>
        
        <div className="relative" ref={tablePickerRef}>
            <ToolbarButton icon={<TableIcon size={18} />} onClick={() => setShowTablePicker(!showTablePicker)} title="Insert Table" isActive={showTablePicker} />
            {showTablePicker && (
                <div className="absolute top-full left-0 mt-2 bg-white border shadow-xl rounded p-3 z-50 w-48 text-gray-900 animate-fade-in">
                    <div className="mb-2 text-xs font-semibold text-gray-500">Table Size</div>
                    <div className="flex items-center gap-2 mb-3">
                        <input type="number" min="1" max="20" className="w-12 border rounded px-1" value={tableDims.cols} onChange={(e) => setTableDims(p => ({...p, cols: parseInt(e.target.value) || 1}))} />
                        <span className="text-gray-400">x</span>
                        <input type="number" min="1" max="20" className="w-12 border rounded px-1" value={tableDims.rows} onChange={(e) => setTableDims(p => ({...p, rows: parseInt(e.target.value) || 1}))} />
                    </div>
                    <button className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700" onMouseDown={(e) => { e.preventDefault(); props.onInsertTable(tableDims.rows, tableDims.cols); setShowTablePicker(false); }}>Insert</button>
                </div>
            )}
        </div>

        <ToolbarButton icon={<Hash size={18} />} onClick={props.onInsertPageNumber} title="Insert Page Number" />
      </div>

      {/* Typography */}
      <div className="flex items-center gap-1.5 flex-1 flex-wrap">
        <ToolbarSelect title="Font Family" options={fonts} value={props.currentFont || 'Inter, sans-serif'} onChange={(v) => props.onFormat('fontName', v)} width="w-36" />
        <ToolbarSelect title="Font Size" options={sizes} value={props.currentSize || '16px'} onChange={(v) => props.onFormat('fontSize', v)} width="w-20" />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <div className="flex bg-gray-50 rounded border border-gray-200 p-0.5 gap-0.5">
           <ToolbarButton icon={<Bold size={16} />} onClick={() => props.onFormat('bold')} isActive={props.isBold} title="Bold" />
           <ToolbarButton icon={<Italic size={16} />} onClick={() => props.onFormat('italic')} isActive={props.isItalic} title="Italic" />
           <ToolbarButton icon={<Underline size={16} />} onClick={() => props.onFormat('underline')} isActive={props.isUnderline} title="Underline" />
        </div>

        <ColorPicker 
            icon={<Type size={18} className="text-gray-700" />} 
            color={props.foreColor || '#000000'} 
            onChange={(c) => props.onFormat('foreColor', c)} 
            palette={COLORS} 
            title="Text Color"
        />
        
        <ColorPicker 
            icon={<Highlighter size={18} className="text-gray-700" />} 
            color={props.hiliteColor || 'transparent'} 
            onChange={(c) => props.onFormat('hiliteColor', c)} 
            palette={['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FFA500']} 
            title="Highlight Color"
            isHighlight
        />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Alignment */}
        <div className="flex bg-gray-50 rounded border border-gray-200 p-0.5 gap-0.5">
           <ToolbarButton icon={<AlignLeft size={16} />} onClick={() => props.onFormat('justifyLeft')} isActive={props.alignment === 'left'} title="Left" />
           <ToolbarButton icon={<AlignCenter size={16} />} onClick={() => props.onFormat('justifyCenter')} isActive={props.alignment === 'center'} title="Center" />
           <ToolbarButton icon={<AlignRight size={16} />} onClick={() => props.onFormat('justifyRight')} isActive={props.alignment === 'right'} title="Right" />
           <ToolbarButton icon={<AlignJustify size={16} />} onClick={() => props.onFormat('justifyFull')} isActive={props.alignment === 'justify'} title="Justify" />
        </div>

        {/* Line Height */}
         <div className="relative group">
           <button className="p-1.5 rounded hover:bg-gray-100 flex items-center gap-1 min-h-[32px]" title="Line Spacing" onMouseDown={(e) => e.preventDefault()}>
              <ArrowUpDown size={16} className="text-gray-700" />
              <span className="text-[10px] font-bold text-gray-700">{props.currentLineHeight || '1.0'}</span>
           </button>
           <div className="absolute top-full left-0 mt-1 p-1 bg-white border rounded shadow-xl hidden group-hover:block w-20 z-50">
             {['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'].map(h => (
               <button key={h} className="w-full text-left px-2 py-1 text-xs text-gray-900 hover:bg-gray-100 rounded" onMouseDown={(e) => { e.preventDefault(); props.onFormat('lineHeight', h); }}>{h}</button>
             ))}
           </div>
        </div>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1 border-l pl-2 border-gray-300 ml-auto">
          <ToolbarButton icon={<ZoomOut size={16} />} onClick={() => props.setZoom(Math.max(0.5, props.zoom - 0.1))} title="Zoom Out" />
          <span className="text-xs w-8 text-center text-gray-700">{Math.round(props.zoom * 100)}%</span>
          <ToolbarButton icon={<ZoomIn size={16} />} onClick={() => props.setZoom(Math.min(2.0, props.zoom + 0.1))} title="Zoom In" />
      </div>
    </div>
  );
};

export default Toolbar;
