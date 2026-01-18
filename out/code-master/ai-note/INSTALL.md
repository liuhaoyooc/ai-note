# AI Note for Obsidian - Installation Guide

## Project Structure

The plugin has been created at:
```
code-master/ai-note-obsidian/
```

## Installation Steps

1. **Build the plugin** (if not already built):
   ```bash
   cd code-master/ai-note-obsidian
   npm install
   npm run build
   ```

2. **Copy to your Obsidian vault**:
   - Copy the entire `ai-note-obsidian` folder
   - Rename it to `ai-note` (optional)
   - Place it in your vault's `.obsidian/plugins/` directory

   Your vault structure should look like:
   ```
   your-vault/
   ├── .obsidian/
   │   └── plugins/
   │       └── ai-note-obsidian/
   │           ├── main.js
   │           ├── manifest.json
   │           └── ...
   └── (your notes and folders)
   ```

3. **Enable the plugin in Obsidian**:
   - Open your vault in Obsidian
   - Go to Settings > Community Plugins
   - Find "AI Note" in the list
   - Click "Enable"

4. **Configure API Key**:
   - Go to Settings > Community Plugins > AI Note
   - Click on the plugin settings
   - Enter your OpenRouter API Key
   - Save

## Usage Notes

**All Features Auto-Generate Summaries:**

- Archive and Research features automatically run summarization first
- Summaries are cached - only new/changed files are processed
- No manual "Archive files" run needed before using research

**Feature Workflow:**
```
1. Research Command → Auto-summarize → Generate identity → Create reports
2. Archive Command  → Auto-summarize → Classify files → Move to folders
```

## What's Working Now

✅ Plugin infrastructure (main.ts, manifest, build system)
✅ Storage service (data storage in `.ai-note/`)
✅ File operations (Obsidian vault API adapter)
✅ API client (OpenRouter integration)
✅ Commands (5 basic commands registered)
✅ Ribbon icons (3 quick access buttons)
✅ Configuration (plugin settings integration)

## What's Not Yet Implemented

⏳ File archiving (auto-classification and file organization)
⏳ Daily/weekly reviews (change tracking and summary generation)
⏳ Research generation (topic generation and AI reports)
⏳ Identity management (user profile analysis)
⏳ Settings UI (configuration panel)
⏳ Status bar (live status updates)
⏳ Scheduler (automated tasks)

## Next Steps

To implement the remaining features:

1. **Archiving System**:
   - Implement FileManager (file scanning)
   - Port ClassifierService (AI classification)
   - Create ArchiveModal (manual UI)
   - Integrate archiving logic

2. **Review System**:
   - Port DiffService (change detection)
   - Port ReviewService (review generation)
   - Implement snapshot management
   - Create review commands

3. **Research System**:
   - Port IdentityService (user analysis)
   - Port ResearchService (topic generation)
   - Implement topic selection
   - Create research report generation

4. **UI Enhancement**:
   - Create settings panel
   - Add status bar integration
   - Create history viewer modals
   - Add progress indicators

5. **Scheduler**:
   - Implement timer-based task scheduling
   - Add configuration options
   - Handle daily triggers

## Data Storage

All plugin data will be stored in your vault's `.ai-note/` directory:

```
.ai-note/
├── summaries/              # File summary cache
├── folder-summaries/       # Folder theme cache
├── snapshots/              # File snapshots for reviews
├── identity/               # User identity profile
├── reviews/
│   ├── daily/               # Daily review reports
│   └── weekly/              # Weekly review reports
└── research/
    ├── topics/               # Daily candidate topics
    ├── reports/              # Generated research reports
    └── history/              # Research history index
```

## Troubleshooting

**Plugin doesn't appear in settings:**
- Make sure `main.js` exists in the plugin folder
- Check Obsidian developer console for errors (Ctrl+Shift+I)
- Verify `manifest.json` format is correct

**Build errors:**
- Ensure Node.js is installed (v16 or higher)
- Run `npm install` to install dependencies
- Check TypeScript version: `npm list typescript`

**Runtime errors:**
- Check console logs for detailed error messages
- Verify API key is configured
- Ensure `.ai-note/` directory has proper permissions

## Development Mode

For development:
```bash
cd code-master/ai-note-obsidian
npm run dev
```

Then reload the plugin in Obsidian settings to see changes.

## Resources

- [Obsidian Plugin Development](https://docs.obsidian.md/Plugins)
- [OpenRouter API](https://openrouter.ai/)
- Original VSCode Extension: `code-master/ai-note`
