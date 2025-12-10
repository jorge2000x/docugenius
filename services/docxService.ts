
import JSZip from 'jszip';
import { PageSettings, DocxParseResult } from '../types';

// --- Helper Utilities ---

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const escapeXml = (unsafe: string) => {
    return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
};

// --- DOCX Builder Class ---

class DocxBuilder {
    private images: { id: string, data: string, ext: string }[] = [];
    private imageCounter = 0;
    
    constructor(private settings: PageSettings) {}

    private getNextRelId() {
        // Reserve rId1-rId4 for internal use (document, styles, header, footer)
        return `rId${this.images.length + 5}`;
    }

    public addImage(dataUrl: string): string | null {
        const parts = dataUrl.split(',');
        if (parts.length !== 2) return null;
        
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (!mimeMatch) return null;
        
        const ext = mimeMatch[1].includes('png') ? 'png' : 'jpeg';
        const relId = this.getNextRelId();
        
        this.images.push({ id: relId, data: parts[1], ext });
        this.imageCounter++;
        return relId;
    }

    public generateRun(node: Node, context: { bold?: boolean, italic?: boolean, underline?: boolean }): string {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            if (!text) return "";
            
            let rPr = "";
            if (context.bold) rPr += "<w:b/>";
            if (context.italic) rPr += "<w:i/>";
            if (context.underline) rPr += "<w:u w:val='single'/>";
            
            // Basic color handling can be expanded here
            
            return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();

            // Image
            if (tag === 'img') {
                const src = el.getAttribute('src');
                if (src) {
                    const relId = this.addImage(src);
                    if (relId) {
                        return this.generateImageXml(relId, this.imageCounter);
                    }
                }
                return "";
            }

            // Page Number
            if (tag === 'span' && el.classList.contains('page-number')) {
                 return this.generatePageNumberXml(context);
            }

            // Line Break
            if (tag === 'br') return `<w:r><w:br/></w:r>`;

            // Styles (Recursive)
            const newContext = { ...context };
            if (tag === 'b' || tag === 'strong') newContext.bold = true;
            if (tag === 'i' || tag === 'em') newContext.italic = true;
            if (tag === 'u') newContext.underline = true;

            return Array.from(node.childNodes).map(child => this.generateRun(child, newContext)).join("");
        }
        return "";
    }

    public generateParagraph(node: Node): string {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        
        let pPr = "";
        
        // Headers
        if (tag.match(/^h[1-6]$/)) {
            const level = tag.substring(1);
            pPr += `<w:pStyle w:val="Heading${level}"/>`;
        }

        // Alignment
        const align = el.style.textAlign;
        if (align) {
            const val = align === 'justify' ? 'both' : align;
            pPr += `<w:jc w:val="${val}"/>`;
        }

        // Wrap properties
        if (pPr) pPr = `<w:pPr>${pPr}</w:pPr>`;

        const content = Array.from(node.childNodes).map(c => this.generateRun(c, {})).join("");
        return `<w:p>${pPr}${content}</w:p>`;
    }

    public generateTable(node: Node): string {
         const el = node as HTMLElement;
         const rows = Array.from(el.querySelectorAll('tr')).map(tr => {
             const cells = Array.from(tr.querySelectorAll('td, th')).map(td => {
                 const cellContent = Array.from(td.childNodes).map(c => this.generateRun(c, {})).join("");
                 // Basic cell borders
                 return `<w:tc>
                    <w:tcPr>
                        <w:tcW w:w="0" w:type="auto"/>
                        <w:tcBorders>
                            <w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/>
                            <w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/>
                        </w:tcBorders>
                    </w:tcPr>
                    <w:p><w:r>${cellContent}</w:r></w:p>
                 </w:tc>`;
             }).join("");
             return `<w:tr>${cells}</w:tr>`;
         }).join("");
         
         return `<w:tbl>
            <w:tblPr>
                <w:tblW w:w="0" w:type="auto"/>
                <w:tblBorders>
                    <w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/>
                    <w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/>
                    <w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/>
                </w:tblBorders>
            </w:tblPr>
            ${rows}
         </w:tbl>`;
    }

    public processNodes(nodes: NodeList): string {
        return Array.from(nodes).map(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return "";
            const tag = (node as Element).tagName.toLowerCase();

            if (tag === 'table') return this.generateTable(node);
            if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) return this.generateParagraph(node);
            if (['ul', 'ol'].includes(tag)) {
                // Simplified list handling: treat children as paragraphs for now
                return this.processNodes(node.childNodes);
            }
            return this.processNodes(node.childNodes); // fallback recursion
        }).join("");
    }

    private generateImageXml(relId: string, id: number): string {
        return `<w:r>
            <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                    <wp:extent cx="3000000" cy="2000000"/>
                    <wp:docPr id="${id}" name="Picture ${id}"/>
                    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                <pic:nvPicPr><pic:cNvPr id="${id}" name="img"/><pic:cNvPicPr/></pic:nvPicPr>
                                <pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                                <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                            </pic:pic>
                        </a:graphicData>
                    </a:graphic>
                </wp:inline>
            </w:drawing>
        </w:r>`;
    }

    private generatePageNumberXml(context: any): string {
        let rPr = "";
        if (context.bold) rPr += "<w:b/>";
        return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:fldChar w:fldCharType="begin"/></w:r>
        <w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:instrText xml:space="preserve">PAGE</w:instrText></w:r>
        <w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:fldChar w:fldCharType="separate"/></w:r>
        <w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t>1</w:t></w:r>
        <w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:fldChar w:fldCharType="end"/></w:r>`;
    }

    public getImages() { return this.images; }
}

// --- Public API ---

export const parseDocxFile = async (file: File): Promise<DocxParseResult> => {
    try {
        const zip = await JSZip.loadAsync(file);
        const contentXml = await zip.file("word/document.xml")?.async("string");
        const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
        
        if (!contentXml) throw new Error("No content found");

        // 1. Image Map Construction
        const imageMap: Record<string, string> = {}; 
        if (relsXml) {
            const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
            const relationships = relsDoc.getElementsByTagName("Relationship");
            for (let i = 0; i < relationships.length; i++) {
                const rel = relationships[i];
                if (rel.getAttribute("Type")?.endsWith("/image")) {
                    const target = rel.getAttribute("Target");
                    const id = rel.getAttribute("Id");
                    if (target && id) {
                        const imgFile = zip.file("word/" + target);
                        if (imgFile) imageMap[id] = await blobToBase64(await imgFile.async("blob"));
                    }
                }
            }
        }

        // 2. Parse XML to HTML (Simplified recursive parser)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(contentXml, "text/xml");
        
        // Extract Page Settings
        const body = xmlDoc.getElementsByTagNameNS("*", "body")[0];
        let settings: PageSettings | null = null;
        
        if (body) {
             const sectPr = body.getElementsByTagNameNS("*", "sectPr")[0];
             if (sectPr) {
                 const pgMar = sectPr.getElementsByTagNameNS("*", "pgMar")[0];
                 if (pgMar) {
                     const toMm = (v: string|null) => v ? Math.round(parseInt(v)/56.7) : 25.4;
                     settings = {
                         marginTop: toMm(pgMar.getAttribute("w:top")),
                         marginBottom: toMm(pgMar.getAttribute("w:bottom")),
                         marginLeft: toMm(pgMar.getAttribute("w:left")),
                         marginRight: toMm(pgMar.getAttribute("w:right")),
                         firstLineIndent: 0,
                         hasHeader: !!sectPr.getElementsByTagNameNS("*", "headerReference").length,
                         hasFooter: !!sectPr.getElementsByTagNameNS("*", "footerReference").length,
                         headerText: "", footerText: ""
                     };
                 }
             }
        }

        // Recursive Traversal Logic
        const traverse = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) return "";
            const el = node as Element;
            const tag = el.localName;

            // Simple Field (Page Number)
            if (tag === 'instrText' && el.textContent?.includes('PAGE')) return '<span class="page-number"><span>#</span></span>';
            if (tag === 'fldSimple' && el.getAttribute('w:instr')?.includes('PAGE')) return '<span class="page-number"><span>#</span></span>';
            
            // Images
            if (tag === 'drawing') {
                const blip = el.getElementsByTagNameNS("*", "blip")[0];
                const id = blip?.getAttribute("r:embed");
                if (id && imageMap[id]) return `<img src="${imageMap[id]}" />`;
            }

            // Paragraphs / Text
            if (tag === 'p') {
                const jc = el.getElementsByTagNameNS("*", "jc")[0]?.getAttribute("w:val");
                const align = jc === 'both' ? 'justify' : jc;
                const style = align ? ` style="text-align: ${align}"` : "";
                
                // Headings
                const pStyle = el.getElementsByTagNameNS("*", "pStyle")[0]?.getAttribute("w:val");
                const hLevel = pStyle?.match(/Heading(\d)/)?.[1];
                const htmlTag = hLevel ? `h${hLevel}` : 'p';
                
                return `<${htmlTag}${style}>${Array.from(el.childNodes).map(traverse).join("")}</${htmlTag}>`;
            }

            if (tag === 'r') {
                let prefix = "", suffix = "";
                const rPr = el.getElementsByTagNameNS("*", "rPr")[0];
                if (rPr) {
                    if (rPr.getElementsByTagNameNS("*", "b").length) { prefix += "<b>"; suffix = "</b>" + suffix; }
                    if (rPr.getElementsByTagNameNS("*", "i").length) { prefix += "<i>"; suffix = "</i>" + suffix; }
                    if (rPr.getElementsByTagNameNS("*", "u").length) { prefix += "<u>"; suffix = "</u>" + suffix; }
                }
                return prefix + Array.from(el.childNodes).map(traverse).join("") + suffix;
            }
            
            if (tag === 't') return el.textContent || "";
            if (tag === 'br') return "<br/>";
            if (tag === 'tbl') return `<table>${Array.from(el.childNodes).map(traverse).join("")}</table>`;
            if (tag === 'tr') return `<tr>${Array.from(el.childNodes).map(traverse).join("")}</tr>`;
            if (tag === 'tc') return `<td>${Array.from(el.childNodes).map(traverse).join("")}</td>`;

            return Array.from(el.childNodes).map(traverse).join("");
        };

        const html = body ? Array.from(body.childNodes).map(traverse).join("") : "";
        return { html, settings };

    } catch (e) {
        console.error("Parse error", e);
        throw new Error("Failed to parse DOCX");
    }
};

export const saveToDocx = async (html: string, settings: PageSettings): Promise<Blob> => {
    const zip = new JSZip();
    const builder = new DocxBuilder(settings);
    const parser = new DOMParser();

    // 1. Build Document Body
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const xmlBody = builder.processNodes(doc.body.childNodes);

    // 2. Build Header/Footer
    let xmlHeader = "";
    let xmlFooter = "";
    if (settings.hasHeader) {
        const hDoc = parser.parseFromString(`<div>${settings.headerText || ''}</div>`, 'text/html');
        xmlHeader = builder.processNodes(hDoc.body.childNodes);
    }
    if (settings.hasFooter) {
        const fDoc = parser.parseFromString(`<div>${settings.footerText || ''}</div>`, 'text/html');
        xmlFooter = builder.processNodes(fDoc.body.childNodes);
    }

    // 3. Assemble XML Files
    const mmToTwips = (mm: number) => Math.round(mm * 56.6929);
    
    // document.xml
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
    <w:body>
        ${xmlBody}
        <w:sectPr>
            ${settings.hasHeader ? `<w:headerReference w:type="default" r:id="rIdHeader"/>` : ''}
            ${settings.hasFooter ? `<w:footerReference w:type="default" r:id="rIdFooter"/>` : ''}
            <w:pgSz w:w="11906" w:h="16838"/>
            <w:pgMar w:top="${mmToTwips(settings.marginTop)}" w:right="${mmToTwips(settings.marginRight)}" w:bottom="${mmToTwips(settings.marginBottom)}" w:left="${mmToTwips(settings.marginLeft)}"/>
        </w:sectPr>
    </w:body>
    </w:document>`;

    zip.folder("word")?.file("document.xml", documentXml);

    // Relationships
    let rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    
    if (settings.hasHeader) {
        zip.folder("word")?.file("header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xmlHeader}</w:hdr>`);
        rels += `<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`;
    }
    if (settings.hasFooter) {
        zip.folder("word")?.file("footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xmlFooter}</w:ftr>`);
        rels += `<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
    }

    // Images
    builder.getImages().forEach(img => {
        const fn = `image${img.id}.${img.ext}`;
        zip.folder("word")?.folder("media")?.file(fn, img.data, {base64: true});
        rels += `<Relationship Id="${img.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fn}"/>`;
    });

    rels += `</Relationships>`;
    zip.folder("word")?.file("_rels/document.xml.rels", rels);

    // Boilerplate files
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${settings.hasHeader ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}${settings.hasFooter ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}</Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.folder("word")?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);

    return await zip.generateAsync({ type: "blob" });
};
