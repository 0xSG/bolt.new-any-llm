import { map } from 'nanostores';
import type { FileMap } from './files';

declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

interface FileSystemEntry {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemHandle extends FileSystemEntry {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemDirectoryHandle extends FileSystemEntry {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemHandle>;
  values(): AsyncIterableIterator<FileSystemHandle | FileSystemDirectoryHandle>;
}

export class LocalFilesStore {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  files = map<FileMap>({});
  private size = 0;
  private modifiedFiles = new Set<string>();

  async initialize() {
    try {
      this.directoryHandle = await window.showDirectoryPicker();
      await this.loadFiles();
    } catch (error) {
      console.error('Failed to initialize directory:', error);
      throw error;
    }
  }

  async loadFiles() {
    if (!this.directoryHandle) return;
    const files: FileMap = {};
    await this.readDirectoryRecursively(this.directoryHandle, '', files);
    this.files.set(files);
    this.size = Object.keys(files).length;
  }

  private async readDirectoryRecursively(
    dirHandle: FileSystemDirectoryHandle,
    path: string,
    files: FileMap
  ) {
    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      
      if (entry.kind === 'directory') {
        files[entryPath] = { type: 'folder' };
        await this.readDirectoryRecursively(
          entry as FileSystemDirectoryHandle,
          entryPath,
          files
        );
      } else {
        const file = await (entry as FileSystemHandle).getFile();
        const content = await file.text();
        files[entryPath] = {
          type: 'file',
          content,
          isBinary: false
        };
      }
    }
  }

  async saveFile(path: string, content: string) {
    if (!this.directoryHandle) throw new Error('Directory not initialized');

    const segments = path.split('/');
    const fileName = segments.pop()!;
    let currentHandle = this.directoryHandle;

    for (const segment of segments) {
      if (segment) {
        currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true });
      }
    }

    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    const files = this.files.get();
    files[path] = { type: 'file', content, isBinary: false };
    this.files.set(files);
    this.modifiedFiles.add(path);
  }

  getFile(path: string) {
    return this.files.get()[path];
  }

  get filesCount() {
    return this.size;
  }

  getFileModifications() {
    return Array.from(this.modifiedFiles);
  }

  resetFileModifications() {
    this.modifiedFiles.clear();
  }
} 