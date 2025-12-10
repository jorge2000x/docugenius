
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

export interface EditorState {
  content: string; // HTML string
  fontName: string;
  fontSize: string;
  foreColor: string;
  backColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignment: TextAlignment;
}
