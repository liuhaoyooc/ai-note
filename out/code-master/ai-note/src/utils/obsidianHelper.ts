import { Vault, TFile, MetadataCache } from 'obsidian';
import { MetadataCacheHelper } from './metadataCacheHelper';

export class ObsidianHelper {
    private vault: Vault;
    private metadataCache: MetadataCache;
    public metadataCacheHelper: MetadataCacheHelper;

    constructor(vault: Vault, metadataCache: MetadataCache) {
        this.vault = vault;
        this.metadataCache = metadataCache;
        this.metadataCacheHelper = new MetadataCacheHelper(metadataCache);
    }

    async getAllMarkdownFiles(): Promise<TFile[]> {
        return this.vault.getMarkdownFiles();
    }

    async getFileContent(file: TFile): Promise<string> {
        return await this.vault.read(file);
    }

    async createFile(path: string, content: string): Promise<TFile> {
        return await this.vault.create(path, content);
    }

    async modifyFile(file: TFile, content: string): Promise<void> {
        await this.vault.modify(file, content);
    }

    async deleteFile(file: TFile): Promise<void> {
        await this.vault.delete(file);
    }

    async writeFile(path: string, content: string): Promise<void> {
        const file = await this.findFile(path);
        if (file) {
            await this.vault.modify(file, content);
        } else {
            await this.vault.create(path, content);
        }
    }

    async readFile(path: string): Promise<string> {
        const file = await this.findFile(path);
        if (!file) {
            throw new Error(`File not found: ${path}`);
        }
        return await this.vault.read(file);
    }

    async moveFile(file: TFile, newPath: string): Promise<void> {
        await this.vault.rename(file, newPath);
    }

    async createFolder(path: string): Promise<void> {
        const existing = this.vault.getAbstractFileByPath(path);
        if (!existing) {
            await this.vault.createFolder(path);
        }
    }

    async ensureFolderExists(path: string): Promise<any> {
        let folder = this.vault.getAbstractFileByPath(path);

        if (!folder) {
            await this.createFolder(path);
            folder = this.vault.getAbstractFileByPath(path);
        } else if (!folder.children) {
            throw new Error(`Path ${path} exists but is not a folder`);
        }

        return folder;
    }

    getRelativePath(file: TFile, basePath: string): string {
        if (!file.path.startsWith(basePath)) {
            return file.path;
        }
        return file.path.slice(basePath.length).replace(/^\//, '');
    }

    async findFile(path: string): Promise<TFile | null> {
        const file = this.vault.getAbstractFileByPath(path);
        if (!file || file.children) return null;
        return file as TFile;
    }

    async findFolder(path: string): Promise<TFile | null> {
        const folder = this.vault.getAbstractFileByPath(path);
        if (!folder || !folder.children) return null;
        return folder as TFile;
    }

    getFileModificationTime(file: TFile): number {
        return file.stat.mtime;
    }

    getFileSize(file: TFile): number {
        return file.stat.size;
    }
}
