
import JSZip from 'jszip';
import { PageSettings } from '../types';

interface DocxParseResult {
    html: string;
    settings: PageSettings | null;
}

// Helpers for Image Processing
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Parses a DOCX file and extracts HTML content + Page Settings + Images.
 */
export const parseDocxFile = async (file: File): Promise<DocxParseResult> => {
    try {
        const zip = await JSZip.loadAsync(file);
        const contentXml = await zip.file("word/document.xml")?.async("string");
        const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
        
        if (!contentXml) throw new Error("Invalid DOCX file: word/document.xml not found");

        // 1. Parse Relationships to find Images
        const imageMap: Record<string, string> = {}; // rId -> base64
        if (relsXml) {
            const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
            const relationships = relsDoc.getElementsByTagName("Relationship");
            
            for (let i = 0; i < relationships.length; i++) {
                const rel = relationships[i];
                const type = rel.getAttribute("Type");
                const target = rel.getAttribute("Target");
                const id = rel.getAttribute("Id");
                
                if (type && type.endsWith("/image") && target && id) {
                    // Target is usually "media/image1.png". In zip it is "word/media/image1.png"
                    const zipPath = "word/" + target;
                    const imgFile = zip.file(zipPath);
                    if (imgFile) {
                        const blob = await imgFile.async("blob");
                        const base64 = await blobToBase64(blob);
                        imageMap[id] = base64;
                    }
                }
            }
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(contentXml, "text/xml");
        
        let html = "";
        let settings: PageSettings | null = null;
        
        // --- 2. Extract Page Margins ---
        const body = xmlDoc.getElementsByTagNameNS("*", "body")[0];
        if (body) {
            const sectPr = body.getElementsByTagNameNS("*", "sectPr")[0];
            if (sectPr) {
                const pgMar = sectPr.getElementsByTagNameNS("*", "pgMar")[0];
                if (pgMar) {
                    const twipsToMm = (val: string | null) => {
                        if (!val) return 25.4; 
                        const num = parseInt(val, 10);
                        return isNaN(num) ? 25.4 : Math.round((num / 56.6929) * 10) / 10;
                    };
                    settings = {
                        marginTop: twipsToMm(pgMar.getAttribute("w:top")),
                        marginBottom: twipsToMm(pgMar.getAttribute("w:bottom")),
                        marginLeft: twipsToMm(pgMar.getAttribute("w:left")),
                        marginRight: twipsToMm(pgMar.getAttribute("w:right")),
                        firstLineIndent: 0,
                        hasHeader: !!sectPr.getElementsByTagNameNS("*", "headerReference").length,
                        hasFooter: !!sectPr.getElementsByTagNameNS("*", "footerReference").length,
                        headerText: "", 
                        footerText: ""
                    };
                }
            }
        }

        // --- 3. Recursive Traversal ---
        const traverse = (node: Node): string => {
            if(node.nodeType === Node.TEXT_NODE) return ""; 
            
            const el = node as Element;
            const tag = el.localName; 
            
            // TABLES
            if (tag === 'tbl') {
                const rows = Array.from(el.childNodes).map(traverse).join("");
                return `<table style="width:100%; border-collapse: collapse; border: 1px solid #000;">${rows}</table>`;
            }
            if (tag === 'tr') {
                const cells = Array.from(el.childNodes).map(traverse).join("");
                return `<tr>${cells}</tr>`;
            }
            if (tag === 'tc') {
                const content = Array.from(el.childNodes).map(traverse).join("");
                return `<td style="border: 1px solid #ccc; padding: 4px;">${content}</td>`;
            }

            // IMAGES (Drawings)
            if (tag === 'drawing') {
                const blip = el.getElementsByTagNameNS("*", "blip")[0];
                if (blip) {
                    const embedId = blip.getAttribute("r:embed");
                    if (embedId && imageMap[embedId]) {
                        // We found the image!
                        return `<img src="${imageMap[embedId]}" style="max-width: 100%; height: auto;" />`;
                    }
                }
            }

            // Paragraphs
            if (tag === 'p') { 
                let tagType = "p";
                let style = "";
                
                const pPr = el.getElementsByTagNameNS("*", "pPr")[0];
                if (pPr) {
                    // Headings
                    const pStyle = pPr.getElementsByTagNameNS("*", "pStyle")[0];
                    if (pStyle) {
                        const val = pStyle.getAttribute("w:val");
                        if (val && val.toLowerCase().startsWith("heading")) {
                            const level = val.replace(/[^0-9]/g, '');
                            if (level) tagType = `h${level}`;
                        }
                    }
                    // Alignment
                    const jc = pPr.getElementsByTagNameNS("*", "jc")[0];
                    if (jc) {
                        const val = jc.getAttribute("w:val");
                        if (val === 'both') style += 'text-align: justify;';
                        else if (val) style += `text-align: ${val};`;
                    }
                    // Line Spacing
                    const spacing = pPr.getElementsByTagNameNS("*", "spacing")[0];
                    if (spacing) {
                        const line = spacing.getAttribute("w:line");
                        const lineRule = spacing.getAttribute("w:lineRule");
                        if (line && lineRule === "auto") {
                            const val = parseInt(line, 10);
                            if (!isNaN(val)) {
                                const cssLineHeight = Math.round((val / 240) * 100) / 100;
                                style += `line-height: ${cssLineHeight};`;
                            }
                        }
                    }
                }
                const inner = Array.from(el.childNodes).map(traverse).join("");
                return `<${tagType}${style ? ` style="${style.trim()}"` : ''}>${inner}</${tagType}>`;
            }
            
            // Runs
            if (tag === 'r') { 
                const rPr = el.getElementsByTagNameNS("*", "rPr")[0];
                let prefix = "";
                let suffix = "";
                let style = "";
                
                if (rPr) {
                    if (rPr.getElementsByTagNameNS("*", "b").length > 0) { prefix += "<b>"; suffix = "</b>" + suffix; }
                    if (rPr.getElementsByTagNameNS("*", "i").length > 0) { prefix += "<i>"; suffix = "</i>" + suffix; }
                    if (rPr.getElementsByTagNameNS("*", "u").length > 0) { prefix += "<u>"; suffix = "</u>" + suffix; }
                    
                    const color = rPr.getElementsByTagNameNS("*", "color")[0];
                    if (color) {
                        const val = color.getAttribute("w:val");
                        if (val && val !== "auto") style += `color: #${val};`;
                    }
                    const highlight = rPr.getElementsByTagNameNS("*", "highlight")[0];
                    if (highlight) {
                        const val = highlight.getAttribute("w:val");
                        if (val) style += `background-color: ${val};`;
                    }
                     const sz = rPr.getElementsByTagNameNS("*", "sz")[0];
                    if (sz) {
                        const val = parseInt(sz.getAttribute("w:val") || "0", 10);
                        if (val > 0) style += `font-size: ${val / 2}pt;`;
                    }
                }
                
                const inner = Array.from(el.childNodes).map(traverse).join("");
                const content = prefix + inner + suffix;
                return style ? `<span style="${style.trim()}">${content}</span>` : content;
            }

            if (tag === 't') return el.textContent || "";
            if (tag === 'br') return "<br/>";

            return Array.from(el.childNodes).map(traverse).join("");
        }
        
        if (body) {
            html = Array.from(body.childNodes).map(traverse).join("");
        }
        return { html, settings };

    } catch (e) {
        console.error("DOCX Parse Error", e);
        throw new Error("Failed to parse DOCX file");
    }
}

/**
 * Generates a DOCX file from HTML content, Settings, Images, and Header/Footer.
 */
export const saveToDocx = async (html: string, settings?: PageSettings): Promise<Blob> => {
    const zip = new JSZip();
    const mg = settings || { 
        marginTop: 25.4, marginBottom: 25.4, marginLeft: 25.4, marginRight: 25.4, firstLineIndent: 0, 
        hasHeader: true, hasFooter: true 
    };
    const mmToTwips = (mm: number) => Math.round(mm * 56.6929);

    const hasHeader = mg.hasHeader;
    const hasFooter = mg.hasFooter;

    // Track images to be added
    let imageCounter = 0;
    const imagesToAdd: { id: string, data: string, ext: string }[] = [];

    // Helper to generate IDs
    const getNextRelId = () => `rId${imagesToAdd.length + 5}`; // Reserve first few for styles, header, footer

    // 1. [Content_Types].xml
    let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`;
    
    if (hasHeader) contentTypes += `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`;
    if (hasFooter) contentTypes += `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
    
    contentTypes += `</Types>`;
    zip.file("[Content_Types].xml", contentTypes);

    // 2. _rels/.rels
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    zip.file("_rels/.rels", rels);

    // 5. Convert Body HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');

    // Shared run processor
    const processRunContent = (nodes: NodeList, context: any) => {
        let result = "";
        nodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                 const text = node.textContent || "";
                 if (!text) return;
                 let rPr = "";
                 if (context.bold) rPr += "<w:b/>";
                 if (context.italic) rPr += "<w:i/>";
                 if (context.underline) rPr += "<w:u w:val='single'/>";
                 
                 const parent = node.parentElement;
                 if (parent && parent.style.color) { /* Extract color logic here */ }
                 
                 result += `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r>`;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element;
                const tag = el.tagName.toLowerCase();
                
                // IMAGE HANDLING
                if (tag === 'img') {
                    const src = el.getAttribute('src');
                    if (src && src.startsWith('data:image')) {
                         imageCounter++;
                         const relId = getNextRelId();
                         // Simple extraction of base64 data
                         const parts = src.split(',');
                         const mime = parts[0].match(/:(.*?);/);
                         const ext = mime && mime[1].includes('png') ? 'png' : 'jpeg';
                         
                         imagesToAdd.push({ id: relId, data: parts[1], ext });
                         
                         // XML for Image (Drawing)
                         result += `<w:r>
                            <w:drawing>
                                <wp:inline distT="0" distB="0" distL="0" distR="0">
                                    <wp:extent cx="3000000" cy="2000000"/>
                                    <wp:docPr id="${imageCounter}" name="Picture ${imageCounter}"/>
                                    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                                <pic:nvPicPr><pic:cNvPr id="${imageCounter}" name="img"/><pic:cNvPicPr/></pic:nvPicPr>
                                                <pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                                                <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                                            </pic:pic>
                                        </a:graphicData>
                                    </a:graphic>
                                </wp:inline>
                            </w:drawing>
                         </w:r>`;
                    }
                } else {
                    const newContext = {...context};
                    if (tag === 'b' || tag === 'strong') newContext.bold = true;
                    if (tag === 'i' || tag === 'em') newContext.italic = true;
                    if (tag === 'u') newContext.underline = true;
                    result += processRunContent(node.childNodes, newContext);
                }
            }
        });
        return result;
    };

    const processBlock = (node: Node): string => {
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        
        // TABLE HANDLING
        if (tag === 'table') {
             const rows = Array.from(el.querySelectorAll('tr')).map(tr => {
                 const cells = Array.from(tr.querySelectorAll('td, th')).map(td => {
                     const cellContent = processRunContent(td.childNodes, {bold: false});
                     return `<w:tc>
                        <w:tcPr><w:tcW w:w="0" w:type="auto"/><w:tcBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tcBorders></w:tcPr>
                        <w:p><w:r>${cellContent}</w:r></w:p>
                     </w:tc>`;
                 }).join("");
                 return `<w:tr>${cells}</w:tr>`;
             }).join("");
             
             return `<w:tbl>
                <w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>
                ${rows}
             </w:tbl>`;
        }

        if (tag === 'p' || tag === 'li' || tag.startsWith('h')) {
             let pPr = "";
             if (tag === 'h1') pPr += `<w:pStyle w:val="Heading1"/>`;
             const align = el.style.textAlign;
             if (align) pPr += `<w:jc w:val="${align === 'justify' ? 'both' : align}"/>`;
             if (pPr) pPr = `<w:pPr>${pPr}</w:pPr>`;
             
             return `<w:p>${pPr}${processRunContent(node.childNodes, {bold: false})}</w:p>`;
        }
        
        return Array.from(node.childNodes).map(processBlock).join("");
    };

    // Body Content
    const xmlBody = processBlock(doc.body);

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
    xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${xmlBody}
    <w:sectPr>
        ${hasHeader ? `<w:headerReference w:type="default" r:id="rIdHeader"/>` : ''}
        ${hasFooter ? `<w:footerReference w:type="default" r:id="rIdFooter"/>` : ''}
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="${mmToTwips(mg.marginTop)}" w:right="${mmToTwips(mg.marginRight)}" w:bottom="${mmToTwips(mg.marginBottom)}" w:left="${mmToTwips(mg.marginLeft)}"/>
    </w:sectPr>
  </w:body>
