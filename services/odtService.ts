import JSZip from 'jszip';

/**
 * Parses an ODT file and extracts simple HTML content.
 */
export const parseOdtFile = async (file: File): Promise<string> => {
  try {
    const zip = await JSZip.loadAsync(file);
    const contentXml = await zip.file("content.xml")?.async("string");

    if (!contentXml) {
      throw new Error("Invalid ODT file: content.xml not found");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(contentXml, "text/xml");
    
    // ODT namespaces
    const ns = {
      text: "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
      office: "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    };

    const body = xmlDoc.getElementsByTagNameNS(ns.office, "body")[0];
    const textContent = body?.getElementsByTagNameNS(ns.office, "text")[0];

    if (!textContent) return "";

    let htmlOutput = "";

    // Recursive function to traverse ODT nodes and convert to HTML
    const traverse = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const element = node as Element;
      const tagName = element.localName;

      // Handle paragraphs
      if (tagName === "p") {
        const inner = Array.from(element.childNodes).map(traverse).join("");
        return `<p>${inner}</p>`;
      }

      // Handle headers
      if (tagName === "h") {
        const level = element.getAttribute("text:outline-level") || "1";
        const inner = Array.from(element.childNodes).map(traverse).join("");
        return `<h${level}>${inner}</h${level}>`;
      }

      // Handle spans (basic styling)
      if (tagName === "span") {
        return Array.from(element.childNodes).map(traverse).join("");
      }

      // Handle lists
      if (tagName === "list") {
        const inner = Array.from(element.childNodes).map(traverse).join("");
        return `<ul>${inner}</ul>`;
      }
      if (tagName === "list-item") {
        const inner = Array.from(element.childNodes).map(traverse).join("");
        return `<li>${inner}</li>`;
      }
      
      // Handle line breaks
      if (tagName === "line-break") {
        return "<br/>";
      }

      // Handle tabs
      if (tagName === "tab") {
        return "&emsp;";
      }

      // Default: process children
      return Array.from(element.childNodes).map(traverse).join("");
    };

    htmlOutput = traverse(textContent);
    return htmlOutput;

  } catch (error) {
    console.error("Error parsing ODT:", error);
    throw new Error("Failed to parse ODT file.");
  }
};

/**
 * Creates a simple ODT file from HTML content.
 * This is a basic implementation that maps standard HTML tags to ODF XML.
 */
export const saveToOdt = async (htmlContent: string): Promise<Blob> => {
    const zip = new JSZip();

    // 1. mimetype (must be first, uncompressed)
    zip.file("mimetype", "application/vnd.oasis.opendocument.text");

    // 2. META-INF/manifest.xml
    const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
    zip.file("META-INF/manifest.xml", manifestXml);

    // 3. content.xml construction
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlContent}</div>`, 'text/html');
    
    let xmlBody = '';

    const traverseToXml = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            // Escape special chars
            return (node.textContent || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        const inner = Array.from(node.childNodes).map(traverseToXml).join("");

        // Basic Mapping
        if (tagName === 'p') return `<text:p>${inner}</text:p>`;
        if (tagName === 'h1') return `<text:h text:outline-level="1">${inner}</text:h>`;
        if (tagName === 'h2') return `<text:h text:outline-level="2">${inner}</text:h>`;
        if (tagName === 'h3') return `<text:h text:outline-level="3">${inner}</text:h>`;
        if (tagName === 'h4') return `<text:h text:outline-level="4">${inner}</text:h>`;
        if (tagName === 'h5') return `<text:h text:outline-level="5">${inner}</text:h>`;
        if (tagName === 'h6') return `<text:h text:outline-level="6">${inner}</text:h>`;
        
        if (tagName === 'ul') return `<text:list text:style-name="L1">${inner}</text:list>`;
        if (tagName === 'ol') return `<text:list text:style-name="L2">${inner}</text:list>`;
        if (tagName === 'li') return `<text:list-item><text:p>${inner}</text:p></text:list-item>`;

        if (tagName === 'b' || tagName === 'strong') return `<text:span text:style-name="Bold">${inner}</text:span>`;
        if (tagName === 'i' || tagName === 'em') return `<text:span text:style-name="Italic">${inner}</text:span>`;
        if (tagName === 'u') return `<text:span text:style-name="Underline">${inner}</text:span>`;
        if (tagName === 'br') return `<text:line-break/>`;

        // Style handling for colors/highlights would go here in a full implementation
        // For now we just pass through content for unknown tags
        return inner;
    };

    xmlBody = traverseToXml(doc.body.firstChild || doc.body);

    const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:chart="urn:oasis:names:tc:opendocument:xmlns:chart:1.0" xmlns:dr3d="urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0" xmlns:math="http://www.w3.org/1998/Math/MathML" xmlns:form="urn:oasis:names:tc:opendocument:xmlns:form:1.0" xmlns:script="urn:oasis:names:tc:opendocument:xmlns:script:1.0" xmlns:ooo="http://openoffice.org/2004/office" xmlns:ooow="http://openoffice.org/2004/writer" xmlns:oooc="http://openoffice.org/2004/calc" xmlns:dom="http://www.w3.org/2001/xml-events" xmlns:xforms="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:rpt="http://openoffice.org/2005/report" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:grddl="http://www.w3.org/2003/g/data-view#" xmlns:tableooo="http://openoffice.org/2009/table" xmlns:field="urn:openoffice:names:experimental:ooo-ms-interop:xmlns:field:1.0" office:version="1.2">
  <office:scripts/>
  <office:font-face-decls>
    <style:font-face style:name="Inter" svg:font-family="Inter"/>
  </office:font-face-decls>
  <office:automatic-styles>
    <style:style style:name="Bold" style:family="text">
      <style:text-properties fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"/>
    </style:style>
    <style:style style:name="Italic" style:family="text">
      <style:text-properties fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"/>
    </style:style>
    <style:style style:name="Underline" style:family="text">
      <style:text-properties style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${xmlBody}
    </office:text>
  </office:body>
</office:document-content>`;

    zip.file("content.xml", contentXml);
    zip.file("styles.xml", `<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.2"></office:document-styles>`);
    zip.file("meta.xml", `<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"></office:document-meta>`);

    return await zip.generateAsync({ type: "blob" });
};
