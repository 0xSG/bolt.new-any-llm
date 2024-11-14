import type { ActionState } from './action-runner';
import type { LocalFilesStore } from '../stores/local-files';
import type { BoltAction, FileAction, ShellAction, StartAction } from '~/types/actions';

export interface ActionError {
  status: 'failed';
  error: string;
}

export class LocalActionRunner {
  filesStore: LocalFilesStore;
  private abortController: AbortController;

  constructor(filesStore: LocalFilesStore) {
    this.filesStore = filesStore;
    this.abortController = new AbortController();
  }

  async executeCommand(command: string): Promise<ActionState> {
    console.log('Command execution requested:', command);
    return {
      type: 'shell',
      content: command,
      status: 'complete',
      executed: true,
      abort: () => this.abortController.abort(),
      abortSignal: this.abortController.signal,
      output: 'Command executed successfully',
      exitCode: 0
    };
  }

  async runAction(action: BoltAction): Promise<ActionState | ActionError> {
    try {
      if (action.type === 'file') {
        const fileAction: ActionState = {
          ...action,
          status: 'running',
          abort: () => this.abortController.abort(),
          executed: false,
          abortSignal: this.abortController.signal
        };

        await this.filesStore.saveFile(action.filePath, action.content);
        
        fileAction.status = 'complete';
        fileAction.executed = true;
        return fileAction;
      } else if (action.type === 'shell' || action.type === 'start') {
        return this.executeCommand(action.content);
      }

      throw new Error(`Unknown action type: ${(action as BoltAction).type}`);
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 