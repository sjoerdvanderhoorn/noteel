# Quick Reference: YAML Frontmatter in Noteel

## Basic Syntax

```yaml
---
title: "Your Note Title"
tags:
  - tag1
  - tag2
categories:
  - category1
star: true
date: 2026-01-27
color: #3b82f6
---
```

## Field Reference

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `title` | String | `"Meeting Notes"` | Note title |
| `tags` | Array | `[work, urgent]` | Filter tags |
| `categories` | Array | `[Projects]` | Broader categories |
| `star` | Boolean | `true` | Mark as important |
| `date` | String | `2026-01-27` | ISO date format |
| `color` | String | `#10b981` | Hex color code |

## Using the UI

### Editing Metadata
When viewing a note, metadata fields appear below the title:
- **Tags**: Enter comma-separated tags
- **Categories**: Enter comma-separated categories
- **Star**: Check to mark as important
- **Color**: Click to choose a color

### Filtering Notes
In the top search bar:
1. **Search box**: Type to search note content
2. **Tag dropdown**: Select a tag to filter
3. **Category dropdown**: Select a category to filter

### Visual Indicators
- **★** = Starred note
- **Blue badges** = Tags
- **Green badges** = Categories
- **Colored left border** = Custom color

### Folder Counts
When filtering, folders show match counts:
- `Work (5)` = 5 matching notes
- Folders with 0 matches are hidden

## Color Suggestions

```yaml
color: #ef4444  # Red - Urgent
color: #3b82f6  # Blue - Info
color: #10b981  # Green - Success
color: #f59e0b  # Yellow - Warning
color: #8b5cf6  # Purple - Ideas
```

## Common Patterns

### Meeting Note
```yaml
---
title: "Team Standup - Jan 27"
tags: [meeting, team, daily]
categories: [Work]
star: false
date: 2026-01-27
color: #3b82f6
---
```

### Important Task
```yaml
---
title: "Urgent Client Request"
tags: [urgent, client, task]
categories: [Work, High-Priority]
star: true
date: 2026-01-27
color: #ef4444
---
```

### Reference Material
```yaml
---
title: "Python Best Practices"
tags: [python, coding, reference]
categories: [Programming, Documentation]
star: true
date: 2026-01-27
color: #10b981
---
```

## Tips

✅ **DO:**
- Use consistent tag names
- Keep categories broad
- Use colors meaningfully
- Star only important notes

❌ **DON'T:**
- Mix tag variations (work vs Work)
- Create too many categories
- Overuse stars (loses meaning)
- Leave fields blank if unused

## Troubleshooting

**Frontmatter not showing?**
- Must start with `---` on first line
- Must end with `---` on its own line
- Check YAML syntax (spacing matters)

**Filters not working?**
- Ensure tags/categories are saved
- Check spelling matches exactly
- Clear browser cache if needed

**Note not appearing in folder?**
- Check if folder has matching notes
- Verify filters are not too restrictive
- Check "show deleted" toggle

---

For detailed documentation, see `FRONTMATTER_GUIDE.md`
