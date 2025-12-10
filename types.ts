
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

export interface PageSettings {
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number; // in mm
  firstLineIndent: number; // in mm
  hasHeader: boolean;
  hasFooter: boolean;
  headerText?: string; // HTML content for header
  footerText?: string; // HTML content for footer
}

export interface DocxParseResult {
    html: string;
    settings: PageSettings | null;
}

export interface EditorStyleState {
  fontName: string;
  fontSize: string;
  lineHeight: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  alignment: string;
  foreColor: string;
  hiliteColor: string;
}
