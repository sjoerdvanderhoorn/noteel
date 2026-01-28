const defaultExport = function (Noteel) {
  return function () {
    
    // Load CSS styles
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = './user-folder-example/.noteel/extensions/due-dates/styles.css';
    document.head.appendChild(cssLink);
    
    // State for the extension
    let isCalendarMode = false;
    let calendarViewMode = 'list'; // 'list' or 'calendar'
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    
    // Hook into parseFrontmatter to add dueDate support
    const originalParseFrontmatter = Noteel.parseFrontmatter;
    Noteel.parseFrontmatter = function(content) {
      const result = originalParseFrontmatter(content);
      
      // Add dueDate to frontmatter if not present
      if (!result.frontmatter.dueDate) {
        result.frontmatter.dueDate = "";
      }
      
      // Parse dueDate from YAML if present
      if (!content) return result;
      
      const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (!normalizedContent.startsWith("---\n")) return result;
      
      const endMatch = normalizedContent.indexOf("\n---\n", 4);
      if (endMatch === -1) return result;
      
      const yamlContent = normalizedContent.substring(4, endMatch);
      const lines = yamlContent.split("\n");
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("dueDate:")) {
          result.frontmatter.dueDate = trimmed.substring(8).trim().replace(/^["']|["']$/g, "");
          break;
        }
      }
      
      return result;
    };
    
    // Hook into serializeFrontmatter to add dueDate support
    const serializeFrontmatter = function(frontmatter) {
      if (!frontmatter || Object.keys(frontmatter).length === 0) {
        return "";
      }
      
      const parts = ["---"];
      
      if (frontmatter.title) {
        parts.push(`title: "${frontmatter.title}"`);
      }
      
      if (frontmatter.tags && frontmatter.tags.length > 0) {
        parts.push("tags:");
        frontmatter.tags.forEach(tag => {
          parts.push(`  - ${tag}`);
        });
      }
      
      if (frontmatter.categories && frontmatter.categories.length > 0) {
        parts.push("categories:");
        frontmatter.categories.forEach(cat => {
          parts.push(`  - ${cat}`);
        });
      }
      
      if (frontmatter.star !== undefined && frontmatter.star !== false) {
        parts.push(`star: ${frontmatter.star}`);
      }
      
      if (frontmatter.date) {
        parts.push(`date: ${frontmatter.date}`);
      }
      
      if (frontmatter.color) {
        parts.push(`color: ${frontmatter.color}`);
      }
      
      if (frontmatter.dueDate) {
        parts.push(`dueDate: ${frontmatter.dueDate}`);
      }
      
      parts.push("---");
      return parts.join("\n");
    };
    
    // Hook into the save process to include dueDate
    const originalDebounceSave = window.debounceSave;
    if (originalDebounceSave) {
      // We need to override the debounceSave logic, but since it's a function in app.js,
      // we'll hook into the input event to add dueDate to frontmatter during save
      // This is done by modifying the serializeFrontmatter calls
    }
    
    // Hook into renderEditor to populate the due date input
    const originalRenderEditor = Noteel.ui.renderEditor;
    Noteel.ui.renderEditor = function() {
      originalRenderEditor();
      
      const dueDateInput = document.getElementById('noteDueDateInput');
      if (!dueDateInput) return;
      
      if (Noteel.state.currentFile) {
        const fs = Noteel.loadFs();
        const file = fs.files[Noteel.state.currentFile];
        if (file) {
          const { frontmatter } = Noteel.parseFrontmatter(file.content);
          dueDateInput.value = frontmatter.dueDate || "";
          dueDateInput.disabled = false;
        }
      } else {
        dueDateInput.value = "";
        dueDateInput.disabled = true;
      }
    };
    
    // Add due date input to editor toolbar
    setTimeout(() => {
      const inlineMetadata = document.querySelector('.inline-metadata');
      if (inlineMetadata && !document.getElementById('noteDueDateInput')) {
        const dueDateContainer = document.createElement('div');
        dueDateContainer.className = 'due-date-input-container';
        dueDateContainer.innerHTML = `
          <input 
            id="noteDueDateInput" 
            type="date" 
            class="due-date-input"
            title="Due date"
          />
        `;
        
        const categoriesInput = document.getElementById('noteCategoriesInput');
        if (categoriesInput) {
          categoriesInput.parentNode.insertBefore(dueDateContainer, categoriesInput.nextSibling);
        }
        
        const dueDateInput = document.getElementById('noteDueDateInput');
        if (dueDateInput) {
          dueDateInput.addEventListener('change', () => {
            // Trigger save by dispatching input event on title
            const titleInput = document.getElementById('noteTitleInput');
            if (titleInput) {
              titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          });
        }
      }
    }, 100);
    
    // Hook into the save mechanism to include dueDate in frontmatter
    // We'll intercept calls to serializeFrontmatter
    const originalSerializeFrontmatter = window.serializeFrontmatter;
    if (originalSerializeFrontmatter) {
      window.serializeFrontmatter = function(frontmatter) {
        // Add dueDate from input if it exists
        const dueDateInput = document.getElementById('noteDueDateInput');
        if (dueDateInput && dueDateInput.value && Noteel.state.currentFile) {
          frontmatter.dueDate = dueDateInput.value;
        }
        
        // Use our custom serializer that includes dueDate
        return serializeFrontmatter(frontmatter);
      };
    }
    
    // Add calendar button next to view toggle
    setTimeout(() => {
      const listHeader = document.querySelector('.list-header');
      const viewToggleBtn = document.getElementById('viewToggleBtn');
      
      if (listHeader && viewToggleBtn && !document.getElementById('dueDatesBtn')) {
        const calendarBtn = document.createElement('button');
        calendarBtn.id = 'dueDatesBtn';
        calendarBtn.className = 'ghost icon-btn';
        calendarBtn.title = 'Show Calendar Panel';
        calendarBtn.textContent = '📅';
        calendarBtn.addEventListener('click', toggleCalendarMode);
        
        viewToggleBtn.parentNode.insertBefore(calendarBtn, viewToggleBtn.nextSibling);
      }
    }, 250);
    
    function toggleCalendarMode() {
      isCalendarMode = !isCalendarMode;
      if (isCalendarMode) {
        showCalendarPanel();
      } else {
        hideCalendarPanel();
      }
      updateLayout();
    }
    
    function showCalendarPanel() {
      const noteList = document.getElementById('noteList');
      if (!noteList) return;
      
      noteList.style.display = 'none';
      
      let calendarContainer = document.getElementById('dueDatesCalendarContainer');
      if (!calendarContainer) {
        calendarContainer = document.createElement('div');
        calendarContainer.id = 'dueDatesCalendarContainer';
        calendarContainer.className = 'due-dates-panel';
        noteList.parentNode.insertBefore(calendarContainer, noteList);
      }
      
      renderCalendarContent(calendarContainer);
      calendarContainer.style.display = 'block';
      
      // Hide calendar button
      const calendarBtn = document.getElementById('dueDatesBtn');
      if (calendarBtn) calendarBtn.style.display = 'none';
      
      // Add notes button next to view toggle
      const viewToggleBtn = document.getElementById('viewToggleBtn');
      if (viewToggleBtn && !document.getElementById('dueNotesBtn')) {
        const notesBtn = document.createElement('button');
        notesBtn.id = 'dueNotesBtn';
        notesBtn.className = 'ghost icon-btn';
        notesBtn.title = 'Show Notes Panel';
        notesBtn.textContent = '📝';
        notesBtn.addEventListener('click', () => {
          isCalendarMode = false;
          hideCalendarPanel();
          restoreNormalMode();
        });
        viewToggleBtn.parentNode.insertBefore(notesBtn, viewToggleBtn.nextSibling);
      }
      
      // Update view toggle to switch calendar sub-modes
      if (viewToggleBtn) {
        viewToggleBtn.textContent = calendarViewMode === 'list' ? '⊞' : '☰';
        viewToggleBtn.title = calendarViewMode === 'list' ? 'Switch to calendar view' : 'Switch to list view';
        
        // Override view toggle to switch calendar sub-modes
        const newBtn = viewToggleBtn.cloneNode(true);
        viewToggleBtn.parentNode.replaceChild(newBtn, viewToggleBtn);
        newBtn.addEventListener('click', toggleCalendarViewMode);
        
        // Update the UI reference to point to the new button
        Noteel.ui.viewToggleBtn = newBtn;
      }
    }
    
    function toggleCalendarViewMode() {
      calendarViewMode = calendarViewMode === 'list' ? 'calendar' : 'list';
      const calendarContainer = document.getElementById('dueDatesCalendarContainer');
      if (calendarContainer) {
        renderCalendarContent(calendarContainer);
      }
      
      const viewToggleBtn = document.getElementById('viewToggleBtn');
      if (viewToggleBtn) {
        viewToggleBtn.textContent = calendarViewMode === 'list' ? '⊞' : '☰';
        viewToggleBtn.title = calendarViewMode === 'list' ? 'Switch to calendar view' : 'Switch to list view';
      }
      
      updateLayout();
    }
    
    function renderCalendarContent(container) {
      container.innerHTML = `
        <div class="due-dates-container">
          <div class="due-dates-header">
            <h2>Due Dates</h2>
          </div>
          <div class="due-dates-content" id="dueDatesContent">
            ${calendarViewMode === 'list' ? generateListView() : generateCalendarView()}
          </div>
        </div>
      `;
      
      // Handle month navigation
      const prevBtn = container.querySelector('#prevMonthBtn');
      const nextBtn = container.querySelector('#nextMonthBtn');
      
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          currentMonth--;
          if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
          }
          renderCalendarContent(container);
        });
      }
      
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
          renderCalendarContent(container);
        });
      }
      
      // Handle note clicks
      container.addEventListener('click', (e) => {
        const noteElement = e.target.closest('[data-path]');
        if (noteElement) {
          const path = noteElement.dataset.path;
          Noteel.state.currentFile = path;
          const parts = path.split('/');
          parts.pop();
          Noteel.state.currentFolder = parts.join('/');
          window.location.hash = '#/' + path.replace(/\\.md$/i, '');
          
          // In calendar view mode (like masonry), hide calendar and show editor
          if (calendarViewMode === 'calendar') {
            container.style.display = 'none';
            if (Noteel.ui && Noteel.ui.renderEditor) {
              Noteel.ui.renderEditor();
            }
            const editor = document.querySelector('.editor');
            if (editor) {
              editor.classList.remove('panel-hidden');
              editor.style.display = '';
            }
            const closeEditorBtn = document.getElementById('closeEditorBtn');
            if (closeEditorBtn) closeEditorBtn.style.display = 'block';
          } else {
            // In list mode, just update editor
            if (Noteel.ui && Noteel.ui.renderEditor) {
              Noteel.ui.renderEditor();
            }
          }
          
          updateLayout();
        }
      });
    }
    
    function hideCalendarPanel() {
      const calendarContainer = document.getElementById('dueDatesCalendarContainer');
      if (calendarContainer) {
        calendarContainer.style.display = 'none';
      }
    }
    
    function restoreNormalMode() {
      const noteList = document.getElementById('noteList');
      if (noteList) noteList.style.display = '';
      
      const calendarBtn = document.getElementById('dueDatesBtn');
      if (calendarBtn) calendarBtn.style.display = '';
      
      // Remove notes button
      const notesBtn = document.getElementById('dueNotesBtn');
      if (notesBtn) notesBtn.remove();
      
      // Restore original view toggle behavior
      const viewToggleBtn = document.getElementById('viewToggleBtn');
      if (viewToggleBtn) {
        // Clone to remove all event listeners
        const newBtn = viewToggleBtn.cloneNode(true);
        viewToggleBtn.parentNode.replaceChild(newBtn, viewToggleBtn);
        
        // Re-attach the original view toggle listener from Noteel
        newBtn.addEventListener('click', () => {
          Noteel.state.viewMode = Noteel.state.viewMode === 'list' ? 'masonry' : 'list';
          Noteel.renderAll();
        });
        
        // Update the reference
        Noteel.ui.viewToggleBtn = newBtn;
        
        // Update button state
        newBtn.textContent = Noteel.state.viewMode === 'list' ? '⊞' : '☰';
        newBtn.title = Noteel.state.viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view';
      }
    }
    
    function updateLayout() {
      const layout = document.querySelector('.layout');
      const editor = document.querySelector('.editor');
      const calendarContainer = document.getElementById('dueDatesCalendarContainer');
      
      if (!isCalendarMode || !calendarContainer) {
        // Normal mode - let app handle layout
        return;
      }
      
      // Calendar mode layout
      if (calendarViewMode === 'calendar') {
        // Calendar view mode: like masonry
        if (Noteel.state.currentFile) {
          // Editing: hide calendar, show editor full width
          layout.classList.add('masonry-editing');
          layout.classList.remove('masonry-mode');
          calendarContainer.style.display = 'none';
          if (editor) {
            editor.classList.remove('panel-hidden');
            editor.style.display = '';
          }
        } else {
          // Browsing: show calendar full width
          layout.classList.add('masonry-mode');
          layout.classList.remove('masonry-editing');
          calendarContainer.style.display = 'block';
          if (editor) {
            editor.classList.add('panel-hidden');
          }
        }
      } else {
        // List view mode: like normal list
        layout.classList.remove('masonry-mode');
        layout.classList.remove('masonry-editing');
        calendarContainer.style.display = 'block';
        if (editor) {
          if (Noteel.state.currentFile) {
            editor.classList.remove('panel-hidden');
            editor.style.display = '';
          }
        }
      }
    }
    
    // Get all notes with due dates
    function getNotesWithDueDates() {
      const fs = Noteel.loadFs();
      const notes = [];
      const currentFolder = Noteel.state.currentFolder || '';
      
      Object.keys(fs.files).forEach(path => {
        if (!path.endsWith('.md')) return;
        
        if (currentFolder) {
          const folderPrefix = currentFolder + '/';
          if (!path.startsWith(folderPrefix)) return;
        }
        
        const file = fs.files[path];
        const { frontmatter } = Noteel.parseFrontmatter(file.content);
        
        if (frontmatter.dueDate) {
          notes.push({
            path,
            title: frontmatter.title || path.split('/').pop().replace('.md', ''),
            dueDate: frontmatter.dueDate,
            tags: frontmatter.tags || [],
            categories: frontmatter.categories || [],
            star: frontmatter.star || false,
            color: frontmatter.color || ''
          });
        }
      });
      
      return notes;
    }
    
    // Get all notes (with or without due dates)
    function getAllNotes() {
      const fs = Noteel.loadFs();
      const notes = [];
      const currentFolder = Noteel.state.currentFolder || '';
      
      Object.keys(fs.files).forEach(path => {
        if (!path.endsWith('.md')) return;
        
        if (currentFolder) {
          const folderPrefix = currentFolder + '/';
          if (!path.startsWith(folderPrefix)) return;
        }
        
        const file = fs.files[path];
        const { frontmatter } = Noteel.parseFrontmatter(file.content);
        
        notes.push({
          path,
          title: frontmatter.title || path.split('/').pop().replace('.md', ''),
          dueDate: frontmatter.dueDate || '',
          tags: frontmatter.tags || [],
          categories: frontmatter.categories || [],
          star: frontmatter.star || false,
          color: frontmatter.color || ''
        });
      });
      
      return notes;
    }
    
    // Format date for display
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(dateStr);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
      if (diffDays < 7) return `In ${diffDays} days`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    // Generate calendar view HTML
    function generateCalendarView() {
      const allNotes = getAllNotes();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const notesByDate = {};
      allNotes.forEach(note => {
        if (note.dueDate) {
          if (!notesByDate[note.dueDate]) notesByDate[note.dueDate] = [];
          notesByDate[note.dueDate].push(note);
        }
      });
      
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      
      let html = `
        <div class="due-dates-calendar">
          <div class="calendar-header">
            <button class="calendar-nav-btn" id="prevMonthBtn">◀</button>
            <h3>${monthNames[currentMonth]} ${currentYear}</h3>
            <button class="calendar-nav-btn" id="nextMonthBtn">▶</button>
          </div>
          <div class="calendar-grid">
            <div class="calendar-day-header">Sun</div>
            <div class="calendar-day-header">Mon</div>
            <div class="calendar-day-header">Tue</div>
            <div class="calendar-day-header">Wed</div>
            <div class="calendar-day-header">Thu</div>
            <div class="calendar-day-header">Fri</div>
            <div class="calendar-day-header">Sat</div>
      `;
      
      for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-day calendar-day-empty"></div>';
      }
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        const isToday = dateStr === today.toISOString().split('T')[0];
        const notesForDay = notesByDate[dateStr] || [];
        
        const todayClass = isToday ? 'calendar-day-today' : '';
        const hasNotesClass = notesForDay.length > 0 ? 'calendar-day-has-notes' : '';
        
        html += `<div class="calendar-day ${todayClass} ${hasNotesClass}" data-date="${dateStr}">`;
        html += `<div class="calendar-day-number">${day}</div>`;
        
        if (notesForDay.length > 0) {
          html += `<div class="calendar-day-count">${notesForDay.length} note${notesForDay.length > 1 ? 's' : ''}</div>`;
          html += '<div class="calendar-day-notes">';
          notesForDay.forEach(note => {
            const noteDate = new Date(note.dueDate);
            noteDate.setHours(0, 0, 0, 0);
            const overdueClass = noteDate < today ? 'note-overdue' : '';
            html += `<div class="calendar-note ${overdueClass}" data-path="${note.path}">${note.title}</div>`;
          });
          html += '</div>';
        }
        
        html += '</div>';
      }
      
      html += '</div></div>';
      return html;
    }
    
    // Generate list view HTML
    function generateListView() {
      const notes = getNotesWithDueDates();
      notes.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let html = `<div class="due-dates-list">`;
      
      if (notes.length === 0) {
        html += '<div class="due-dates-empty">No notes with due dates</div>';
      } else {
        notes.forEach(note => {
          const noteDate = new Date(note.dueDate);
          noteDate.setHours(0, 0, 0, 0);
          const isOverdue = noteDate < today;
          const overdueClass = isOverdue ? 'note-overdue' : '';
          
          html += `
            <div class="due-date-item ${overdueClass}" data-path="${note.path}">
              <div class="due-date-item-title">${note.title}</div>
              <div class="due-date-item-date">${formatDate(note.dueDate)}</div>
            </div>
          `;
        });
      }
      
      html += '</div>';
      return html;
    }
    
    // Hook into close editor button for calendar mode
    setTimeout(() => {
      const closeEditorBtn = document.getElementById('closeEditorBtn');
      if (closeEditorBtn) {
        const originalClose = closeEditorBtn.onclick;
        closeEditorBtn.addEventListener('click', () => {
          if (isCalendarMode) {
            setTimeout(() => {
              const calendarContainer = document.getElementById('dueDatesCalendarContainer');
              if (calendarContainer && calendarViewMode === 'calendar') {
                calendarContainer.style.display = 'block';
                updateLayout();
              }
            }, 50);
          }
        });
      }
    }, 500);
    
    // Watch for state changes
    const originalRenderAll = Noteel.renderAll;
    Noteel.renderAll = function() {
      const wasCalendarMode = isCalendarMode;
      const wasCalendarViewMode = calendarViewMode;
      
      originalRenderAll();
      
      if (wasCalendarMode) {
        isCalendarMode = wasCalendarMode;
        calendarViewMode = wasCalendarViewMode;
        setTimeout(() => {
          showCalendarPanel();
          updateLayout();
        }, 50);
      }
    };
  };
}
