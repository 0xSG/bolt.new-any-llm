import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { LocalActionRunner } from '~/lib/runtime/local-action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import type { FileMap } from './files';
import { LocalFilesStore } from './local-files';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: LocalActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;
type Artifacts = MapStore<Record<string, ArtifactState>>;
export type WorkbenchViewType = 'code' | 'preview';

export class WorkbenchStore {
  filesStore: LocalFilesStore;
  actionRunner: LocalActionRunner;
  editorStore: EditorStore;
  private artifactIdList: string[] = [];

  artifacts = map<Record<string, ArtifactState>>({});
  showWorkbench = atom<boolean>(false);
  currentView = atom<WorkbenchViewType>('code');
  unsavedFiles = atom<Set<string>>(new Set());

  constructor() {
    this.filesStore = new LocalFilesStore();
    this.actionRunner = new LocalActionRunner(this.filesStore);
    this.editorStore = new EditorStore(this.filesStore);
  }

  get previews() {
    return this.editorStore.previews;
  }

  get files() {
    return this.filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.filesStore.filesCount;
  }

  get showTerminal() {
    return this.editorStore.showTerminal;
  }

  get boltTerminal() {
    return this.editorStore.boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.editorStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.editorStore.attachTerminal(terminal);
  }

  attachBoltTerminal(terminal: ITerminal) {
    this.editorStore.attachBoltTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.editorStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.editorStore.setDocuments(files);

    if (this.filesStore.filesCount > 0 && !this.currentDocument.get()) {
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;
    if (!filePath) return;

    const file = this.filesStore.getFile(filePath);
    if (!file || file.type !== 'file') return;

    const originalContent = file.content;
    const unsavedChanges = originalContent !== newContent;

    this.editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();
    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();
      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);
      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();
    if (!editorDocument) return;
    this.editorStore.updateScrollPosition(editorDocument.filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.editorStore.documents.get();
    const document = documents[filePath];
    if (!document) return;

    await this.filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);
    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();
    if (!currentDocument) return;
    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();
    if (!currentDocument) return;

    const file = this.filesStore.getFile(currentDocument.filePath);
    if (!file || file.type !== 'file') return;

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifications() {
    return this.filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.filesStore.resetFileModifications();
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.getArtifact(messageId);
    if (artifact) return;

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new LocalActionRunner(this.filesStore),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.getArtifact(messageId);
    if (!artifact) return;
    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;
    const artifact = this.getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    await artifact.runner.runAction(data.action);
  }

  async runAction(data: ActionCallbackData) {
    const { messageId } = data;
    const artifact = this.getArtifact(messageId);
    if (!artifact) {
      unreachable('Artifact not found');
    }
    await artifact.runner.runAction(data.action);
  }

  private getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }
}

export const workbenchStore = new WorkbenchStore();
