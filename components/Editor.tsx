
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
  editorRef, 
  pageSettings,
  onSelectionChange,
  zoom,
  onHeaderFooterChange
}) => {
  const [pageCount, setPageCount] = useState(1);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const isBalancing = useRef(false);
  const lastEmitRef = useRef<string>(content);

  // Initialize or Reset content when external prop changes drastically
  useEffect(() => {
    if (content !== lastEmitRef.current) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content || '<p><br/></p>';
        setPageCount(1);
        
        setTimeout(() => {
            const firstPage = pagesContainerRef.current?.querySelector('.page-content');
            if (firstPage) {
                firstPage.innerHTML = tempDiv.innerHTML;
                lastEmitRef.current = content; 
                balancePages();
            }
        }, 0);
    }
  }, [content]);

  // -- Pagination Logic (Same logic, just wrapped in useCallback) --
  const balancePages = useCallback(() => {
    if (isBalancing.current || !pagesContainerRef.current) return;
    isBalancing.current = true;

    // NOTE: When using Zoom (transform: scale), clientHeight/scrollHeight values might become decimal or slightly different.
    // However, since the internal content isn't scaled relative to the page div (the whole page div is scaled), 
    // the internal flow usually remains consistent relative to the page boundaries.
    
    const pages = Array.from(pagesContainerRef.current.querySelectorAll('.page-content')) as HTMLElement[];
    let didChange = false;

    // 1. Forward Pass
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        while (page.scrollHeight > page.clientHeight + 1) {
            const lastChild = page.lastChild;
            if (!lastChild) break;
            if (page.childNodes.length === 1 && i === 0) break; 

            let nextPage = pages[i + 1];
            if (!nextPage) {
                setPageCount(prev => prev + 1);
                isBalancing.current = false;
                return; 
            }
            if (nextPage.firstChild) {
                nextPage.insertBefore(lastChild, nextPage.firstChild);
            } else {
                nextPage.appendChild(lastChild);
            }
            didChange = true;
        }
    }

    // 2. Backward Pass
    for (let i = 0; i < pages.length - 1; i++) {
        const page = pages[i];
        let nextPage = pages[i + 1];

        while (nextPage && nextPage.firstChild) {
            const firstChild = nextPage.firstChild;
            page.appendChild(firstChild);
            if (page.scrollHeight > page.clientHeight + 1) {
                if (nextPage.firstChild) {
                    nextPage.insertBefore(firstChild, nextPage.firstChild);
                } else {
                    nextPage.appendChild(firstChild);
                }
                break; 
            } else {
                didChange = true;
            }
        }
        if (nextPage && nextPage.childNodes.length === 0 && i + 1 === pages.length - 1) {
            setPageCount(prev => Math.max(1, prev - 1));
            isBalancing.current = false;
            return;
        }
    }

    if (didChange) {
       emitContentUpdate();
    }
    isBalancing.current = false;
  }, [pageCount]);

  const emitContentUpdate = () => {
      if (!pagesContainerRef.current) return;
      const pages = Array.from(pagesContainerRef.current.querySelectorAll('.page-content')) as HTMLElement[];
      const fullHtml = pages.map(p => p.innerHTML).join('');
      lastEmitRef.current = fullHtml;
      onContentChange(fullHtml);
  };

  useLayoutEffect(() => {
      balancePages();
  });

  const onInputHandler = useCallback(() => {
      balancePages();
      emitContentUpdate();
  }, [balancePages]);

  const pageStyle = {
      paddingTop: `${pageSettings.marginTop}mm`,
      paddingBottom: `${pageSettings.marginBottom}mm`,
      paddingLeft: `${pageSettings.marginLeft}mm`,
      paddingRight: `${pageSettings.marginRight}mm`,
      height: '297mm',
      width: '210mm',
  };

  return (
    <div 
        className="flex-1 w-full bg-gray-200 overflow-y-auto flex flex-col items-center py-8"
        onClick={(e) => {
            if (e.target === e.currentTarget) {
                const pages = pagesContainerRef.current?.querySelectorAll('.page-content');
                const lastPage = pages?.[pages.length - 1] as HTMLElement;
                lastPage?.focus();
            }
        }}
    >
      <div 
        ref={pagesContainerRef} 
        className="flex flex-col gap-8 pb-20 origin-top"
        style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out' }}
      >
          {Array.from({ length: pageCount }).map((_, index) => (
              <div 
                key={index} 
                className="bg-white shadow-xl relative group flex flex-col"
                style={{ width: '210mm', height: '297mm' }} 
              >
                  {/* Page Indicator */}
                  <div className="absolute top-2 -right-12 text-gray-500 text-xs font-mono hidden xl:block w-8 scale-100">
                      {index + 1} / {pageCount}
                  </div>

                  {/* HEADER AREA */}
                  {pageSettings.hasHeader && (
                    <div 
                        className="absolute top-0 left-0 w-full px-[25.4mm] pt-4 h-[25.4mm] text-gray-400 hover:text-black border-b border-transparent hover:border-blue-100 transition-colors cursor-text overflow-hidden"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => onHeaderFooterChange('header', e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: pageSettings.headerText || '' }}
                    />
                  )}

                  {/* CONTENT AREA */}
                  <div
                    className="page-content outline-none prose-editor overflow-hidden flex-1 text-black caret-black"
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                        ...pageStyle,
                        boxSizing: 'border-box',
                        // Add top/bottom padding compensation if header/footer hidden to keep text in flow, 
                        // or just rely on margins. Margins are usually enough.
                    }}
                    onInput={onInputHandler}
                    onMouseUp={onSelectionChange}
                    onKeyUp={onSelectionChange}
                    onBlur={onSelectionChange}
                  />
                  
                  {/* FOOTER AREA */}
                  {pageSettings.hasFooter && (
                   <div 
                     className="absolute bottom-0 left-0 w-full px-[25.4mm] pb-4 h-[25.4mm] flex items-end text-gray-400 hover:text-black border-t border-transparent hover:border-blue-100 transition-colors cursor-text overflow-hidden"
                     contentEditable
                     suppressContentEditableWarning
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
