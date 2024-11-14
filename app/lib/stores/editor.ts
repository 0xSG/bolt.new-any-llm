import type { ITerminal } from '~/types/terminal';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileMap } from './files';
import { atom, map } from 'nanostores';

export class EditorStore {
  documents = map<Record<string, EditorDocument>>({});
  currentDocument = atom<EditorDocument | undefined>(undefined);
  selectedFile = atom<string | undefined>(undefined);
  previews = atom<string[]>([]);
  showTerminal = atom(false);
  boltTerminal: ITerminal | null = null;

  constructor(filesStore: any) {
    // Implementation details
  }

  setDocuments(files: FileMap) {
    // Implementation details
  }

  updateFile(path: string, content: string) {
    // Implementation details
  }

  updateScrollPosition(path: string, position: ScrollPosition) {
    // Implementation details
  }

  setSelectedFile(path: string | undefined) {
    this.selectedFile.set(path);
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value ?? !this.showTerminal.get());
  }

  attachTerminal(terminal: ITerminal) {
    // Implementation details
  }

  attachBoltTerminal(terminal: ITerminal) {
    this.boltTerminal = terminal;
  }

  onTerminalResize(cols: number, rows: number) {
    // Implementation details
  }
}
