
import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { PageSettings } from '../types';

interface EditorProps {
  content: string;
  onContentChange: (html: string) => void;
  editorRef: React.RefObject<HTMLDivElement>;
  pageSettings: PageSettings;
  onSelectionChange: () => void;
  zoom: number;
  onHeaderFooterChange: (type: 'header' | 'footer', html: string) => void;
}

const Editor: React.FC<EditorProps> = ({ 
  content, 
  onContentChange, 
  pageSettings,
  onSelectionChange,
  zoom,
  onHeaderFooterChange
}) => {
  const [pageCount, setPageCount] = useState(1);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const lastEmitRef = useRef<string>(content);
  const rafRef = useRef<number | null>(null);

  // Initialize
  useEffect(() => {
    if (content !== lastEmitRef.current) {
        setPageCount(1);
        setTimeout(() => {
            const firstPage = pagesContainerRef.current?.querySelector('.page-content');
            if (firstPage) firstPage.innerHTML = content || '<p><br/></p>';
            balancePages();
        }, 0);
    }
  }, [content]);

  const balancePages = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
        if (!pagesContainerRef.current) return;
        const pages = Array.from(pagesContainerRef.current.querySelectorAll('.page-content')) as HTMLElement[];
        let didChange = false;

        // Forward Pass: Push overflow to next page
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            while (page.scrollHeight > page.clientHeight + 1) {
                let nextPage = pages[i + 1];
                if (!nextPage) {
                    setPageCount(c => c + 1); // Trigger render of new page
                    return; // Stop current pass, effect will re-run
                }
                const last = page.lastChild;
                if (last) {
                    nextPage.insertBefore(last, nextPage.firstChild);
                    didChange = true;
                } else break;
            }
        }

        // Backward Pass: Pull content back if space exists
        for (let i = 0; i < pages.length - 1; i++) {
            const page = pages[i];
            let nextPage = pages[i + 1];
            while (nextPage && nextPage.firstChild) {
                const node = nextPage.firstChild;
                page.appendChild(node);
                if (page.scrollHeight > page.clientHeight + 1) {
                    nextPage.insertBefore(node, nextPage.firstChild); // Put it back
                    break;
                }
                didChange = true;
            }
        }

        // Remove empty pages at end
        if (pages.length > 1) {
             const last = pages[pages.length - 1];
             if (!last.hasChildNodes() || (last.childNodes.length === 1 && last.innerHTML === '<br>')) {
                 setPageCount(c => c - 1);
                 return;
             }
        }

        if (didChange) {
            const fullHtml = pages.map(p => p.innerHTML).join('');
            if (fullHtml !== lastEmitRef.current) {
                lastEmitRef.current = fullHtml;
                onContentChange(fullHtml);
            }
        }
    });
  }, [pageCount, onContentChange]);

  useLayoutEffect(() => { balancePages(); });

  const contentStyle: React.CSSProperties = {
      paddingTop: `${pageSettings.marginTop}mm`,
      paddingBottom: `${pageSettings.marginBottom}mm`,
      paddingLeft: `${pageSettings.marginLeft}mm`,
      paddingRight: `${pageSettings.marginRight}mm`,
      height: '100%',
      boxSizing: 'border-box',
      display: 'block',
      overflow: 'hidden',
  };

  return (
    <div 
        className="flex-1 w-full bg-gray-200 overflow-y-auto flex flex-col items-center py-8"
        onClick={(e) => {
            if (e.target === e.currentTarget) {
                const pages = pagesContainerRef.current?.querySelectorAll('.page-content');
                (pages?.[pages.length - 1] as HTMLElement)?.focus();
            }
        }}
    >
      <div 
        ref={pagesContainerRef} 
        id="editor-container"
        className="editor-pages-container flex flex-col gap-8 pb-20 origin-top"
        style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s ease-out' }}
      >
          {Array.from({ length: pageCount }).map((_, index) => (
              <div 
                key={index} 
                className="editor-page-node bg-white shadow-xl relative group flex flex-col"
                style={{ width: '210mm', height: '297mm' }} 
              >
                  {/* Page Indicator */}
                  <div className="absolute top-2 -right-12 text-gray-500 text-xs font-mono hidden xl:block w-8 scale-100 select-none">
                      {index + 1} / {pageCount}
                  </div>

                  {/* Header */}
                  {pageSettings.hasHeader && (
                    <div 
                        className="absolute top-0 left-0 w-full px-[25.4mm] pt-4 h-[25.4mm] text-gray-400 hover:text-black border-b border-transparent hover:border-blue-100 transition-colors cursor-text overflow-hidden"
                        contentEditable suppressContentEditableWarning
                        onBlur={(e) => onHeaderFooterChange('header', e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: pageSettings.headerText || '' }}
                    />
                  )}

                  {/* Content Body */}
                  <div
                    className="page-content outline-none prose-editor text-black caret-black"
                    contentEditable suppressContentEditableWarning
                    style={contentStyle}
                    onInput={balancePages}
                    onMouseUp={onSelectionChange}
                    onKeyUp={onSelectionChange}
                    onBlur={onSelectionChange}
                  />
                  
                  {/* Footer */}
                  {pageSettings.hasFooter && (
                   <div 
                     className="absolute bottom-0 left-0 w-full px-[25.4mm] pb-4 h-[25.4mm] flex items-end text-gray-400 hover:text-black border-t border-transparent hover:border-blue-100 transition-colors cursor-text overflow-hidden"
                     contentEditable suppressContentEditableWarning
                     onBlur={(e) => onHeaderFooterChange('footer', e.currentTarget.innerHTML)}
                     dangerouslySetInnerHTML={{ __html: pageSettings.footerText || '' }}
                  />
                  )}
              </div>
          ))}
      </div>
    </div>
  );
};

export default Editor;
