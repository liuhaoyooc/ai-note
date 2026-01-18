import { Modal } from 'obsidian';
import { Notice } from 'obsidian';

export class ArchiveModal extends Modal<string> {
    private onConfirm: (result: string) => void;
    private folders: string[] = [];
    private filePaths: Array<{ path: string; reason: string }> = [];

    constructor(
        app: any,
        filePaths: Array<{ path: string; reason: string }>,
        onConfirm: (result: string) => void
    ) {
        super(app);
        this.onConfirm = onConfirm;
        this.filePaths = filePaths;
        this.folders = filePaths.map(fp => {
            const parts = fp.path.split('/');
            return parts[parts.length - 1];
        });
    }

    onOpen() {
        console.log('[ArchiveModal] Modal opened');
    }

    onClose() {
        console.log('[ArchiveModal] Modal closed');
    }

    submitSelection() {
        const inputEl = this.containerEl.find('.suggestion-input') as HTMLInputElement;
        const result = inputEl.value.trim();
        
        if (!result) {
            new Notice('Please enter a folder name');
            return;
        }
        
        this.onConfirm(result);
        this.close();
    }

    render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Manual Archive' });
        
        const introEl = contentEl.createEl('p', { text: 'Uncertain files found. Please select target folder for each:' });
        contentEl.appendChild(introEl);
        
        const fileListEl = contentEl.createEl('div', { cls: 'file-list' });
        
        for (const fileInfo of this.filePaths) {
            const fileItem = fileListEl.createEl('div', { cls: 'file-item' });
            
            const pathEl = fileItem.createEl('div', { cls: 'file-path' });
            pathEl.createEl('strong', { text: fileInfo.path });
            fileItem.appendChild(pathEl);
            
            const reasonEl = fileItem.createEl('div', { cls: 'file-reason' });
            reasonEl.createEl('span', { text: fileInfo.reason });
            fileItem.appendChild(reasonEl);
            
            fileListEl.appendChild(fileItem);
        }
        
        contentEl.appendChild(fileListEl);
        
        const dividerEl = contentEl.createEl('hr');
        contentEl.appendChild(dividerEl);
        
        const folderSection = contentEl.createEl('div');
        const folderTitle = folderSection.createEl('h3', { text: 'Or create new folder:' });
        folderSection.appendChild(folderTitle);
        
        const inputContainer = folderSection.createEl('div', { cls: 'input-container' });
        const inputEl = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Folder name',
            cls: 'suggestion-input'
        });
        inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Enter') {
                this.submitSelection();
            }
        });
        
        const buttonContainer = inputContainer.createEl('div', { cls: 'button-container' });
        
        const submitBtn = buttonContainer.createEl('button', { text: 'Confirm' });
        submitBtn.onclick = () => this.submitSelection();
        buttonContainer.appendChild(submitBtn);
        
        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();
        buttonContainer.appendChild(cancelBtn);
        
        inputContainer.appendChild(inputEl);
        inputContainer.appendChild(buttonContainer);
        folderSection.appendChild(inputContainer);
        contentEl.appendChild(folderSection);
    }

    getSuggestions(query: string): string[] {
        if (!query) {
            return this.folders;
        }

        const lowerQuery = query.toLowerCase();
        return this.folders.filter(folder => 
            folder.toLowerCase().includes(lowerQuery)
        );
    }
}