</w:document>`;
    
    zip.folder("word")?.file("document.xml", documentXml);

    // Header/Footer XML
    if (hasHeader) {
        const headerDoc = parser.parseFromString(`<div>${settings?.headerText || ''}</div>`, 'text/html');
        const xmlHeader = processBlock(headerDoc.body);
        zip.folder("word")?.file("header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xmlHeader}</w:hdr>`);
    }

    if (hasFooter) {
        const footerDoc = parser.parseFromString(`<div>${settings?.footerText || ''}</div>`, 'text/html');
        const xmlFooter = processBlock(footerDoc.body);
        zip.folder("word")?.file("footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xmlFooter}</w:ftr>`);
    }
    
    // Styles
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
    zip.folder("word")?.file("styles.xml", styles);

    // Dynamic Relationships
    let relsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    
    if (hasHeader) relsContent += `<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`;
    if (hasFooter) relsContent += `<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
    
    // Add Image Rels and Files
    imagesToAdd.forEach(img => {
        const fileName = `image${img.id}.${img.ext}`;
        relsContent += `<Relationship Id="${img.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/>`;
        zip.folder("word")?.folder("media")?.file(fileName, img.data, {base64: true});
    });

    relsContent += `</Relationships>`;
    zip.folder("word")?.file("_rels/document.xml.rels", relsContent);
    
    return await zip.generateAsync({ type: "blob" });
}
