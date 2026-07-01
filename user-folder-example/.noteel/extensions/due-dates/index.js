const defaultExport = function (Noteel) {
  return function () {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = './user-folder-example/.noteel/extensions/due-dates/styles.css';
    document.head.appendChild(cssLink);

    let viewMode = 'list';
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    Noteel.addToolbarButton({
      icon: '📅',
      title: 'Due dates',
      onClick: openDueDatesDialog
    });

    function getDueDateNotes() {
      const fs = Noteel.loadFs();
      const notes = [];

      Object.entries(fs.files).forEach(([path, file]) => {
        if (!path.endsWith('.md')) return;
        const { frontmatter } = Noteel.parseFrontmatter(file.content);
        if (!frontmatter.dueDate) return;

        notes.push({
          path,
          title: frontmatter.title || path.split('/').pop().replace(/\.md$/i, ''),
          dueDate: frontmatter.dueDate
        });
      });

      return notes.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }

    function openDueDatesDialog() {
      let dialog = document.getElementById('dueDatesDialog');

      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'dueDatesDialog';
        dialog.className = 'token-dialog due-dates-dialog';
        document.body.appendChild(dialog);
      }

      renderDialog(dialog);
      dialog.showModal();
    }

    function renderDialog(dialog) {
      const notes = getDueDateNotes();
      dialog.innerHTML = `
        <div class="due-dates-container">
          <div class="due-dates-header">
            <h2>Due Dates</h2>
            <div class="due-dates-controls">
              <button id="dueDatesListView" class="due-dates-view-toggle">List</button>
              <button id="dueDatesCalendarView" class="due-dates-view-toggle">Calendar</button>
              <button id="dueDatesClose" class="due-dates-close" type="button">&times;</button>
            </div>
          </div>
          <div class="due-dates-content">
            ${viewMode === 'list' ? renderList(notes) : renderCalendar(notes)}
          </div>
        </div>
      `;

      dialog.querySelector('#dueDatesClose').addEventListener('click', () => dialog.close());
      dialog.querySelector('#dueDatesListView').addEventListener('click', () => {
        viewMode = 'list';
        renderDialog(dialog);
      });
      dialog.querySelector('#dueDatesCalendarView').addEventListener('click', () => {
        viewMode = 'calendar';
        renderDialog(dialog);
      });

      const prev = dialog.querySelector('#prevMonthBtn');
      const next = dialog.querySelector('#nextMonthBtn');
      if (prev) {
        prev.addEventListener('click', () => {
          currentMonth -= 1;
          if (currentMonth < 0) {
            currentMonth = 11;
            currentYear -= 1;
          }
          renderDialog(dialog);
        });
      }
      if (next) {
        next.addEventListener('click', () => {
          currentMonth += 1;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear += 1;
          }
          renderDialog(dialog);
        });
      }

      dialog.querySelectorAll('[data-note-path]').forEach((el) => {
        el.addEventListener('click', () => {
          const path = el.getAttribute('data-note-path');
          if (!path) return;
          const parts = path.split('/');
          parts.pop();
          Noteel.state.currentFolder = parts.join('/');
          Noteel.state.currentFile = path;
          window.location.hash = '#/' + path.replace(/\.md$/i, '');
          Noteel.renderAll();
          dialog.close();
        });
      });
    }

    function renderList(notes) {
      if (notes.length === 0) {
        return '<div class="due-dates-empty">No notes with due dates yet.</div>';
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return `
        <div class="due-dates-list">
          ${notes.map((note) => {
            const dueDate = new Date(note.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const overdueClass = dueDate < today ? 'note-overdue' : '';
            return `
              <div class="due-date-item ${overdueClass}" data-note-path="${note.path}">
                <div class="due-date-item-title">${escapeHtml(note.title)}</div>
                <div class="due-date-item-date">${formatDate(note.dueDate)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderCalendar(notes) {
      const notesByDate = {};
      notes.forEach((note) => {
        if (!notesByDate[note.dueDate]) {
          notesByDate[note.dueDate] = [];
        }
        notesByDate[note.dueDate].push(note);
      });

      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startWeekday = firstDay.getDay();
      const monthName = firstDay.toLocaleString('en-US', { month: 'long' });

      let html = `
        <div class="due-dates-calendar">
          <div class="calendar-header">
            <button id="prevMonthBtn" class="calendar-nav-btn" type="button">◀</button>
            <h3>${monthName} ${currentYear}</h3>
            <button id="nextMonthBtn" class="calendar-nav-btn" type="button">▶</button>
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

      for (let i = 0; i < startWeekday; i++) {
        html += '<div class="calendar-day calendar-day-empty"></div>';
      }

      const todayKey = new Date().toISOString().split('T')[0];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateKey = date.toISOString().split('T')[0];
        const dayNotes = notesByDate[dateKey] || [];
        const hasNotesClass = dayNotes.length ? 'calendar-day-has-notes' : '';
        const todayClass = dateKey === todayKey ? 'calendar-day-today' : '';

        html += `
          <div class="calendar-day ${hasNotesClass} ${todayClass}">
            <div class="calendar-day-number">${day}</div>
            <div class="calendar-day-notes">
              ${dayNotes.slice(0, 3).map((note) => (
                `<div class="calendar-note" data-note-path="${note.path}">${escapeHtml(note.title)}</div>`
              )).join('')}
            </div>
          </div>
        `;
      }

      html += '</div></div>';
      return html;
    }

    function formatDate(value) {
      const date = new Date(value);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };
}
