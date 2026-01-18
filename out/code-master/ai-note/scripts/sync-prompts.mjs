#!/usr/bin/env node

/**
 * 同步脚本：从 implements/prompts-v3 同步提示词到 src/prompts
 *
 * 这个脚本会：
 * 1. 读取 implements/prompts-v3 中的所有 .md 提示词文件
 * 2. 解析每个文件的 frontmatter（API 配置）和内容
 * 3. 转换为 JSON 格式到 src/prompts/
 * 4. 生成类型定义文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 向上查找项目根目录（通过查找包含 implements 子目录的目录）
 * @param {string} startDir - 开始查找的目录
 * @param {number} maxDepth - 最大向上查找层级
 * @returns {string} 项目根目录
 */
function findProjectRoot(startDir, maxDepth = 5) {
    let currentDir = startDir;
    for (let i = 0; i < maxDepth; i++) {
        const implementsDir = path.join(currentDir, 'implements');
        if (fs.existsSync(implementsDir)) {
            return currentDir;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break; // 到达文件系统根目录
        }
        currentDir = parentDir;
    }
    // 如果找不到，使用当前目录
    return startDir;
}

// scripts 目录的父目录是项目代码目录
const CODE_DIR = path.dirname(__dirname);
// 从代码目录向上查找项目根目录（包含 implements 子目录的目录）
const PROJECT_ROOT = findProjectRoot(CODE_DIR);

const SOURCE_DIR = path.join(PROJECT_ROOT, 'implements/prompts-v3');
const TARGET_DIR = path.join(CODE_DIR, 'src/prompts');
const INDEX_FILE = path.join(TARGET_DIR, 'index.json');
const TYPES_FILE = path.join(TARGET_DIR, 'types.ts');

/**
 * 解析 Markdown 文件的 frontmatter
 */
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]+?)\n---\n([\s\S]+)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { metadata: null, content: content.trim() };
    }

    const metadata = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();

            // 解析数组值
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(v => v.trim());
            }
            // 解析布尔值
            else if (value === 'true') value = true;
            else if (value === 'false') value = false;
            // 解析数字
            else if (!isNaN(value) && value !== '') value = Number(value);

            metadata[key] = value;
        }
    }

    return { metadata, content: match[2].trim() };
}

/**
 * 从文件路径生成提示词 ID
 */
function generatePromptId(filePath) {
    const relativePath = path.relative(SOURCE_DIR, filePath);
    return relativePath.replace(/\//g, '.').replace('.md', '');
}

/**
 * 递归扫描目录中的所有 .md 文件
 */
function scanDirectory(dir, baseDir = dir) {
    const files = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...scanDirectory(fullPath, baseDir));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * 提取变量占位符
 */
function extractVariables(content) {
    const variableRegex = /\{\{([A-Z_]+)\}\}/g;
    const variables = new Set();

    let match;
    while ((match = variableRegex.exec(content)) !== null) {
        variables.add(match[1]);
    }

    return Array.from(variables);
}

/**
 * 主同步函数
 */
function sync() {
    console.log('🔄 同步提示词...');
    console.log(`   源目录: ${SOURCE_DIR}`);
    console.log(`   目标目录: ${TARGET_DIR}`);

    // 确保目标目录存在
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    // 扫描所有提示词文件
    const files = scanDirectory(SOURCE_DIR);

    if (files.length === 0) {
        console.warn('⚠️  未找到提示词文件');
        return;
    }

    console.log(`   找到 ${files.length} 个提示词文件`);

    const prompts = {};

    // 处理每个文件
    for (const file of files) {
        const id = generatePromptId(file);
        const content = fs.readFileSync(file, 'utf-8');
        const { metadata, content: promptContent } = parseFrontmatter(content);
        const variables = extractVariables(promptContent);

        prompts[id] = {
            id,
            content: promptContent,
            variables,
            ...(metadata || {})
        };

        console.log(`   ✓ ${id}`);
    }

    // 写入 index.json
    fs.writeFileSync(INDEX_FILE, JSON.stringify(prompts, null, 2), 'utf-8');
    console.log(`\n✅ 已生成: ${path.relative(CODE_DIR, INDEX_FILE)}`);

    // 生成类型定义
    generateTypes(prompts);

    console.log('\n🎉 同步完成!');
}

/**
 * 生成 TypeScript 类型定义
 */
function generateTypes(prompts) {
    const promptIds = Object.keys(prompts).sort();

    const typeContent = `// 此文件由 scripts/sync-prompts.mjs 自动生成，请勿手动编辑

/**
 * 所有可用的提示词 ID
 */
export type PromptId =
${promptIds.map(id => `    | '${id}'`).join('\n')};

/**
 * 提示词配置
 */
export interface PromptConfig {
    /** 提示词 ID */
    id: string;
    /** 提示词内容模板 */
    content: string;
    /** 变量列表 */
    variables: string[];
    /** API 模型（可选） */
    model?: string;
    /** Temperature（可选） */
    temperature?: number;
    /** Max Tokens（可选） */
    maxTokens?: number;
}

/**
 * 提示词索引
 */
export interface PromptsIndex {
    [key: string]: PromptConfig;
}

/**
 * 变量值的类型
 */
export type PromptVariables = Record<string, string | number | boolean | string[]>;
`;

    fs.writeFileSync(TYPES_FILE, typeContent, 'utf-8');
    console.log(`✅ 已生成: ${path.relative(CODE_DIR, TYPES_FILE)}`);
}

// 运行同步
sync();
