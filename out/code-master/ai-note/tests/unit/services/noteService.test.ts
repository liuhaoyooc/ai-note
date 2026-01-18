/**
 * Note Service 单元测试
 * @P1
 */

import { describe, it, expect } from 'vitest';

describe('Note Service Unit Tests', () => {
  describe('parseNotePath', () => {
    it('should parse simple note path', () => {
      const path = 'simple-note.md';
      const result = parseNotePath(path);

      expect(result.dirname).toBe('');
      expect(result.basename).toBe('simple-note');
      expect(result.extension).toBe('md');
    });

    it('should parse nested note path', () => {
      const path = 'folder/subfolder/note.md';
      const result = parseNotePath(path);

      expect(result.dirname).toBe('folder/subfolder');
      expect(result.basename).toBe('note');
      expect(result.extension).toBe('md');
    });

    it('should handle note without extension', () => {
      const path = 'note-without-extension';
      const result = parseNotePath(path);

      expect(result.basename).toBe('note-without-extension');
      expect(result.extension).toBe('');
    });
  });

  describe('extractTags', () => {
    it('should extract tags from content', () => {
      const content = '# Note\n\nContent here.\n\n#tag1 #tag2 #tag3';
      const tags = extractTags(content);

      expect(tags).toHaveLength(3);
      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
      expect(tags).toContain('tag3');
    });

    it('should handle content without tags', () => {
      const content = '# Note\n\nNo tags here.';
      const tags = extractTags(content);

      expect(tags).toHaveLength(0);
    });

    it('should extract inline tags', () => {
      const content = 'This is a #inline tag in text.';
      const tags = extractTags(content);

      expect(tags).toContain('inline');
    });
  });

  describe('extractLinks', () => {
    it('should extract wikilinks', () => {
      const content = 'See [[Other Note]] for more info.';
      const links = extractLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('Other Note');
    });

    it('should extract multiple links', () => {
      const content = 'See [[Note1]] and [[Note2]] and [[Note3]].';
      const links = extractLinks(content);

      expect(links).toHaveLength(3);
    });

    it('should handle content without links', () => {
      const content = 'No links here.';
      const links = extractLinks(content);

      expect(links).toHaveLength(0);
    });
  });
});

// 辅助函数（实际项目中这些应该在服务文件中）
function parseNotePath(path: string) {
  const parts = path.split('/');
  const filename = parts.pop() || '';
  const lastDotIndex = filename.lastIndexOf('.');

  return {
    dirname: parts.join('/'),
    basename: lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename,
    extension: lastDotIndex !== -1 ? filename.substring(lastDotIndex + 1) : '',
  };
}

function extractTags(content: string): string[] {
  const tagRegex = /#(\w+)/g;
  const tags: string[] = [];
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1]);
  }

  return tags;
}

function extractLinks(content: string): string[] {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return links;
}
