(function() {
  var ACTIVITY_OPTIONS = [
    { value: 'study', label: '学习', icon: '读', color: '#9bc38a', soft: '#eef7e8' },
    { value: 'coding', label: 'coding', icon: '码', color: '#8bb4c7', soft: '#eaf4f8' },
    { value: 'work', label: '工作', icon: '工', color: '#7f97c6', soft: '#edf1fb' },
    { value: 'exercise', label: '运动', icon: '动', color: '#d7b56d', soft: '#fcf5e4' },
    { value: 'social', label: '社交', icon: '聊', color: '#d4a0a0', soft: '#fbefef' },
    { value: 'cook', label: '做饭', icon: '煮', color: '#d4a373', soft: '#fbf0e6' },
    { value: 'rest', label: '休息', icon: '歇', color: '#b8b2c9', soft: '#f3f0f8' },
    { value: 'nothing', label: '摆烂', icon: '躺', color: '#b7b0a5', soft: '#f2eee8' }
  ];

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
  var HIGH_SPEND_LOCATIONS = ['mall', 'street', 'district'];
  var UI_COPY = {
    todayTitle: '已记录',
    todayNote: '先把已经发生的留在这里',
    quickAction: '记录一下',
    manualAction: '补记时间',
    detailsTitle: '时间线',
    detailsNote: '今天的时间流',
    plannedTitle: '出门前',
    plannedNote: '留一个轻提醒'
  };

  var uiState = {
    activeView: 'today',
    addMode: 'quick'
  };

  var addFormState = getDefaultAddState();
  var pendingConflictPayload = null;
  var outingState = {
    location: '',
    note: ''
  };

  function getDefaultAddState() {
    return {
      mode: 'quick',
      activity: 'study',
      duration: 45,
      dayKey: Storage.getTodayKey(),
      startTime: '09:00',
      endTime: '10:00',
      energy: '',
      mood: '',
      body: '',
      note: ''
    };
  }

  function init() {
    renderApp();
    bindGlobalEvents();
  }

  function bindGlobalEvents() {
    document.getElementById('btn-export').addEventListener('click', function() {
      Storage.exportData();
      showToast('已经导出本地数据');
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

      if (action === 'open-outing') {
        openOutingModal();
      }
    });
  }

  function renderApp() {
    var root = document.getElementById('main-content');
    var summary = Storage.getTodaySummary();
    var todayEvents = Storage.getTodayEvents();
    var weekDays = Storage.getWeekEvents();
    var recentOuting = Storage.getRecentOuting();
    updateTopBar();

    root.innerHTML =
      '<div class="page-stack">' +
        renderViewSwitch() +
        (uiState.activeView === 'today'
          ? renderTodayView(todayEvents, summary, recentOuting)
          : renderWeekView(weekDays)) +
      '</div>';
  }

  function updateTopBar() {
    var topDate = document.getElementById('top-date');
    if (!topDate) return;
    topDate.textContent = formatLongDate(new Date());
  }

  function renderMetric(label, value, className) {
    return '' +
      '<div class="metric-card ' + className + '">' +
        '<div class="metric-label">' + escapeHtml(label) + '</div>' +
        '<div class="metric-value">' + escapeHtml(value) + '</div>' +
      '</div>';
  }

  function renderViewSwitch() {
    return '' +
      '<section class="view-switch">' +
        '<button class="view-tab' + (uiState.activeView === 'today' ? ' is-active' : '') + '" data-action="switch-view" data-view="today">今日</button>' +
        '<button class="view-tab' + (uiState.activeView === 'week' ? ' is-active' : '') + '" data-action="switch-view" data-view="week">本周</button>' +
      '</section>';
  }

  function renderTodayView(events, summary, recentOuting) {
    return '' +
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">' + UI_COPY.todayTitle + '</h3>' +
          '<div class="section-note">' + UI_COPY.todayNote + '</div>' +
        '</div>' +
        renderClockCard(events, summary, false) +
        '<div class="dual-actions">' +
          '<button class="btn btn-primary" data-action="open-add" data-mode="quick">' + UI_COPY.quickAction + '</button>' +
          '<button class="btn btn-secondary" data-action="open-add" data-mode="manual">' + UI_COPY.manualAction + '</button>' +
        '</div>' +
        renderPlannedSection(recentOuting) +
        renderEventList(events) +
        renderSummaryStrip(summary) +
      '</section>';
  }

  function renderSummaryStrip(summary) {
    return '' +
      '<section class="summary-strip">' +
        renderMetric('片段', summary.eventCount + ' 段', 'is-green') +
        renderMetric('记录', formatDuration(summary.totalMinutes), 'is-blue') +
        renderMetric('留白', formatDuration(summary.blankMinutes), 'is-orange') +
      '</section>';
  }

  function renderWeekView(weekDays) {
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">本周缩影</h3>' +
          '<div class="section-note">七个小钟面，快速看清这一周的时间纹理</div>' +
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
    var gradient = buildClockGradient(events);
    var sizeClass = compact ? ' clock-card-compact' : '';
    return '' +
      '<section class="card clock-card' + sizeClass + '">' +
        '<div class="clock-wrap">' +
          '<div class="clock-face' + (compact ? ' is-small' : '') + '" style="background:' + escapeHtml(gradient) + ';">' +
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
    if (!events.length) {
      return '' +
        '<div class="clock-legend empty-legend">' +
          '<div class="legend-empty-title">钟面还是空的</div>' +
          '<div class="legend-empty-text">刚做完就记时长，想起来晚了就补开始和结束时间。</div>' +
        '</div>';
    }

    var totals = {};
    events.forEach(function(event) {
      totals[event.activity] = (totals[event.activity] || 0) + event.duration;
    });

    return '' +
      '<div class="clock-legend">' +
        Object.keys(totals).map(function(key) {
          var activity = getActivityMeta(key);
          return '' +
            '<div class="legend-chip" style="--legend-bg:' + activity.soft + '; --legend-text:' + activity.color + ';">' +
              '<span class="legend-dot" style="background:' + activity.color + ';"></span>' +
              '<span>' + escapeHtml(activity.label) + ' ' + escapeHtml(formatDuration(totals[key])) + '</span>' +
            '</div>';
        }).join('') +
      '</div>';
  }

  function renderEventList(events) {
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">' + UI_COPY.detailsTitle + '</h3>' +
          '<div class="section-note">' + UI_COPY.detailsNote + '</div>' +
        '</div>';

    if (!events.length) {
      html +=
        '<div class="card empty-card">' +
          '<p class="empty-title">今天还没有时间块</p>' +
          '<p class="empty-text">记录一段刚刚结束的事情，或者补上一段晚一点才想起来的时间。</p>' +
        '</div>';
      return html + '</section>';
    }

    html += '<div class="event-list">';
    events.forEach(function(event) {
      html += renderEventCard(event);
    });
    html += '</div></section>';
    return html;
  }

  function renderEventCard(event) {
    var statuses = [];
    if (event.energy) statuses.push(renderStatusPill('energy', event.energy));
    if (event.mood) statuses.push(renderStatusPill('mood', event.mood));
    if (event.body) statuses.push(renderStatusPill('body', event.body));

    var meta = getActivityMeta(event.activity);
    return '' +
      '<article class="card event-card">' +
        '<div class="event-top">' +
          '<div class="event-main">' +
            '<div class="event-type" style="background:' + meta.soft + '; color:' + meta.color + ';">' + escapeHtml(meta.icon) + ' ' + escapeHtml(meta.label) + '</div>' +
            '<div class="event-time">' + formatTime(event.startMinutes) + ' - ' + formatTime(event.endMinutes) + '</div>' +
          '</div>' +
          '<div class="event-side">' +
            '<div class="event-duration">' + escapeHtml(formatDuration(event.duration)) + '</div>' +
            '<div class="event-mode">' + (event.inputMode === 'manual' ? '补记' : '刚做完') + '</div>' +
            '<button class="event-delete" data-action="delete-event" data-id="' + escapeHtml(event.id) + '" aria-label="删除">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        (statuses.length ? '<div class="event-status-row">' + statuses.join('') + '</div>' : '') +
        (event.note ? '<div class="event-note">' + escapeHtml(event.note) + '</div>' : '') +
      '</article>';
  }

  function renderStatusPill(group, value) {
    var option = getStatusOption(group, value);
    if (!option) return '';
    var labelMap = { energy: '精力', mood: '情绪', body: '身体' };
    return '<span class="status-pill" style="background:' + option.soft + '; color:' + option.text + ';">' + escapeHtml(labelMap[group] + ' · ' + option.label) + '</span>';
  }

  function openAddModal(mode) {
    addFormState = getDefaultAddState();
    addFormState.mode = mode || 'quick';
    uiState.addMode = addFormState.mode;
    if (addFormState.mode === 'quick') {
      var now = new Date();
      var endMinutes = roundToFive(now.getHours() * 60 + now.getMinutes());
      addFormState.endTime = formatTime(endMinutes);
      addFormState.startTime = formatTime(Math.max(0, endMinutes - addFormState.duration));
    }
    setModal('记下这一段', renderAddForm());
    bindAddFormEvents();
  }

  function renderAddForm() {
    return '' +
      '<form class="modal-stack" id="add-form">' +
        '<div class="mode-switch">' +
          '<button type="button" class="mode-chip' + (addFormState.mode === 'quick' ? ' is-active' : '') + '" data-mode-choice="quick">刚做完</button>' +
          '<button type="button" class="mode-chip' + (addFormState.mode === 'manual' ? ' is-active' : '') + '" data-mode-choice="manual">补记</button>' +
        '</div>' +
        '<div class="field-group">' +
          '<div class="field-label">活动类型</div>' +
          '<div class="chip-grid" id="activity-grid">' + renderActivityChips() + '</div>' +
        '</div>' +
        (addFormState.mode === 'quick' ? renderQuickFields() : renderManualFields()) +
        renderStatusField('energy', '精力') +
        renderStatusField('mood', '情绪') +
        renderStatusField('body', '身体') +
        '<div class="field-group">' +
          '<div class="field-label">备注</div>' +
          '<textarea class="text-area" id="event-note" maxlength="80" placeholder="一句话就够了"></textarea>' +
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
        '<div class="helper-text">系统会把这一段默认贴近现在，再和今天其他时间块一起组成完整钟面。</div>' +
      '</div>';
  }

  function renderManualFields() {
    return '' +
      '<div class="field-group">' +
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
      '<div class="helper-text">如果和已有时间段重叠，保存前会提醒你是覆盖还是保留。</div>';
  }

  function renderStatusField(group, label) {
    return '' +
      '<div class="field-group">' +
        '<div class="field-label">' + label + '</div>' +
        '<div class="chip-grid" id="' + group + '-grid">' + renderStatusChips(group) + '</div>' +
      '</div>';
  }

  function renderActivityChips() {
    return ACTIVITY_OPTIONS.map(function(option) {
      var selected = addFormState.activity === option.value ? ' is-selected' : '';
      return '<button type="button" class="choice-chip' + selected + '" data-activity="' + option.value + '" style="--chip-bg:' + option.soft + '; --chip-text:' + option.color + ';">' + escapeHtml(option.label) + '</button>';
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

    document.querySelectorAll('[data-mode-choice]').forEach(function(node) {
      node.addEventListener('click', function() {
        addFormState.note = document.getElementById('event-note').value.trim();
        addFormState.mode = node.getAttribute('data-mode-choice');
        uiState.addMode = addFormState.mode;
        setModal('记下这一段', renderAddForm());
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
    var payload = {
      activity: addFormState.activity,
      note: addFormState.note,
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

  function renderPlannedSection(recentOuting) {
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">' + UI_COPY.plannedTitle + '</h3>' +
          '<div class="section-note">' + UI_COPY.plannedNote + '</div>' +
        '</div>' +
        '<div class="card outing-card">' +
          '<div>' +
            '<p class="outing-title">出门前记一下</p>' +
            '<p class="outing-text">如果去的是高消费区，会在行动前给你一个不带评判的小提醒。</p>' +
          '</div>' +
          '<button class="btn btn-soft" data-action="open-outing">去之前记一下</button>' +
        '</div>';

    if (recentOuting) {
      html += '<div class="last-reminder">' + escapeHtml(renderOutingSummary(recentOuting)) + '</div>';
    }

    return html + '</section>';
  }

  function renderOutingSummary(outing) {
    var locationMap = {
      home: '在家附近',
      office: '公司周边',
      mall: '商场',
      street: '商业街',
      district: '商业区',
      park: '公园',
      friend: '朋友那边'
    };
    var decisionMap = {
      browse: '只是逛逛',
      buy: '准备买点东西',
      continue: '继续购买',
      rethink: '再想想',
      direct: '直接出门'
    };
    return '最近一次提醒：' + (locationMap[outing.location] || outing.location) + ' · ' + (decisionMap[outing.decision] || outing.decision);
  }

  function openOutingModal() {
    outingState = { location: '', note: '' };
    setModal('出门前记录', renderOutingForm());
    bindOutingFormEvents();
  }

  function renderOutingForm() {
    return '' +
      '<form class="modal-stack" id="outing-form">' +
        '<div class="field-group">' +
          '<div class="field-label">这次要去哪里</div>' +
          '<select class="select-input" id="outing-location">' +
            '<option value="">选择一个地点</option>' +
            '<option value="home">在家附近</option>' +
            '<option value="office">公司周边</option>' +
            '<option value="mall">商场</option>' +
            '<option value="street">商业街</option>' +
            '<option value="district">商业区</option>' +
            '<option value="park">公园</option>' +
            '<option value="friend">朋友那边</option>' +
          '</select>' +
        '</div>' +
        '<div class="field-group">' +
          '<div class="field-label">一句备注</div>' +
          '<input class="text-input" id="outing-note" maxlength="40" placeholder="可选，比如顺路买点东西">' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" id="cancel-outing">取消</button>' +
          '<button type="submit" class="btn btn-primary">继续</button>' +
        '</div>' +
      '</form>';
  }

  function bindOutingFormEvents() {
    document.getElementById('cancel-outing').addEventListener('click', closeModal);
    document.getElementById('outing-form').addEventListener('submit', function(event) {
      event.preventDefault();
      outingState.location = document.getElementById('outing-location').value;
      outingState.note = document.getElementById('outing-note').value.trim();
      if (!outingState.location) {
        showToast('先选一个地点');
        return;
      }
      if (HIGH_SPEND_LOCATIONS.indexOf(outingState.location) !== -1) {
        openReminderLevelOne();
      } else {
        Storage.createOuting({
          location: outingState.location,
          note: outingState.note,
          decision: 'direct',
          reminderStage: 0
        });
        closeModal();
        renderApp();
        showToast('已经记下这次出门');
      }
    });
  }

  function openReminderLevelOne() {
    setModal('先确认一下', '' +
      '<div class="modal-stack">' +
        '<div class="reminder-box">' +
          '<h3 class="reminder-title">先确认一下</h3>' +
          '<p class="reminder-text">这里是高消费区，你是来逛，还是准备买点东西？</p>' +
          '<div class="tiny-note">只是提醒，不带评价。</div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" id="outing-browse">我只是逛逛</button>' +
          '<button class="btn btn-primary" id="outing-buy">我打算买</button>' +
        '</div>' +
      '</div>');

    document.getElementById('outing-browse').addEventListener('click', function() {
      Storage.createOuting({
        location: outingState.location,
        note: outingState.note,
        decision: 'browse',
        reminderStage: 1
      });
      closeModal();
      renderApp();
      showToast('好的，轻松去逛逛');
    });

    document.getElementById('outing-buy').addEventListener('click', openReminderLevelTwo);
  }

  function openReminderLevelTwo() {
    setModal('再停一下', '' +
      '<div class="modal-stack">' +
        '<div class="reminder-box">' +
          '<p class="reminder-text">这件东西 ≈ 一顿在家火锅（约250元）</p>' +
          '<div class="reminder-highlight">你更想要：一个短暂的满足，还是一顿稳定的快乐？</div>' +
          '<div class="tiny-note">不阻止你，只给你一个停顿。</div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" id="outing-rethink">再想想</button>' +
          '<button class="btn btn-primary" id="outing-continue">继续购买</button>' +
        '</div>' +
      '</div>');

    document.getElementById('outing-rethink').addEventListener('click', function() {
      Storage.createOuting({
        location: outingState.location,
        note: outingState.note,
        decision: 'rethink',
        reminderStage: 2
      });
      closeModal();
      renderApp();
      showToast('好，先把这个念头放一放');
    });

    document.getElementById('outing-continue').addEventListener('click', function() {
      Storage.createOuting({
        location: outingState.location,
        note: outingState.note,
        decision: 'continue',
        reminderStage: 2
      });
      closeModal();
      renderApp();
      showToast('收到，继续就好');
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
    return ACTIVITY_OPTIONS.find(function(item) {
      return item.value === value;
    }) || ACTIVITY_OPTIONS[0];
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

  function buildClockGradient(events) {
    if (!events.length) {
      return 'conic-gradient(from -90deg, rgba(238,235,228,0.85) 0deg 360deg)';
    }

    var segments = [];
    events.forEach(function(event) {
      var meta = getActivityMeta(event.activity);
      var start = (event.startMinutes / 1440) * 360;
      var end = (event.endMinutes / 1440) * 360;
      segments.push(meta.color + ' ' + start + 'deg ' + end + 'deg');
    });
    segments.push('rgba(238,235,228,0.72) 0deg 360deg');
    return 'conic-gradient(from -90deg, ' + segments.join(', ') + ')';
  }

  function parseTime(value) {
    if (!value || value.indexOf(':') === -1) return null;
    var parts = value.split(':');
    var hours = Number(parts[0]);
    var minutes = Number(parts[1]);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return roundToFive(hours * 60 + minutes);
  }

  function roundToFive(minutes) {
    return Math.max(0, Math.min(1440, Math.round(minutes / 5) * 5));
  }

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

  function pad(value) {
    return String(value).padStart(2, '0');
  }

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
