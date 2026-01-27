# YAML Frontmatter Support - Feature Documentation

## Overview

Noteel now supports YAML frontmatter for enhanced note organization and filtering. This allows you to add metadata to your notes including tags, categories, stars, colors, and dates.

## Frontmatter Structure

Add YAML frontmatter at the top of your markdown files:

```yaml
---
title: "My Note Title"
tags:
  - productivity
  - ideas
  - work
categories:
  - Projects
  - Personal
star: true
date: 2026-01-27
color: #3b82f6
---
```

## Supported Fields

### title
- **Type**: String
- **Description**: The title of your note
- **Example**: `title: "Meeting Notes"`

### tags
- **Type**: Array of strings
- **Description**: Tags for categorizing and filtering notes
- **Example**: 
  ```yaml
  tags:
    - important
    - review
    - urgent
  ```

### categories
- **Type**: Array of strings
- **Description**: Broader categories for organizing notes
- **Example**: 
  ```yaml
  categories:
    - Work
    - Personal Development
  ```

### star
- **Type**: Boolean
- **Description**: Mark important notes with a star
- **Values**: `true` or `false`
- **Example**: `star: true`

### date
- **Type**: String (ISO date format recommended)
- **Description**: Date associated with the note
- **Example**: `date: 2026-01-27`

### color
- **Type**: String (hex color code)
- **Description**: Color for visual identification (shown as left border on note cards)
- **Example**: `color: #10b981`

## UI Features

### Editing Frontmatter

When editing a note, you'll see metadata fields below the title:
- **Tags**: Comma-separated list of tags
- **Categories**: Comma-separated list of categories
- **Star**: Checkbox to mark as starred
- **Color**: Color picker for visual identification

### Searching and Filtering

1. **Text Search**: Use the search bar to search note content
2. **Tag Filter**: Select a tag from the "All Tags" dropdown to filter by tag
3. **Category Filter**: Select a category from the "All Categories" dropdown to filter by category
4. **Combined Filtering**: Text search and filters can be combined

### Folder Match Counts

When searching or filtering:
- Each folder displays the number of matching notes in parentheses
- Folders with zero matches are automatically hidden
- Example: `Work (5)` shows 5 matching notes in the Work folder

### Note Card Display

Note cards now show:
- **Star icon (★)**: Displayed next to title for starred notes
- **Tag badges**: Blue pills showing all tags
- **Category badges**: Green pills showing all categories
- **Colored border**: Left border colored based on the color field

## Examples

### Example 1: Work Meeting Note
```yaml
---
title: "Q1 Planning Meeting"
tags:
  - meeting
  - planning
  - q1-2026
categories:
  - Work
  - Strategy
star: true
date: 2026-01-27
color: #ef4444
---

# Q1 Planning Meeting

Key discussion points...
```

### Example 2: Recipe Note
```yaml
---
title: "Chocolate Chip Cookies"
tags:
  - dessert
  - baking
  - quick
categories:
  - Recipes
star: false
date: 2026-01-27
color: #f59e0b
---

# Chocolate Chip Cookies

Ingredients...
```

### Example 3: Task List
```yaml
---
title: "Weekend Projects"
tags:
  - todo
  - home
  - weekend
categories:
  - Personal
  - Tasks
star: true
date: 2026-01-27
color: #8b5cf6
---

# Weekend Projects

- [ ] Fix leaky faucet
- [ ] Paint bedroom
- [ ] Organize garage
```

## Best Practices

1. **Consistent Tagging**: Use consistent tag names across notes (e.g., always use "meeting" instead of mixing "meeting" and "meetings")

2. **Meaningful Categories**: Use broader categories for high-level organization (e.g., Work, Personal, Projects)

3. **Color Coding**: Develop a color system for quick visual identification:
   - Red (#ef4444): Urgent/Important
   - Blue (#3b82f6): General/Info
   - Green (#10b981): Completed/Success
   - Yellow (#f59e0b): In Progress
   - Purple (#8b5cf6): Ideas/Planning

4. **Star Sparingly**: Reserve stars for truly important notes to maintain their significance

5. **Date Format**: Use ISO format (YYYY-MM-DD) for consistency and sorting

## Technical Details

### YAML Parsing
- Frontmatter must be at the very beginning of the file
- Must start and end with `---` on their own lines
- Both array notation `[item1, item2]` and list notation are supported:
  ```yaml
  tags: [tag1, tag2]  # Array notation
  
  # OR
  
  tags:                # List notation
    - tag1
    - tag2
  ```

### Automatic Updates
- Filter dropdowns automatically populate based on all tags/categories in your notes
- Match counts update in real-time as you type or change filters
- Frontmatter is saved automatically when you edit metadata fields

### Backward Compatibility
- Notes without frontmatter continue to work normally
- The title is extracted from the first H1 heading if no frontmatter title exists
- Adding frontmatter to existing notes is seamless

## Keyboard Tips

- **Tab through fields**: Use Tab to move between metadata fields quickly
- **Save automatically**: Changes save after a brief pause in typing
- **Clear filters**: Select "All Tags" or "All Categories" to clear filters

## Future Enhancements

Potential future improvements:
- Multiple tag/category selection
- Custom color presets
- Date-based filtering
- Sort by star, date, or color
- Tag/category management UI
- Bulk metadata editing

---

For more information or to report issues, please refer to the main README.md file.
