(function() {
  var BUILD_VERSION = '2026.04.04g';
  var CUSTOM_ACTIVITY_STORAGE_KEY = 'time_observer_custom_activities_v1';
  var ACTIVITY_OPTIONS = [
    { value: 'study', label: '学习', icon: '读' },
    { value: 'coding', label: 'coding', icon: '码' },
    { value: 'work', label: '工作', icon: '工' },
    { value: 'exercise', label: '运动', icon: '动' },
    { value: 'social', label: '社交', icon: '聊' },
    { value: 'cook', label: '做饭', icon: '煮' },
    { value: 'rest', label: '休息', icon: '歇' },
    { value: 'nothing', label: '摆烂', icon: '躺' }
  ];
  var ACTIVITY_PALETTES = {
    study: { color: '#8ecda0', soft: '#eef8f2' },
    coding: { color: '#8abde0', soft: '#ecf4fb' },
    work: { color: '#b8a8e0', soft: '#f2eff9' },
    exercise: { color: '#f0a898', soft: '#fdf0ec' },
    social: { color: '#eca8bc', soft: '#fdeef4' },
    cook: { color: '#e8c498', soft: '#faf3ea' },
    rest: { color: '#a0bce0', soft: '#edf3fb' },
    nothing: { color: '#ccc4ba', soft: '#f4f1ed' }
  };

  var STATUS_OPTIONS = {
    energy: [
      { value: '亮', label: '亮', note: '精神提着', soft: '#e8f7da', text: '#5b8d36' },
      { value: '稳', label: '稳', note: '正常平稳', soft: '#e7f2f7', text: '#4b7589' },
      { value: '乏', label: '乏', note: '有点没电', soft: '#f1ede6', text: '#857463' },
      { value: '散', label: '散', note: '注意力飘', soft: '#eceffd', text: '#6d78b1' },
      { value: '焦', label: '焦', note: '心里发紧', soft: '#faece9', text: '#a46863' }
    ],
    mood: [
      { value: '松', label: '松', note: '松一点', soft: '#eaf7ee', text: '#5e8e70' },
      { value: '晴', label: '晴', note: '顺着走', soft: '#fff4d8', text: '#a07d22' },
      { value: '闷', label: '闷', note: '有点堵', soft: '#f0ebf8', text: '#756291' },
      { value: '躁', label: '躁', note: '坐不住', soft: '#fbe8e7', text: '#ad5a56' },
      { value: '空', label: '空', note: '没什么感觉', soft: '#f3f1ed', text: '#7c776f' }
    ],
    body: [
      { value: '轻', label: '轻', note: '状态轻快', soft: '#e5f7f0', text: '#4f8d79' },
      { value: '紧', label: '紧', note: '肩颈发紧', soft: '#f8eee3', text: '#9a7045' },
      { value: '累', label: '累', note: '身体发沉', soft: '#ece7df', text: '#7a6b58' },
      { value: '胀', label: '胀', note: '有点不舒服', soft: '#fff0e2', text: '#b07333' },
      { value: '痛', label: '痛', note: '明确不适', soft: '#fde9ea', text: '#b95a68' }
    ]
  };

  var DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];

  var uiState = {
    activeView: 'today',
    currentDayKey: Storage.getTodayKey()
  };

  var addFormState = getDefaultAddState();
  var pendingConflictPayload = null;

  function getDefaultAddState() {
    return {
      mode: 'quick',
      activity: 'study',
      duration: 45,
      dayKey: Storage.getTodayKey(),
      startTime: '09:00',
      endTime: '10:00',
      tags: '',
      customActivity: '',
      energy: '',
      mood: '',
      body: '',
      note: '',
      noteOpen: false
    };
  }

  function init() {
    // One-time: clear stale E2E test data from localStorage
    if (!localStorage.getItem('_cleared_test_data_v1')) {
      localStorage.removeItem('quiet_life_records_v2');
      localStorage.setItem('_cleared_test_data_v1', '1');
    }
    bindGlobalEvents();
    renderVersionFooter();
    // Show loading state first, then sync, then render
    var root = document.getElementById('main-content');
    root.innerHTML =
      '<div class="page-stack">' +
        '<div class="card empty-card" style="text-align:center;padding:48px 24px;">' +
          '<p class="empty-text">正在同步数据...</p>' +
        '</div>' +
      '</div>';
    updateTopBar(uiState.currentDayKey);
    autoSync(function() {
      renderApp();
    });
  }

  function renderVersionFooter() {
    var footer = document.createElement('div');
    footer.className = 'version-footer';
    footer.id = 'version-footer';
    footer.innerHTML = 'v' + BUILD_VERSION;
    document.body.appendChild(footer);
  }

  function updateVersionFooter(text) {
    var footer = document.getElementById('version-footer');
    if (footer) footer.innerHTML = 'v' + BUILD_VERSION + ' · ' + text;
  }

  function autoSync(onDone) {
    updateVersionFooter('同步中...');
    Sync.fetchAndMerge(function(err) {
      if (err) {
        updateVersionFooter('离线模式');
      } else {
        var now = new Date();
        var timeStr = Storage.pad(now.getHours()) + ':' + Storage.pad(now.getMinutes());
        updateVersionFooter(timeStr + ' 已同步');
      }
      if (onDone) onDone();
    });
  }

  function bindGlobalEvents() {
    document.getElementById('btn-export').addEventListener('click', function() {
      Storage.exportData();
      showToast('已经导出本地数据');
    });
    document.getElementById('btn-sync').addEventListener('click', function() {
      showToast('正在同步...');
      autoSync(function() {
        showToast('已同步');
        renderApp();
      });
    });
    document.getElementById('btn-prev-day').addEventListener('click', function() {
      navigateDay(-1);
    });
    document.getElementById('btn-next-day').addEventListener('click', function() {
      navigateDay(1);
    });
    document.getElementById('btn-today').addEventListener('click', function() {
      uiState.currentDayKey = Storage.getTodayKey();
      renderApp();
    });
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', function(event) {
      if (event.target === this) closeModal();
    });

    document.body.addEventListener('click', function(event) {
      var target = event.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');

      if (action === 'switch-view') {
        uiState.activeView = target.getAttribute('data-view');
        renderApp();
      }

      if (action === 'open-add') {
        openAddModal(target.getAttribute('data-mode') || 'quick');
      }

      if (action === 'delete-event') {
        Storage.deleteEvent(target.getAttribute('data-id'));
        renderApp();
        showToast('这段时间已移除');
      }

      if (action === 'toggle-reminder') {
        var rid = target.getAttribute('data-id');
        var checked = target.getAttribute('data-done') === 'true';
        Storage.updateReminder(rid, { done: !checked });
        renderApp();
      }

      if (action === 'open-journal') {
        openNoteModal('journal');
      }

      if (action === 'open-reminder') {
        openNoteModal('reminder');
      }

      if (action === 'submit-note') {
        var noteType = target.getAttribute('data-note-type');
        var textarea = document.getElementById('note-textarea');
        var text = textarea ? textarea.value.trim() : '';
        if (!text) { showToast('先写点什么'); return; }
        if (noteType === 'journal') {
          Storage.createJournal({ dayKey: uiState.currentDayKey, text: text });
          showToast('已记下');
        } else {
          Storage.createReminder({ dayKey: uiState.currentDayKey, text: text });
          showToast('提醒已添加');
        }
        closeModal();
        renderApp();
      }
    });
  }

  function navigateDay(offset) {
    var parts = uiState.currentDayKey.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + offset);
    uiState.currentDayKey = Storage.getDayKey(date);
    renderApp();
  }

  function renderApp() {
    var root = document.getElementById('main-content');
    var dayKey = uiState.currentDayKey;
    var events = Storage.getEventsByDay(dayKey);
    var summary = Storage.getSummaryByDay(dayKey);
    var journal = Storage.getJournalByDay(dayKey);
    var reminders = Storage.getRemindersByDay(dayKey);
    var review = Storage.getReviewByDay(dayKey);
    var weekDays = Storage.getWeekEvents(dayKey + 'T00:00:00');
    updateTopBar(dayKey);

    root.innerHTML =
      '<div class="page-stack">' +
        renderViewSwitch() +
        (uiState.activeView === 'today'
          ? renderDayView(dayKey, events, summary, journal, reminders, review)
          : renderWeekView(weekDays)) +
      '</div>';
  }

  function updateTopBar(dayKey) {
    var parts = dayKey.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var topDate = document.getElementById('top-date');
    if (topDate) topDate.textContent = formatLongDate(date);

    var todayBtn = document.getElementById('btn-today');
    if (todayBtn) {
      todayBtn.style.display = dayKey === Storage.getTodayKey() ? 'none' : '';
    }
  }

  function renderViewSwitch() {
    return '' +
      '<section class="view-switch">' +
        '<button class="view-tab' + (uiState.activeView === 'today' ? ' is-active' : '') + '" data-action="switch-view" data-view="today">日视图</button>' +
        '<button class="view-tab' + (uiState.activeView === 'week' ? ' is-active' : '') + '" data-action="switch-view" data-view="week">本周</button>' +
      '</section>';
  }

  function renderDayView(dayKey, events, summary, journal, reminders, review) {
    var isToday = dayKey === Storage.getTodayKey();
    return '' +
      renderStatusCard(events, summary, review) +
      renderQuickActions(isToday) +
      renderQuickInput(dayKey) +
      renderRemindersSection(reminders) +
      renderTimeline(events, isToday) +
      renderJournalSection(journal) +
      renderReviewSection(review);
  }

  function renderQuickInput(dayKey) {
    return '' +
      '<section class="quick-input-btns">' +
        '<button class="btn-note is-journal" data-action="open-journal">写点什么</button>' +
        '<button class="btn-note is-reminder" data-action="open-reminder">提醒一下</button>' +
      '</section>';
  }

  function renderQuickActions(isToday) {
    if (isToday) {
      return '' +
        '<section class="quick-actions">' +
          '<button class="btn btn-primary" data-action="open-add" data-mode="quick">记录此刻</button>' +
          '<button class="btn btn-secondary" data-action="open-add" data-mode="manual">补记时间</button>' +
        '</section>';
    }
    return '' +
      '<section class="quick-actions">' +
        '<button class="btn btn-secondary" data-action="open-add" data-mode="manual">补记时间</button>' +
      '</section>';
  }

  function renderStatusCard(events, summary, review) {
    var wakeUpText = '';
    if (review && review.wakeUpMinutes) {
      wakeUpText = '<div class="status-wake">起床时间: ' + escapeHtml(formatTime(review.wakeUpMinutes)) + '</div>';
    }
    return '' +
      '<section class="card status-card">' +
        '<div class="status-card-inner">' +
          '<div class="status-clock-wrap">' +
            renderClockMini(events) +
          '</div>' +
          '<div class="status-info">' +
            '<div class="status-headline">' +
              '今日 ' + escapeHtml(String(summary.eventCount)) + ' 项活动 / ' + escapeHtml(formatDuration(summary.totalMinutes)) +
            '</div>' +
            wakeUpText +
          '</div>' +
        '</div>' +
        renderActivitySummary(events) +
      '</section>';
  }

  function renderClockMini(events) {
    var summary = getSummaryFromEvents(events);
    var gradientStyle = buildConicGradient(events);
    return '' +
      '<div class="clock-face is-small" style="background:' + gradientStyle + ';">' +
        '<div class="clock-core is-small"></div>' +
        renderClockMarkers(true) +
        '<div class="clock-center is-small">' +
          '<div class="clock-total">' + escapeHtml(formatDuration(summary.totalMinutes)) + '</div>' +
          '<div class="clock-caption">已记录</div>' +
        '</div>' +
      '</div>';
  }

  function renderRemindersSection(reminders) {
    if (!reminders.length) return '';
    var html =
      '<section class="card reminder-card">' +
        '<div class="card-header">提醒事项</div>' +
        '<div class="reminder-list">';
    reminders.forEach(function(item) {
      var doneClass = item.done ? ' is-done' : '';
      html +=
        '<div class="reminder-item' + doneClass + '" data-action="toggle-reminder" data-id="' + escapeHtml(item.id) + '" data-done="' + (item.done ? 'true' : 'false') + '">' +
          '<span class="reminder-check">' + (item.done ? '☑' : '☐') + '</span>' +
          '<span class="reminder-text-line">' + escapeHtml(item.text) + '</span>' +
        '</div>';
    });
    html += '</div></section>';
    return html;
  }

  function renderTimeline(events, isToday) {
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">活动时间线</h3>' +
        '</div>';

    if (!events.length) {
      html +=
        '<div class="card empty-card">' +
          '<p class="empty-text">还没有记录，开始你的一天吧。</p>' +
        '</div>';
    } else {
      html += '<div class="event-list">';
      events.forEach(function(event) {
        html += renderEventCard(event);
      });
      html += '</div>';
    }

    html += '</section>';
    return html;
  }

  function renderJournalSection(journal) {
    if (!journal.length) return '';
    var html =
      '<section class="card journal-card">' +
        '<div class="card-header">今日随想</div>' +
        '<div class="journal-list">';
    journal.forEach(function(item) {
      html +=
        '<div class="journal-item">' +
          '<span class="journal-quote">"</span>' +
          '<span class="journal-text">' + escapeHtml(item.text) + '</span>' +
          '<span class="journal-quote">"</span>' +
        '</div>';
    });
    html += '</div></section>';
    return html;
  }

  function renderReviewSection(review) {
    if (!review) return '';
    var html =
      '<section class="card review-card">' +
        '<div class="card-header">每日复盘</div>' +
        '<div class="review-body">';
    if (review.summary) {
      html += '<p class="review-text">' + escapeHtml(review.summary) + '</p>';
    }
    if (review.highlights) {
      html += '<p class="review-highlights">' + escapeHtml(review.highlights) + '</p>';
    }
    html += '</div></section>';
    return html;
  }

  function renderSummaryStrip(summary) {
    return '' +
      '<section class="summary-strip">' +
        renderMetric('片段', summary.eventCount + ' 段', 'is-green') +
        renderMetric('记录', formatDuration(summary.totalMinutes), 'is-blue') +
        renderMetric('留白', formatDuration(summary.blankMinutes), 'is-orange') +
      '</section>';
  }

  function renderMetric(label, value, className) {
    return '' +
      '<div class="metric-card ' + className + '">' +
        '<div class="metric-label">' + escapeHtml(label) + '</div>' +
        '<div class="metric-value">' + escapeHtml(value) + '</div>' +
      '</div>';
  }

  function renderWeekView(weekDays) {
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">本周缩影</h3>' +
        '</div>' +
        '<div class="week-grid">';

    weekDays.forEach(function(day) {
      var summary = getSummaryFromEvents(day.events);
      html +=
        '<article class="card week-card">' +
          '<div class="week-card-head">' +
            '<div class="week-day">' + escapeHtml(formatShortDay(day.dayKey)) + '</div>' +
            '<div class="week-minutes">' + escapeHtml(formatDuration(summary.totalMinutes)) + '</div>' +
          '</div>' +
          renderClockCard(day.events, summary, true) +
        '</article>';
    });

    html += '</div></section>';
    return html;
  }

  function renderClockCard(events, summary, compact) {
    var sizeClass = compact ? ' clock-card-compact' : '';
    var gradientStyle = buildConicGradient(events);
    return '' +
      '<section class="card clock-card' + sizeClass + '">' +
        '<div class="clock-wrap">' +
          '<div class="clock-face' + (compact ? ' is-small' : '') + '" style="background:' + gradientStyle + ';">' +
            '<div class="clock-core' + (compact ? ' is-small' : '') + '"></div>' +
            renderClockMarkers(compact) +
            '<div class="clock-center' + (compact ? ' is-small' : '') + '">' +
              '<div class="clock-total">' + escapeHtml(formatDuration(summary.totalMinutes)) + '</div>' +
              '<div class="clock-caption">' + escapeHtml(compact ? '已记录' : '落在钟面里') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (compact ? '' : renderActivitySummary(events)) +
      '</section>';
  }

  function renderClockMarkers(compact) {
    var labels = ['00', '06', '12', '18'];
    return labels.map(function(label, index) {
      return '<span class="clock-marker marker-' + index + (compact ? ' is-small' : '') + '">' + label + '</span>';
    }).join('');
  }

  function renderActivitySummary(events) {
    if (!events.length) return '';
    var totals = {};
    events.forEach(function(event) {
      totals[event.activity] = (totals[event.activity] || 0) + event.duration;
    });
    return '' +
      '<div class="clock-legend">' +
        Object.keys(totals).map(function(key) {
          var activity = getActivityMeta(key);
          var gradient = getActivityGradient(activity);
          return '' +
            '<div class="legend-chip" style="--legend-bg:' + activity.soft + '; --legend-text:' + activity.color + ';">' +
              '<span class="legend-dot" style="background:linear-gradient(135deg, ' + gradient.from + ', ' + gradient.to + ');"></span>' +
              '<span>' + escapeHtml(activity.label) + ' ' + escapeHtml(formatDuration(totals[key])) + '</span>' +
            '</div>';
        }).join('') +
      '</div>';
  }

  function renderEventCard(event) {
    var statuses = [];
    if (event.energy) statuses.push(renderStatusPill('energy', event.energy));
    if (event.mood) statuses.push(renderStatusPill('mood', event.mood));
    if (event.body) statuses.push(renderStatusPill('body', event.body));
    var tags = Array.isArray(event.tags) ? event.tags.filter(Boolean) : [];

    var meta = getActivityMeta(event.activity);
    var modeLabel = event.inputMode === 'ai' ? 'AI' : (event.inputMode === 'manual' ? '补记' : '刚做完');
    return '' +
      '<article class="card event-card">' +
        '<div class="event-top">' +
          '<div class="event-main">' +
            '<div class="event-type" style="background:' + meta.soft + '; color:' + meta.color + ';">' + escapeHtml(meta.icon) + ' ' + escapeHtml(meta.label) + '</div>' +
            '<div class="event-time">' + formatTime(event.startMinutes) + ' - ' + formatTime(event.endMinutes) + '</div>' +
          '</div>' +
          '<div class="event-side">' +
            '<div class="event-duration">' + escapeHtml(formatDuration(event.duration)) + '</div>' +
            '<div class="event-mode">' + escapeHtml(modeLabel) + '</div>' +
            '<button class="event-delete" data-action="delete-event" data-id="' + escapeHtml(event.id) + '" aria-label="删除">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        (statuses.length ? '<div class="event-status-row">' + statuses.join('') + '</div>' : '') +
        (tags.length ? '<div class="event-tags-row">' + tags.map(function(tag) { return '<span class="event-tag">' + escapeHtml(tag) + '</span>'; }).join('') + '</div>' : '') +
        (event.note ? '<div class="event-note">' + escapeHtml(event.note) + '</div>' : '') +
      '</article>';
  }

  function renderStatusPill(group, value) {
    var option = getStatusOption(group, value);
    if (!option) return '';
    var labelMap = { energy: '精力', mood: '情绪', body: '身体' };
    return '<span class="status-pill" style="background:' + option.soft + '; color:' + option.text + ';">' + escapeHtml(labelMap[group] + ' · ' + option.label) + '</span>';
  }

  function openNoteModal(type) {
    var isJournal = type === 'journal';
    var title = isJournal ? '写点什么' : '提醒一下';
    var placeholder = isJournal ? '此刻的想法、感受、碎碎念...' : '提醒自己要做的事...';
    var btnLabel = isJournal ? '记下来' : '添加提醒';
    setModal(title, '' +
      '<div class="modal-stack">' +
        '<textarea class="text-area" id="note-textarea" maxlength="500" rows="4" placeholder="' + escapeHtml(placeholder) + '" autofocus></textarea>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" data-action="close-modal" onclick="document.getElementById(\'modal-overlay\').classList.remove(\'show\')">取消</button>' +
          '<button class="btn btn-primary" data-action="submit-note" data-note-type="' + type + '">' + escapeHtml(btnLabel) + '</button>' +
        '</div>' +
      '</div>');
    setTimeout(function() {
      var ta = document.getElementById('note-textarea');
      if (ta) ta.focus();
    }, 100);
  }

  function openAddModal(mode) {
    addFormState = getDefaultAddState();
    addFormState.mode = mode || 'quick';
    addFormState.dayKey = uiState.currentDayKey;
    if (addFormState.mode === 'quick') {
      var now = new Date();
      var endMinutes = roundToFive(now.getHours() * 60 + now.getMinutes());
      addFormState.endTime = formatTime(endMinutes);
      addFormState.startTime = formatTime(Math.max(0, endMinutes - addFormState.duration));
    }
    setModal(addFormState.mode === 'manual' ? '补记时间' : '记下一段', renderAddForm());
    bindAddFormEvents();
  }

  function renderAddForm() {
    var primaryFields = addFormState.mode === 'quick'
      ? '<div class="field-group">' +
          '<div class="field-label">活动类型</div>' +
          '<div class="chip-grid activity-grid" id="activity-grid">' + renderActivityChips() + '</div>' +
        '</div>' +
        renderQuickFields()
      : renderManualFields() +
        '<div class="field-group">' +
          '<div class="field-label">活动类型</div>' +
          '<div class="chip-grid activity-grid" id="activity-grid">' + renderActivityChips() + '</div>' +
        '</div>';

    return '' +
      '<form class="modal-stack" id="add-form">' +
        '<div class="mode-switch">' +
          '<button type="button" class="mode-chip' + (addFormState.mode === 'quick' ? ' is-active' : '') + '" data-mode-choice="quick">刚做完</button>' +
          '<button type="button" class="mode-chip' + (addFormState.mode === 'manual' ? ' is-active' : '') + '" data-mode-choice="manual">补记时间</button>' +
        '</div>' +
        primaryFields +
        '<div class="field-group">' +
          '<div class="field-label">自定义活动</div>' +
          '<div class="custom-activity-row">' +
            '<input class="text-input" id="custom-activity-input" type="text" maxlength="12" placeholder="比如：收拾屋子" value="' + escapeHtml(addFormState.customActivity) + '">' +
            '<button type="button" class="btn btn-soft custom-activity-btn" id="add-custom-activity">加入活动</button>' +
          '</div>' +
        '</div>' +
        renderStatusField('energy', '精力') +
        renderStatusField('mood', '情绪') +
        renderStatusField('body', '身体') +
        '<div class="field-group">' +
          '<div class="field-label">自由标签</div>' +
          '<input class="text-input" id="event-tags" type="text" maxlength="40" placeholder="可写多个，用逗号隔开，比如：家务, 清洁" value="' + escapeHtml(addFormState.tags) + '">' +
        '</div>' +
        '<div class="field-group note-group">' +
          '<button type="button" class="text-link" id="toggle-note">' + (addFormState.noteOpen ? '收起备注' : '添加备注') + '</button>' +
          (addFormState.noteOpen
            ? '<textarea class="text-area" id="event-note" maxlength="80" placeholder="一句话就够了"></textarea>'
            : '<input type="hidden" id="event-note" value="' + escapeHtml(addFormState.note) + '">') +
        '</div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" id="cancel-add">取消</button>' +
          '<button type="submit" class="btn btn-primary">' + (addFormState.mode === 'quick' ? '收下这段时间' : '补上这段时间') + '</button>' +
        '</div>' +
      '</form>';
  }

  function renderQuickFields() {
    return '' +
      '<div class="field-group">' +
        '<div class="field-label">刚刚这一段，持续了多久</div>' +
        '<div class="duration-grid" id="duration-grid">' + renderDurationChips() + '</div>' +
        '<input class="custom-duration" id="custom-duration" type="number" min="5" step="5" placeholder="或直接输入分钟数">' +
      '</div>';
  }

  function renderManualFields() {
    return '' +
      '<div class="manual-grid">' +
        '<div class="field-group field-group-date">' +
          '<div class="field-label">补记日期</div>' +
          '<input class="text-input" id="manual-day" type="date" value="' + escapeHtml(addFormState.dayKey) + '">' +
        '</div>' +
        '<div class="time-row">' +
          '<div class="field-group">' +
            '<div class="field-label">开始</div>' +
            '<input class="text-input" id="manual-start" type="time" step="300" value="' + escapeHtml(addFormState.startTime) + '">' +
          '</div>' +
          '<div class="field-group">' +
            '<div class="field-label">结束</div>' +
            '<input class="text-input" id="manual-end" type="time" step="300" value="' + escapeHtml(addFormState.endTime) + '">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="helper-text">把开始和结束填完整就行；如果和已有记录重叠，保存前会提醒你怎么处理。</div>';
  }

  function renderStatusField(group, label) {
    return '' +
      '<div class="field-group">' +
        '<div class="field-label">' + label + '</div>' +
        '<div class="chip-grid status-grid" id="' + group + '-grid">' + renderStatusChips(group) + '</div>' +
      '</div>';
  }

  function renderActivityChips() {
    return getAllActivityOptions().map(function(option) {
      var meta = getActivityMeta(option.value);
      var selected = addFormState.activity === option.value ? ' is-selected' : '';
      return '<button type="button" class="choice-chip' + selected + '" data-activity="' + option.value + '" style="--chip-bg:' + meta.soft + '; --chip-text:' + meta.color + ';">' + escapeHtml(option.label) + '</button>';
    }).join('');
  }

  function renderDurationChips() {
    return DURATION_OPTIONS.map(function(value) {
      var selected = addFormState.duration === value ? ' is-selected' : '';
      return '<button type="button" class="duration-chip' + selected + '" data-duration="' + value + '">' + value + ' 分钟</button>';
    }).join('');
  }

  function renderStatusChips(group) {
    return STATUS_OPTIONS[group].map(function(option) {
      var selected = addFormState[group] === option.value ? ' is-selected' : '';
      return '<button type="button" class="choice-chip status-choice' + selected + '" data-status-group="' + group + '" data-status-value="' + option.value + '" title="' + escapeHtml(option.note) + '" style="--chip-bg:' + option.soft + '; --chip-text:' + option.text + ';">' + escapeHtml(option.label) + '</button>';
    }).join('');
  }

  function bindAddFormEvents() {
    document.getElementById('cancel-add').addEventListener('click', closeModal);
    document.getElementById('event-note').value = addFormState.note;
    document.getElementById('event-tags').addEventListener('input', function() {
      addFormState.tags = this.value;
    });
    document.getElementById('custom-activity-input').addEventListener('input', function() {
      addFormState.customActivity = this.value;
    });
    document.getElementById('add-custom-activity').addEventListener('click', function() {
      var label = document.getElementById('custom-activity-input').value.trim();
      if (!label) {
        showToast('先写一个活动名');
        return;
      }
      addFormState.activity = saveCustomActivity(label);
      addFormState.customActivity = '';
      setModal('记下这一段', renderAddForm());
      bindAddFormEvents();
      showToast('已经加入活动');
    });
    document.getElementById('toggle-note').addEventListener('click', function() {
      addFormState.note = document.getElementById('event-note').value.trim();
      addFormState.tags = document.getElementById('event-tags').value.trim();
      addFormState.customActivity = document.getElementById('custom-activity-input').value.trim();
      addFormState.noteOpen = !addFormState.noteOpen;
      setModal('记下这一段', renderAddForm());
      bindAddFormEvents();
    });

    document.querySelectorAll('[data-mode-choice]').forEach(function(node) {
      node.addEventListener('click', function() {
        addFormState.note = document.getElementById('event-note').value.trim();
        addFormState.tags = document.getElementById('event-tags').value.trim();
        addFormState.customActivity = document.getElementById('custom-activity-input').value.trim();
        addFormState.mode = node.getAttribute('data-mode-choice');
        setModal(addFormState.mode === 'manual' ? '补记时间' : '记下一段', renderAddForm());
        bindAddFormEvents();
      });
    });

    document.getElementById('activity-grid').addEventListener('click', function(event) {
      var target = event.target.closest('[data-activity]');
      if (!target) return;
      addFormState.activity = target.getAttribute('data-activity');
      refreshFormSelections();
    });

    if (addFormState.mode === 'quick') {
      document.getElementById('duration-grid').addEventListener('click', function(event) {
        var target = event.target.closest('[data-duration]');
        if (!target) return;
        addFormState.duration = Number(target.getAttribute('data-duration'));
        document.getElementById('custom-duration').value = '';
        refreshFormSelections();
      });

      document.getElementById('custom-duration').addEventListener('input', function() {
        var value = Number(this.value);
        if (value >= 5) addFormState.duration = roundToFive(value);
        refreshFormSelections();
      });
    } else {
      document.getElementById('manual-day').addEventListener('change', function() {
        addFormState.dayKey = this.value;
      });
      document.getElementById('manual-start').addEventListener('change', function() {
        addFormState.startTime = this.value;
      });
      document.getElementById('manual-end').addEventListener('change', function() {
        addFormState.endTime = this.value;
      });
    }

    ['energy', 'mood', 'body'].forEach(function(group) {
      document.getElementById(group + '-grid').addEventListener('click', function(event) {
        var target = event.target.closest('[data-status-group]');
        if (!target) return;
        var value = target.getAttribute('data-status-value');
        addFormState[group] = addFormState[group] === value ? '' : value;
        refreshFormSelections();
      });
    });

    document.getElementById('add-form').addEventListener('submit', function(event) {
      event.preventDefault();
      submitAddForm();
    });
  }

  function submitAddForm(strategy) {
    addFormState.note = document.getElementById('event-note').value.trim();
    addFormState.tags = document.getElementById('event-tags').value.trim();
    var payload = {
      activity: addFormState.activity,
      note: addFormState.note,
      tags: parseTagInput(addFormState.tags),
      energy: addFormState.energy,
      mood: addFormState.mood,
      body: addFormState.body
    };
    var result;

    if (addFormState.mode === 'quick') {
      payload.duration = addFormState.duration;
      if (!payload.activity || !payload.duration) {
        showToast('先选活动和时长');
        return;
      }
      result = Storage.createEvent(payload, 'quick', strategy);
    } else {
      var startMinutes = parseTime(addFormState.startTime);
      var endMinutes = parseTime(addFormState.endTime);
      if (!addFormState.dayKey || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        showToast('补记需要完整的开始和结束时间');
        return;
      }
      payload.dayKey = addFormState.dayKey;
      payload.startMinutes = startMinutes;
      payload.endMinutes = endMinutes;
      result = Storage.createEvent(payload, 'manual', strategy);
    }

    if (!result.ok && result.overlaps && result.overlaps.length) {
      pendingConflictPayload = result;
      openConflictModal(result);
      return;
    }

    pendingConflictPayload = null;
    closeModal();
    renderApp();
    showToast(strategy === 'replace' ? '已覆盖重叠时间段' : '已经记下这一段');
  }

  function openConflictModal(result) {
    setModal('时间有重叠', '' +
      '<div class="modal-stack">' +
        '<div class="reminder-box">' +
          '<p class="reminder-text">这段时间和已有记录重叠了。你可以覆盖重叠部分，或者保留两条并排存在。</p>' +
          '<div class="conflict-list">' + result.overlaps.map(function(item) {
            return '<div class="conflict-item">' + escapeHtml(formatTime(item.startMinutes) + ' - ' + formatTime(item.endMinutes) + ' · ' + getActivityMeta(item.activity).label) + '</div>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" id="conflict-keep">保留两条</button>' +
          '<button class="btn btn-primary" id="conflict-replace">覆盖重叠</button>' +
        '</div>' +
      '</div>');

    document.getElementById('conflict-keep').addEventListener('click', function() {
      submitAddForm('keep');
    });
    document.getElementById('conflict-replace').addEventListener('click', function() {
      submitAddForm('replace');
    });
  }

  function refreshFormSelections() {
    document.querySelectorAll('[data-activity]').forEach(function(node) {
      node.classList.toggle('is-selected', node.getAttribute('data-activity') === addFormState.activity);
    });
    document.querySelectorAll('[data-duration]').forEach(function(node) {
      node.classList.toggle('is-selected', Number(node.getAttribute('data-duration')) === addFormState.duration);
    });
    document.querySelectorAll('[data-status-group]').forEach(function(node) {
      var group = node.getAttribute('data-status-group');
      var value = node.getAttribute('data-status-value');
      node.classList.toggle('is-selected', addFormState[group] === value);
    });
  }

  function setModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.add('show');
  }

  function closeModal() {
    pendingConflictPayload = null;
    document.getElementById('modal-overlay').classList.remove('show');
    document.getElementById('modal-body').innerHTML = '';
  }

  function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.remove();
    }, 1800);
  }

  function getActivityMeta(value) {
    var base = getAllActivityOptions().find(function(item) {
      return item.value === value;
    }) || ACTIVITY_OPTIONS[0];
    var colors = ACTIVITY_PALETTES[base.value] || buildCustomActivityColors(base.value);
    return {
      value: base.value,
      label: base.label,
      icon: base.icon,
      color: colors.color,
      soft: colors.soft
    };
  }

  function getAllActivityOptions() {
    return ACTIVITY_OPTIONS.concat(readCustomActivities());
  }

  function readCustomActivities() {
    try {
      var raw = localStorage.getItem(CUSTOM_ACTIVITY_STORAGE_KEY);
      var parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed)
        ? parsed.map(function(item) {
            var label = String(item.label || '').trim();
            var value = String(item.value || '').trim();
            if (!label || !value) return null;
            return { value: value, label: label, icon: '签' };
          }).filter(Boolean)
        : [];
    } catch (error) {
      return [];
    }
  }

  function saveCustomActivity(label) {
    var trimmed = String(label || '').trim();
    var value = 'custom_' + trimmed.toLowerCase().replace(/\s+/g, '_');
    var activities = readCustomActivities();
    if (!activities.some(function(item) { return item.value === value; })) {
      activities.push({ value: value, label: trimmed, icon: '签' });
      localStorage.setItem(CUSTOM_ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
    }
    return value;
  }

  function parseTagInput(input) {
    return String(input || '')
      .split(/[，,、]/)
      .map(function(item) { return item.trim(); })
      .filter(Boolean)
      .slice(0, 6);
  }

  function buildCustomActivityColors(seed) {
    var palette = [
      { color: '#a5c0ae', soft: '#f1f7f3' },
      { color: '#b5aed0', soft: '#f5f2fa' },
      { color: '#d1b39e', soft: '#faf3ee' },
      { color: '#a8bacd', soft: '#f1f5f8' }
    ];
    var index = Math.abs(hashString(seed || 'custom')) % palette.length;
    return palette[index];
  }

  function hashString(value) {
    return String(value || '').split('').reduce(function(sum, char) {
      return ((sum << 5) - sum) + char.charCodeAt(0);
    }, 0);
  }

  function getStatusOption(group, value) {
    return STATUS_OPTIONS[group].find(function(item) {
      return item.value === value;
    }) || null;
  }

  function getSummaryFromEvents(events) {
    var totalMinutes = events.reduce(function(sum, item) {
      return sum + item.duration;
    }, 0);
    return {
      totalMinutes: totalMinutes,
      eventCount: events.length,
      blankMinutes: Math.max(0, 24 * 60 - totalMinutes)
    };
  }

  function getActivityGradient(meta) {
    return {
      from: mixHex(meta.color, '#ffffff', 0.2),
      to: meta.color
    };
  }

  function buildConicGradient(events) {
    var trackColor = '#f0ece6';
    if (!events.length) return trackColor;

    var sorted = events.slice().sort(function(a, b) {
      return a.startMinutes - b.startMinutes;
    });

    var stops = [];
    var lastEndDeg = 0;

    sorted.forEach(function(event) {
      var startDeg = (event.startMinutes / 1440) * 360;
      var endDeg = (event.endMinutes / 1440) * 360;
      if (endDeg <= startDeg) return;

      var meta = getActivityMeta(event.activity);
      var baseColor = meta.color;
      var lightColor = mixHex(baseColor, '#ffffff', 0.35);

      // Track gap before this event
      if (startDeg > lastEndDeg + 0.5) {
        stops.push(trackColor + ' ' + lastEndDeg.toFixed(1) + 'deg');
        stops.push(trackColor + ' ' + startDeg.toFixed(1) + 'deg');
      }

      // Activity segment with subtle inner gradient
      stops.push(lightColor + ' ' + startDeg.toFixed(1) + 'deg');
      stops.push(baseColor + ' ' + ((startDeg + endDeg) / 2).toFixed(1) + 'deg');
      stops.push(lightColor + ' ' + endDeg.toFixed(1) + 'deg');

      lastEndDeg = endDeg;
    });

    // Fill remaining with track
    if (lastEndDeg < 359.5) {
      stops.push(trackColor + ' ' + lastEndDeg.toFixed(1) + 'deg');
      stops.push(trackColor + ' 360deg');
    }

    return 'conic-gradient(from 0deg, ' + stops.join(', ') + ')';
  }

  function mixHex(base, target, ratio) {
    var from = hexToRgb(base);
    var to = hexToRgb(target);
    return rgbToHex({
      r: Math.round(from.r + (to.r - from.r) * ratio),
      g: Math.round(from.g + (to.g - from.g) * ratio),
      b: Math.round(from.b + (to.b - from.b) * ratio)
    });
  }

  function hexToRgb(value) {
    var normalized = String(value || '').replace('#', '');
    if (normalized.length !== 6) return { r: 127, g: 127, b: 127 };
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function(part) {
      return Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0');
    }).join('');
  }

  function parseTime(value) {
    if (!value || value.indexOf(':') === -1) return null;
    var parts = value.split(':');
    var hours = Number(parts[0]);
    var minutes = Number(parts[1]);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return roundToFive(hours * 60 + minutes);
  }

  var roundToFive = Storage.roundToFive;

  function formatDuration(minutes) {
    if (!minutes) return '0 分钟';
    if (minutes < 60) return minutes + ' 分钟';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return rest ? hours + ' 小时 ' + rest + ' 分' : hours + ' 小时';
  }

  function formatTime(totalMinutes) {
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    return pad(hours) + ':' + pad(minutes);
  }

  function formatLongDate(date) {
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return date.getFullYear() + ' 年 ' + pad(date.getMonth() + 1) + ' 月 ' + pad(date.getDate()) + ' 日 · ' + weekdays[date.getDay()];
  }

  function formatShortDay(dayKey) {
    var date = new Date(dayKey + 'T00:00:00');
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return pad(date.getMonth() + 1) + '/' + pad(date.getDate()) + ' 周' + weekdays[date.getDay()];
  }

  var pad = Storage.pad;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  init();
})();
