
import React, { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react';
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

const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_BUFFER_PX = 20; // Extra buffer to prevent jitter at edge

const Editor: React.FC<EditorProps> = ({ 
  content, 
  onContentChange, 
  pageSettings,
  onSelectionChange,
  zoom,
  onHeaderFooterChange
}) => {
  // We store pages as an array of ref objects to access DOM directly
  const [pages, setPages] = useState<string[]>(['']);
  const containerRef = useRef<HTMLDivElement>(null);
  const isBalancing = useRef(false);
  const internalUpdate = useRef(false);

  // --- HTML Utils ---

  const getAllContent = () => {
    if (!containerRef.current) return '';
    const pageNodes = containerRef.current.querySelectorAll('.page-content');
    return Array.from(pageNodes).map(p => p.innerHTML).join('');
  };

  // --- Layout Engine ---

  /**
   * Moves DOM nodes from sourcePage to targetPage until sourcePage fits.
   * Preserves focus if the moved node contains the caret.
   */
  const moveOverflowContent = (sourcePage: HTMLElement, targetPage: HTMLElement): boolean => {
    let moved = false;
    const maxHeight = sourcePage.clientHeight;

    // While overflow exists
    while (sourcePage.scrollHeight > maxHeight + 1) {
      const lastChild = sourcePage.lastChild;
      if (!lastChild) break;

      // 1. Check Focus
      const selection = window.getSelection();
      let focusedNodeOffset: { node: Node, offset: number } | null = null;
      
      if (selection?.rangeCount && selection.anchorNode && lastChild.contains(selection.anchorNode)) {
         // Focus is inside the node we are about to move
         focusedNodeOffset = {
             node: selection.anchorNode,
             offset: selection.anchorOffset
         };
      }

      // 2. Move Node
      if (targetPage.firstChild) {
          targetPage.insertBefore(lastChild, targetPage.firstChild);
      } else {
          targetPage.appendChild(lastChild);
      }
      moved = true;

      // 3. Restore Focus
      if (focusedNodeOffset) {
          const newRange = document.createRange();
          newRange.setStart(focusedNodeOffset.node, focusedNodeOffset.offset);
          newRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
          
          // 4. Scroll to view (New Perspective: Scroll immediately on move)
          if (lastChild instanceof HTMLElement) {
              lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
    }
    return moved;
  };

  const balanceFromPage = useCallback((startIndex: number) => {
    if (isBalancing.current || !containerRef.current) return;
    isBalancing.current = true;

    const pageEls = Array.from(containerRef.current.querySelectorAll('.page-content')) as HTMLElement[];
    let changesMade = false;

    // 1. Forward Pass (Overflow)
    for (let i = startIndex; i < pageEls.length; i++) {
        const page = pageEls[i];
        
        // If this page overflows
        if (page.scrollHeight > page.clientHeight + 1) {
            // Check if we have a next page
            let nextPage = pageEls[i + 1];
            
            if (!nextPage) {
                // Need a new page. We must exit React cycle to render it.
                // We add a flag to state to trigger re-render
                setPages(p => [...p, '<p><br/></p>']);
                isBalancing.current = false;
                return; // Re-render will trigger effect to continue balancing
            }

            const moved = moveOverflowContent(page, nextPage);
            if (moved) changesMade = true;
        }
    }

    // 2. Backward Pass (Underflow - Pull back)
    // Only pull back if significantly empty to avoid jitter
    for (let i = 0; i < pageEls.length - 1; i++) {
        const page = pageEls[i];
        const nextPage = pageEls[i + 1];
        
        // Simple heuristic: If next page has content and current page has space
        // We only pull one block at a time to be safe
        if (nextPage && nextPage.firstChild) {
            // Check if we can fit the first child of next page into current page
            // This is tricky without measuring. 
            // Strategy: append, check height. If fails, put back.
            
            const candidate = nextPage.firstChild;
            page.appendChild(candidate);
            
            if (page.scrollHeight > page.clientHeight) {
                // Oops, didn't fit. Put it back.
                nextPage.insertBefore(candidate, nextPage.firstChild);
            } else {
                // It fit! Check if we moved focus
                const selection = window.getSelection();
                if (selection?.anchorNode && candidate.contains(selection.anchorNode)) {
                     (candidate as HTMLElement).scrollIntoView({ block: 'nearest' });
                }
                changesMade = true;
            }
        }
    }

    // 3. Cleanup Empty Pages at the end
    if (pageEls.length > 1) {
        const lastPage = pageEls[pageEls.length - 1];
        const secondLast = pageEls[pageEls.length - 2];
        
        // If last page is effectively empty and second last isn't overflowing
        if (
            (!lastPage.textContent?.trim() && !lastPage.querySelector('img, table')) && 
            secondLast.scrollHeight <= secondLast.clientHeight
        ) {
            // Check focus isn't there
            if (!lastPage.contains(document.activeElement)) {
                 setPages(p => p.slice(0, -1));
                 changesMade = true;
            }
        }
    }

    // 4. Sync State
    if (changesMade) {
        const fullHtml = getAllContent();
        internalUpdate.current = true;
        onContentChange(fullHtml);
    }

    isBalancing.current = false;
  }, [onContentChange]);

  // --- Handlers ---

  const handleInput = (pageIndex: number) => {
      // Trigger balance starting from the modified page
      // We use setTimeout to let the DOM update from the keystroke first
      setTimeout(() => balanceFromPage(pageIndex), 0);
  };

  // --- Initialization & External Updates ---

  useEffect(() => {
      // When content prop changes externally (e.g. file load)
      // We reset to Page 1 with all content and let it reflow
      if (!internalUpdate.current && content) {
          // This is a "hard reset" for file loads
          setPages([content]);
      }
      internalUpdate.current = false;
  }, [content]);

  // After render, check if we need to balance (especially after adding a new page)
  useLayoutEffect(() => {
      // Run balance on every render to ensure layout is correct
      // This handles the "I just added a page, now move content into it" case
      balanceFromPage(0);
  }, [pages.length, balanceFromPage]);


  // --- Render ---

  const contentStyle: React.CSSProperties = {
      paddingTop: `${pageSettings.marginTop}mm`,
      paddingBottom: `${pageSettings.marginBottom}mm`,
      paddingLeft: `${pageSettings.marginLeft}mm`,
      paddingRight: `${pageSettings.marginRight}mm`,
      height: '100%', // Critical for scrollHeight detection
      boxSizing: 'border-box',
      overflow: 'hidden', // We hide overflow because we handle it manually
  };

  return (
    <div 
        className="flex-1 w-full bg-gray-200 overflow-y-auto flex flex-col items-center py-8 custom-scrollbar scroll-smooth"
        onClick={(e) => {
            if (e.target === e.currentTarget) {
                // Focus the last actual content page if clicking background
                const allPages = containerRef.current?.querySelectorAll('.page-content');
                const last = allPages?.[allPages.length - 1] as HTMLElement;
                last?.focus();
            }
        }}
    >
      <div 
        ref={containerRef}
        id="editor-container"
        className="flex flex-col gap-8 pb-20 origin-top"
        style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s ease-out' }}
      >
          {pages.map((pageHtml, index) => (
              <div 
                key={index} // Using index is acceptable here as we only append/pop
                className="editor-page-node bg-white shadow-xl relative group flex flex-col"
                style={{ width: '210mm', height: '297mm' }} 
              >
                  {/* Page Marker */}
                  <div className="absolute top-2 -left-12 text-gray-400 text-xs font-mono hidden xl:block w-8 text-right select-none">
                      {index + 1}
                  </div>

                  {/* Header */}
                  {pageSettings.hasHeader && (
                    <div 
                        className="absolute top-0 left-0 w-full px-[25.4mm] pt-4 h-[25.4mm] text-gray-400 hover:text-black border-b border-transparent hover:border-blue-100 transition-colors cursor-text overflow-hidden z-10"
                        contentEditable 
                        suppressContentEditableWarning
                        onBlur={(e) => onHeaderFooterChange('header', e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: pageSettings.headerText || '' }}
                    />
                  )}

                  {/* Body */}
                  <div
                    className="page-content outline-none prose-editor text-black caret-black relative z-0"
                    contentEditable
                    suppressContentEditableWarning
                    style={contentStyle}
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                    onInput={() => handleInput(index)}
                    onBlur={onSelectionChange}
                    onMouseUp={onSelectionChange}
                    onKeyUp={onSelectionChange}
                  />

                  {/* Footer */}
                  {pageSettings.hasFooter && (
                   <div 
                     className="absolute bottom-0 left-0 w-full px-[25.4mm] pb-4 h-[25.4mm] flex items-end text-gray-400 hover:text-black border-t border-transparent hover:border-blue-100 transition-colors cursor-text overflow-hidden z-10"
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
