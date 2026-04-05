(function() {
  var BUILD_VERSION = '2026.04.05b';
  var CUSTOM_ACTIVITY_STORAGE_KEY = 'time_observer_custom_activities_v1';

  var ACTIVITY_OPTIONS = [
    { value: 'study', label: '学习', icon: '读' },
    { value: 'coding', label: '编码', icon: '码' },
    { value: 'work', label: '工作', icon: '工' },
    { value: 'exercise', label: '运动', icon: '动' },
    { value: 'social', label: '社交', icon: '聊' },
    { value: 'cook', label: '做饭', icon: '煮' },
    { value: 'rest', label: '休息', icon: '歇' },
    { value: 'nothing', label: '放空', icon: '云' }
  ];

  var ACTIVITY_PALETTES = {
    study: { color: '#607E54', soft: '#EEF3E5' },
    coding: { color: '#4D6F9A', soft: '#EAF0F8' },
    work: { color: '#8A6A9E', soft: '#F2ECF8' },
    exercise: { color: '#B46A51', soft: '#F9EDE8' },
    social: { color: '#B06A77', soft: '#F8EBEF' },
    cook: { color: '#B9893E', soft: '#FBF1E1' },
    rest: { color: '#567A7A', soft: '#E8F2F1' },
    nothing: { color: '#7A746B', soft: '#F1EEEA' }
  };

  var STATUS_OPTIONS = {
    energy: [
      { value: '亮', label: '亮', note: '精神提着', soft: '#EEF6DF', text: '#668A3E' },
      { value: '稳', label: '稳', note: '正常平稳', soft: '#E8F1F8', text: '#496B86' },
      { value: '乏', label: '乏', note: '有点没电', soft: '#F1ECE4', text: '#7D6B57' },
      { value: '散', label: '散', note: '注意力飘', soft: '#ECEEFA', text: '#6771A0' },
      { value: '焦', label: '焦', note: '心里发紧', soft: '#FAECE9', text: '#A2625A' }
    ],
    mood: [
      { value: '松', label: '松', note: '松一点', soft: '#EAF6EF', text: '#5C876B' },
      { value: '晴', label: '晴', note: '顺着走', soft: '#FFF4D9', text: '#A07A23' },
      { value: '闷', label: '闷', note: '有点堵', soft: '#F0EAF8', text: '#735F94' },
      { value: '躁', label: '躁', note: '坐不住', soft: '#FBE9E7', text: '#A75854' },
      { value: '空', label: '空', note: '没什么感觉', soft: '#F2EFEB', text: '#78726A' }
    ],
    body: [
      { value: '轻', label: '轻', note: '状态轻快', soft: '#E7F5F0', text: '#4E8774' },
      { value: '紧', label: '紧', note: '肩颈发紧', soft: '#F7EDE1', text: '#9A6F44' },
      { value: '累', label: '累', note: '身体发沉', soft: '#ECE6DE', text: '#786958' },
      { value: '胀', label: '胀', note: '有点不舒服', soft: '#FFF0E2', text: '#B07231' },
      { value: '痛', label: '痛', note: '明确不适', soft: '#FCE8EA', text: '#B55B68' }
    ]
  };

  var DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];
  var TAG_COLOR_OPTIONS = [
    { value: '#607E54', label: '苔绿' },
    { value: '#4D6F9A', label: '远山蓝' },
    { value: '#8A6A9E', label: '雾紫' },
    { value: '#B46A51', label: '陶土' },
    { value: '#B9893E', label: '麦金' },
    { value: '#567A7A', label: '松烟青' }
  ];

  var MEAL_TYPE_META = {
    breakfast: { label: '早餐', accent: '#D5A95E', soft: '#FBF2E4' },
    lunch: { label: '午餐', accent: '#6D9560', soft: '#EEF5E8' },
    dinner: { label: '晚餐', accent: '#7B6AA6', soft: '#F2EEFA' },
    snack: { label: '加餐', accent: '#B56F63', soft: '#F9ECE8' }
  };

  var uiState = {
    activeView: 'today',
    currentDayKey: Storage.getTodayKey()
  };

  var addFormState = getDefaultAddState();
  var pendingConflictPayload = null;
  var backgroundSyncTimer = null;

  function getDefaultAddState() {
    return {
      mode: 'quick',
      activity: 'study',
      duration: 45,
      dayKey: Storage.getTodayKey(),
      startTime: '09:00',
      endTime: '10:00',
      customActivity: '',
      energy: '',
      mood: '',
      body: '',
      note: '',
      noteOpen: false,
      selectedTagIds: [],
      newTagText: '',
      newTagColor: TAG_COLOR_OPTIONS[0].value
    };
  }

  function init() {
    bindGlobalEvents();
    bindBackgroundSyncEvents();
    renderVersionFooter();

    var root = document.getElementById('main-content');
    root.innerHTML =
      '<div class="page-stack">' +
        '<div class="surface-card loading-card">' +
          '<p class="empty-text">正在同步数据...</p>' +
        '</div>' +
      '</div>';
    updateTopBar(uiState.currentDayKey);
    autoSync(function() {
      startBackgroundSync();
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
        updateVersionFooter(Storage.pad(now.getHours()) + ':' + Storage.pad(now.getMinutes()) + ' 已同步');
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
        renderApp();
        showToast('已同步');
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
        return;
      }

      if (action === 'open-add') {
        openAddModal(target.getAttribute('data-mode') || 'quick');
        return;
      }

      if (action === 'delete-event') {
        Storage.deleteEvent(target.getAttribute('data-id'));
        renderApp();
        showToast('这段时间已移除');
        return;
      }

      if (action === 'toggle-reminder') {
        var reminderId = target.getAttribute('data-id');
        var checked = target.getAttribute('data-done') === 'true';
        Storage.updateReminder(reminderId, { done: !checked });
        renderApp();
        return;
      }

      if (action === 'open-journal') {
        openNoteModal('journal');
        return;
      }

      if (action === 'open-reminder') {
        openNoteModal('reminder');
        return;
      }

      if (action === 'submit-note') {
        submitNote(target.getAttribute('data-note-type'));
        return;
      }

      if (action === 'close-modal') {
        closeModal();
      }
    });
  }

  function bindBackgroundSyncEvents() {
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) syncAndRenderIfIdle();
    });
    window.addEventListener('focus', function() {
      syncAndRenderIfIdle();
    });
  }

  function startBackgroundSync() {
    if (backgroundSyncTimer) clearInterval(backgroundSyncTimer);
    backgroundSyncTimer = setInterval(function() {
      syncAndRenderIfIdle();
    }, 20000);
  }

  function syncAndRenderIfIdle() {
    if (document.hidden) return;
    autoSync(function() {
      if (!document.getElementById('modal-overlay').classList.contains('show')) {
        renderApp();
      }
    });
  }

  function submitNote(noteType) {
    var textarea = document.getElementById('note-textarea');
    var text = textarea ? textarea.value.trim() : '';
    if (!text) {
      showToast('先写点什么');
      return;
    }
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

  function navigateDay(offset) {
    var parts = uiState.currentDayKey.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + offset);
    uiState.currentDayKey = Storage.getDayKey(date);
    renderApp();
  }

  function renderApp() {
    Storage.syncMealsFromJournal();
    var root = document.getElementById('main-content');
    var dayKey = uiState.currentDayKey;
    var events = Storage.getEventsByDay(dayKey);
    var summary = Storage.getSummaryByDay(dayKey);
    var journal = Storage.getJournalByDay(dayKey);
    var reminders = Storage.getRemindersByDay(dayKey);
    var review = Storage.getReviewByDay(dayKey);
    var meals = Storage.getMealsByDay(dayKey);
    var mealSummary = Storage.getMealSummaryByDay(dayKey);
    var weekAggregate = Storage.getWeekAggregate(dayKey + 'T00:00:00');

    updateTopBar(dayKey);

    root.innerHTML =
      '<div class="page-stack">' +
        renderViewSwitch() +
        (uiState.activeView === 'today'
          ? renderTodayView(events, summary, reminders, journal, review, mealSummary)
          : uiState.activeView === 'food'
            ? renderFoodView(meals, mealSummary)
            : renderWeekView(weekAggregate)) +
      '</div>';
  }

  function updateTopBar(dayKey) {
    var parts = dayKey.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var topDate = document.getElementById('top-date');
    if (topDate) topDate.textContent = formatLongDate(date);

    var todayBtn = document.getElementById('btn-today');
    if (todayBtn) todayBtn.style.display = dayKey === Storage.getTodayKey() ? 'none' : '';
  }

  function renderViewSwitch() {
    return '' +
      '<section class="view-switch">' +
        renderViewTab('today', '今天') +
        renderViewTab('food', '饮食') +
        renderViewTab('week', '本周') +
      '</section>';
  }

  function renderViewTab(view, label) {
    return '<button class="view-tab' + (uiState.activeView === view ? ' is-active' : '') + '" data-action="switch-view" data-view="' + view + '">' + escapeHtml(label) + '</button>';
  }

  function renderTodayView(events, summary, reminders, journal, review, mealSummary) {
    return '' +
      renderHeroClock(events, summary) +
      renderQuickGrid() +
      renderMealTeaser(mealSummary) +
      renderTimeline(events) +
      renderNotesDeck(reminders, journal, review);
  }

  function renderHeroClock(events, summary) {
    return '' +
      '<section class="surface-card hero-card">' +
        '<div class="hero-summary-line">' + escapeHtml('今天已记录 ' + formatDuration(summary.totalMinutes) + ' · ' + summary.eventCount + ' 段') + '</div>' +
        '<div class="hero-clock-layout">' +
          '<div class="hero-clock-wrap">' +
            renderClockFace(events, false) +
          '</div>' +
          '<div class="hero-aside">' +
            '<div class="metric-grid">' +
              renderMetricCard('已记录', formatDuration(summary.totalMinutes), 'sage') +
              renderMetricCard('留白', formatDuration(summary.blankMinutes), 'sand') +
              renderMetricCard('节奏', summary.eventCount ? summary.eventCount + ' 段' : '刚开始', 'mist') +
            '</div>' +
          '</div>' +
        '</div>' +
        renderActivityLegend(events) +
      '</section>';
  }

  function renderQuickGrid() {
    var items = [
      { action: 'open-add', mode: 'quick', label: '记录此刻', icon: '●' },
      { action: 'open-add', mode: 'manual', label: '补记时间', icon: '◌' },
      { action: 'open-journal', label: '写点什么', icon: '✦' },
      { action: 'open-reminder', label: '提醒一下', icon: '☑' }
    ];

    return '' +
      '<section class="quick-grid">' +
        items.map(function(item) {
          return '' +
            '<button class="quick-card" data-action="' + item.action + '"' + (item.mode ? ' data-mode="' + item.mode + '"' : '') + '>' +
              '<div class="quick-icon">' + escapeHtml(item.icon) + '</div>' +
              '<div class="quick-label">' + escapeHtml(item.label) + '</div>' +
            '</button>';
        }).join('') +
      '</section>';
  }

  function renderMealTeaser(mealSummary) {
    var summaryText = mealSummary.count
      ? '今天已整理 ' + mealSummary.count + ' 餐，约 ' + Math.round(mealSummary.calories) + ' kcal，蛋白质约 ' + Math.round(mealSummary.protein) + 'g'
      : '暂无饮食记录';
    return '' +
      '<button class="surface-card meal-teaser-card" data-action="switch-view" data-view="food">' +
        '<div class="section-head compact-head">' +
          '<h3 class="section-title">饮食</h3>' +
          '<span class="inline-link">去饮食页</span>' +
        '</div>' +
        '<p class="meal-teaser-text">' + escapeHtml(summaryText) + '</p>' +
      '</button>';
  }

  function renderTimeline(events) {
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">时间线</h3>' +
        '</div>';

    if (!events.length) {
      html +=
        '<div class="surface-card empty-card">' +
          '<p class="empty-text">还没有记录，先把今天的第一段放进来。</p>' +
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

  function renderNotesDeck(reminders, journal, review) {
    return '' +
      '<section class="notes-grid">' +
        renderReminderCard(reminders) +
        renderJournalCard(journal) +
        renderReviewCard(review) +
      '</section>';
  }

  function renderReminderCard(reminders) {
    if (!reminders.length) {
      return renderCompactNoteCard('提醒', '暂无');
    }
    var html =
      '<section class="surface-card note-card">' +
        '<h3 class="section-title">提醒</h3>';
    html += '<div class="reminder-list">';
    reminders.forEach(function(item) {
      html +=
        '<div class="reminder-item' + (item.done ? ' is-done' : '') + '" data-action="toggle-reminder" data-id="' + escapeHtml(item.id) + '" data-done="' + (item.done ? 'true' : 'false') + '">' +
          '<span class="reminder-check">' + (item.done ? '☑' : '☐') + '</span>' +
          '<span class="reminder-text-line">' + escapeHtml(item.text) + '</span>' +
        '</div>';
    });
    html += '</div>';
    html += '</section>';
    return html;
  }

  function renderJournalCard(journal) {
    if (!journal.length) {
      return renderCompactNoteCard('随想', '暂无');
    }
    var html =
      '<section class="surface-card note-card">' +
        '<h3 class="section-title">随想</h3>';
    html += '<div class="journal-list">';
    journal.forEach(function(item) {
      html +=
        '<div class="journal-item">' +
          '<span class="journal-quote">“</span>' +
          '<span class="journal-text">' + escapeHtml(item.text) + '</span>' +
          '<span class="journal-quote">”</span>' +
        '</div>';
    });
    html += '</div>';

    html += '</section>';
    return html;
  }

  function renderReviewCard(review) {
    if (!review) {
      return renderCompactNoteCard('复盘', '暂无');
    }
    var html =
      '<section class="surface-card note-card">' +
        '<h3 class="section-title">复盘</h3>';
    if (review.summary) html += '<p class="review-text">' + escapeHtml(review.summary) + '</p>';
    if (review.highlights) html += '<p class="review-highlight">' + escapeHtml(review.highlights) + '</p>';

    html += '</section>';
    return html;
  }

  function renderCompactNoteCard(title, value) {
    return '' +
      '<section class="surface-card note-card note-card-compact">' +
        '<div class="compact-note-row">' +
          '<h3 class="section-title">' + escapeHtml(title) + '</h3>' +
          '<span class="compact-note-value">' + escapeHtml(value) + '</span>' +
        '</div>' +
      '</section>';
  }

  function renderFoodView(meals, mealSummary) {
    return '' +
      '<section class="surface-card food-hero-card">' +
        '<h2 class="section-title">今天饮食</h2>' +
        '<div class="metric-grid food-metric-grid">' +
          renderMetricCard('已记录', mealSummary.count ? mealSummary.count + ' 餐' : '0 餐', 'sage') +
          renderMetricCard('热量', mealSummary.count ? Math.round(mealSummary.calories) + ' kcal' : '待整理', 'sand') +
          renderMetricCard('蛋白质', mealSummary.count ? Math.round(mealSummary.protein) + ' g' : '待整理', 'mist') +
        '</div>' +
      '</section>' +
      renderMealList(meals, mealSummary);
  }

  function renderMealList(meals, mealSummary) {
    if (!meals.length) {
      return '' +
        '<section class="surface-card empty-card">' +
          '<p class="empty-text">暂无饮食记录</p>' +
        '</section>';
    }

    var html = '<section class="meal-list">';
    meals.forEach(function(meal) {
      html += renderMealCard(meal);
    });
    html +=
      '<section class="surface-card meal-tip-card">' +
        '<div class="eyebrow">轻提示</div>' +
        '<p class="meal-tip-text">' + escapeHtml(buildMealTip(mealSummary)) + '</p>' +
      '</section>' +
      '</section>';
    return html;
  }

  function renderMealCard(meal) {
    var meta = MEAL_TYPE_META[meal.mealType] || MEAL_TYPE_META.snack;
    var html =
      '<article class="surface-card meal-card">' +
        '<div class="meal-card-head">' +
          '<span class="meal-type-pill" style="background:' + meta.soft + '; color:' + meta.accent + ';">' + escapeHtml(meta.label) + '</span>' +
          '<span class="meal-meta">' + escapeHtml(meal.confidence || 'AI 估算') + '</span>' +
        '</div>' +
        '<h3 class="meal-title">' + escapeHtml(meal.summary || meta.label) + '</h3>' +
        '<div class="meal-stats">' +
          '<div class="meal-stat"><span>热量</span><strong>' + escapeHtml(Math.round(meal.calories) + ' kcal') + '</strong></div>' +
          '<div class="meal-stat"><span>蛋白质</span><strong>' + escapeHtml(Math.round(meal.protein) + ' g') + '</strong></div>' +
        '</div>';

    if (meal.items && meal.items.length) {
      html += '<div class="meal-items">';
      meal.items.forEach(function(item) {
        html +=
          '<div class="meal-item-row">' +
            '<div class="meal-item-main">' +
              '<span class="meal-item-name">' + escapeHtml(item.name) + '</span>' +
              (item.amount ? '<span class="meal-item-amount">' + escapeHtml(item.amount) + '</span>' : '') +
            '</div>' +
            '<div class="meal-item-side">' + escapeHtml(Math.round(item.calories || 0) + ' kcal / ' + Math.round(item.protein || 0) + 'g') + '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    if (meal.note) html += '<p class="meal-note">' + escapeHtml(meal.note) + '</p>';
    html += '</article>';
    return html;
  }

  function renderWeekView(weekAggregate) {
    return '' +
      '<section class="surface-card week-hero-card">' +
        '<h2 class="section-title">本周</h2>' +
        '<div class="metric-grid">' +
          renderMetricCard('总时长', formatDuration(weekAggregate.totalMinutes), 'sage') +
          renderMetricCard('总段数', weekAggregate.totalEvents ? weekAggregate.totalEvents + ' 段' : '0 段', 'mist') +
          renderMetricCard('有记录天数', weekAggregate.activeDays ? weekAggregate.activeDays + ' 天' : '0 天', 'sand') +
        '</div>' +
      '</section>' +
      (weekAggregate.categories.length ? renderWeekBreakdown(weekAggregate.categories, weekAggregate.totalMinutes) : '') +
      renderWeekGrid(weekAggregate.weekDays);
  }

  function renderWeekBreakdown(categories, totalMinutes) {
    var html =
      '<section class="surface-card week-breakdown-card">' +
        '<h3 class="section-title">投入分布</h3>';

    html += '<div class="week-breakdown-list">';
    categories.forEach(function(item) {
      var meta = getActivityMeta(item.activity);
      var ratio = totalMinutes ? (item.minutes / totalMinutes) * 100 : 0;
      html +=
        '<div class="week-breakdown-item">' +
          '<div class="week-breakdown-top">' +
            '<span class="week-breakdown-label">' + escapeHtml(meta.label) + '</span>' +
            '<span class="week-breakdown-value">' + escapeHtml(formatDuration(item.minutes)) + '</span>' +
          '</div>' +
          '<div class="week-breakdown-bar">' +
            '<span class="week-breakdown-fill" style="width:' + ratio.toFixed(1) + '%; background:linear-gradient(90deg, ' + meta.color + ', ' + mixHex(meta.color, '#ffffff', 0.15) + ');"></span>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';

    html += '</section>';
    return html;
  }

  function renderWeekGrid(weekDays) {
    var html =
      '<section class="section">' +
        '<div class="section-head">' +
          '<h3 class="section-title">每天</h3>' +
        '</div>' +
        '<div class="week-grid">';

    weekDays.forEach(function(day) {
      html += renderWeekDayCard(day);
    });

    html += '</div></section>';
    return html;
  }

  function renderWeekDayCard(day) {
    var summary = getSummaryFromEvents(day.events);
    var topActivity = getTopActivity(day.events);
    return '' +
      '<article class="surface-card week-card">' +
        '<div class="week-card-head">' +
          '<div>' +
            '<div class="week-day">' + escapeHtml(formatShortDay(day.dayKey)) + '</div>' +
            '<div class="week-day-note">' + escapeHtml(topActivity ? ('最投入：' + getActivityMeta(topActivity).label) : '还没有记录') + '</div>' +
          '</div>' +
          '<div class="week-minute-copy">' + escapeHtml(formatDuration(summary.totalMinutes)) + '</div>' +
        '</div>' +
        '<div class="week-clock-wrap">' + renderClockFace(day.events, true) + '</div>' +
      '</article>';
  }

  function renderClockFace(events, compact) {
    var summary = getSummaryFromEvents(events);
    var sizeClass = compact ? ' is-small' : '';
    return '' +
      '<div class="clock-face' + sizeClass + '" style="background:' + buildConicGradient(events) + ';">' +
        '<div class="clock-core' + sizeClass + '"></div>' +
        renderClockMarkers(compact) +
        '<div class="clock-center' + sizeClass + '">' +
          '<div class="clock-total">' + escapeHtml(formatDuration(summary.totalMinutes)) + '</div>' +
          '<div class="clock-caption">' + escapeHtml(compact ? '已记录' : '今天收下') + '</div>' +
        '</div>' +
      '</div>';
  }

  function renderClockMarkers(compact) {
    var labels = ['00', '06', '12', '18'];
    return labels.map(function(label, index) {
      return '<span class="clock-marker marker-' + index + (compact ? ' is-small' : '') + '">' + label + '</span>';
    }).join('');
  }

  function renderMetricCard(label, value, tone) {
    return '' +
      '<div class="metric-card tone-' + tone + '">' +
        '<div class="metric-label">' + escapeHtml(label) + '</div>' +
        '<div class="metric-value">' + escapeHtml(value) + '</div>' +
      '</div>';
  }

  function renderActivityLegend(events) {
    if (!events.length) return '<div class="legend-empty">今天还没有活动，钟面会在你开始记录后慢慢长出来。</div>';

    var totals = {};
    events.forEach(function(event) {
      totals[event.activity] = (totals[event.activity] || 0) + event.duration;
    });

    return '' +
      '<div class="clock-legend">' +
        Object.keys(totals).map(function(key) {
          var meta = getActivityMeta(key);
          return '' +
            '<div class="legend-chip" style="--legend-soft:' + meta.soft + '; --legend-text:' + meta.color + ';">' +
              '<span class="legend-dot" style="background:' + meta.color + ';"></span>' +
              '<span>' + escapeHtml(meta.label + ' · ' + formatDuration(totals[key])) + '</span>' +
            '</div>';
        }).join('') +
      '</div>';
  }

  function renderEventCard(event) {
    var meta = getActivityMeta(event.activity);
    var statuses = [];
    if (event.energy) statuses.push(renderStatusPill('energy', event.energy));
    if (event.mood) statuses.push(renderStatusPill('mood', event.mood));
    if (event.body) statuses.push(renderStatusPill('body', event.body));

    return '' +
      '<article class="surface-card event-card">' +
        '<div class="event-top">' +
          '<div class="event-main">' +
            '<div class="event-header-row">' +
              '<span class="event-type" style="background:' + meta.soft + '; color:' + meta.color + ';">' + escapeHtml(meta.icon + ' ' + meta.label) + '</span>' +
              '<span class="event-mode">' + escapeHtml(getModeLabel(event.inputMode)) + '</span>' +
            '</div>' +
            '<div class="event-time">' + escapeHtml(formatTime(event.startMinutes) + ' - ' + formatTime(event.endMinutes)) + '</div>' +
          '</div>' +
          '<div class="event-side">' +
            '<div class="event-duration">' + escapeHtml(formatDuration(event.duration)) + '</div>' +
            '<button class="event-delete" data-action="delete-event" data-id="' + escapeHtml(event.id) + '" aria-label="删除">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        (statuses.length ? '<div class="event-status-row">' + statuses.join('') + '</div>' : '') +
        (event.tags && event.tags.length ? '<div class="event-tags-row">' + event.tags.map(renderTagPill).join('') + '</div>' : '') +
        (event.note ? '<div class="event-note">' + escapeHtml(event.note) + '</div>' : '') +
      '</article>';
  }

  function renderTagPill(tag) {
    var bg = mixHex(tag.color, '#ffffff', 0.82);
    return '<span class="event-tag" style="background:' + bg + '; color:' + tag.color + '; border-color:' + mixHex(tag.color, '#ffffff', 0.5) + ';">' + escapeHtml(tag.text) + '</span>';
  }

  function renderStatusPill(group, value) {
    var option = getStatusOption(group, value);
    var labelMap = { energy: '精力', mood: '情绪', body: '身体' };
    if (!option) return '';
    return '<span class="status-pill" style="background:' + option.soft + '; color:' + option.text + ';">' + escapeHtml(labelMap[group] + ' · ' + option.label) + '</span>';
  }

  function openNoteModal(type) {
    var isJournal = type === 'journal';
    setModal(isJournal ? '写点什么' : '提醒一下', '' +
      '<div class="modal-stack">' +
        '<textarea class="text-area" id="note-textarea" maxlength="500" rows="4" placeholder="' + escapeHtml(isJournal ? '此刻的想法、感受、碎碎念...' : '提醒自己要做的事...') + '" autofocus></textarea>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" data-action="close-modal">取消</button>' +
          '<button class="btn btn-primary" data-action="submit-note" data-note-type="' + type + '">' + escapeHtml(isJournal ? '记下来' : '添加提醒') + '</button>' +
        '</div>' +
      '</div>');
    setTimeout(function() {
      var input = document.getElementById('note-textarea');
      if (input) input.focus();
    }, 60);
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

    setModal(addFormState.mode === 'manual' ? '补记时间' : '记录此刻', renderAddForm());
    bindAddFormEvents();
  }

  function renderAddForm() {
    return '' +
      '<form class="modal-stack" id="add-form">' +
        '<div class="mode-switch">' +
          '<button type="button" class="mode-chip' + (addFormState.mode === 'quick' ? ' is-active' : '') + '" data-mode-choice="quick">刚做完</button>' +
          '<button type="button" class="mode-chip' + (addFormState.mode === 'manual' ? ' is-active' : '') + '" data-mode-choice="manual">补记时间</button>' +
        '</div>' +
        renderPrimaryFields() +
        renderActivityField() +
        renderTagField() +
        renderStatusField('energy', '精力') +
        renderStatusField('mood', '情绪') +
        renderStatusField('body', '身体') +
        '<div class="field-group note-group">' +
          '<button type="button" class="text-link" id="toggle-note">' + (addFormState.noteOpen ? '收起备注' : '加一句备注') + '</button>' +
          (addFormState.noteOpen
            ? '<textarea class="text-area" id="event-note" maxlength="100" placeholder="一句话就够">' + escapeHtml(addFormState.note) + '</textarea>'
            : '<input type="hidden" id="event-note" value="' + escapeHtml(addFormState.note) + '">') +
        '</div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" id="cancel-add">取消</button>' +
          '<button type="submit" class="btn btn-primary">' + escapeHtml(addFormState.mode === 'quick' ? '收下这段时间' : '补上这段时间') + '</button>' +
        '</div>' +
      '</form>';
  }

  function renderPrimaryFields() {
    if (addFormState.mode === 'quick') {
      return '' +
        '<div class="field-group">' +
          '<div class="field-label">刚刚这一段，大概多久</div>' +
          '<div class="duration-grid" id="duration-grid">' + renderDurationChips() + '</div>' +
          '<input class="custom-duration" id="custom-duration" type="number" min="5" step="5" placeholder="也可以直接输入分钟数">' +
        '</div>';
    }

    return '' +
      '<div class="manual-grid">' +
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
        '<div class="helper-text">开始和结束时间填完整就行，重叠时会提示你怎么处理。</div>' +
      '</div>';
  }

  function renderActivityField() {
    return '' +
      '<div class="field-group">' +
        '<div class="field-label">活动类型</div>' +
        '<div class="chip-grid activity-grid" id="activity-grid">' + renderActivityChips() + '</div>' +
        '<div class="custom-activity-row">' +
          '<input class="text-input" id="custom-activity-input" type="text" maxlength="12" placeholder="不在上面时，可加一个新活动" value="' + escapeHtml(addFormState.customActivity) + '">' +
          '<button type="button" class="btn btn-soft custom-activity-btn" id="add-custom-activity">加入活动</button>' +
        '</div>' +
      '</div>';
  }

  function renderTagField() {
    var tagLibrary = Storage.getTagLibrary();
    var selectedTags = tagLibrary.filter(function(tag) {
      return addFormState.selectedTagIds.indexOf(tag.id) >= 0;
    });
    return '' +
      '<div class="field-group">' +
        '<div class="field-label">标签</div>' +
        (selectedTags.length
          ? '<div class="selected-tags-row">' + selectedTags.map(renderTagPill).join('') + '</div>'
          : '<div class="helper-text">可以给这段时间贴上自己的彩色标签。</div>') +
        '<div class="chip-grid tag-library-grid" id="tag-library">' +
          tagLibrary.map(function(tag) {
            var selected = addFormState.selectedTagIds.indexOf(tag.id) >= 0 ? ' is-selected' : '';
            return '<button type="button" class="choice-chip tag-choice' + selected + '" data-tag-id="' + escapeHtml(tag.id) + '" style="--chip-bg:' + mixHex(tag.color, '#ffffff', 0.84) + '; --chip-text:' + tag.color + ';">' + escapeHtml(tag.text) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="custom-tag-builder">' +
          '<input class="text-input" id="custom-tag-text" type="text" maxlength="10" placeholder="新建标签文字" value="' + escapeHtml(addFormState.newTagText) + '">' +
          '<div class="tag-color-palette" id="tag-color-palette">' +
            TAG_COLOR_OPTIONS.map(function(option) {
              return '<button type="button" class="tag-color-dot' + (addFormState.newTagColor === option.value ? ' is-selected' : '') + '" data-tag-color="' + option.value + '" aria-label="' + escapeHtml(option.label) + '" style="background:' + option.value + ';"></button>';
            }).join('') +
          '</div>' +
          '<button type="button" class="btn btn-soft" id="add-custom-tag">保存这个标签</button>' +
        '</div>' +
      '</div>';
  }

  function renderStatusField(group, label) {
    return '' +
      '<div class="field-group">' +
        '<div class="field-label">' + escapeHtml(label) + '</div>' +
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
      return '<button type="button" class="choice-chip status-choice' + selected + '" data-status-group="' + group + '" data-status-value="' + option.value + '" style="--chip-bg:' + option.soft + '; --chip-text:' + option.text + ';">' + escapeHtml(option.label) + '</button>';
    }).join('');
  }

  function bindAddFormEvents() {
    document.getElementById('cancel-add').addEventListener('click', closeModal);

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
      setModal(addFormState.mode === 'manual' ? '补记时间' : '记录此刻', renderAddForm());
      bindAddFormEvents();
      showToast('已经加入活动');
    });

    document.getElementById('toggle-note').addEventListener('click', function() {
      addFormState.note = document.getElementById('event-note').value.trim();
      addFormState.newTagText = document.getElementById('custom-tag-text').value.trim();
      addFormState.customActivity = document.getElementById('custom-activity-input').value.trim();
      addFormState.noteOpen = !addFormState.noteOpen;
      setModal(addFormState.mode === 'manual' ? '补记时间' : '记录此刻', renderAddForm());
      bindAddFormEvents();
    });

    document.querySelectorAll('[data-mode-choice]').forEach(function(node) {
      node.addEventListener('click', function() {
        addFormState.note = document.getElementById('event-note').value.trim();
        addFormState.newTagText = document.getElementById('custom-tag-text').value.trim();
        addFormState.customActivity = document.getElementById('custom-activity-input').value.trim();
        addFormState.mode = node.getAttribute('data-mode-choice');
        setModal(addFormState.mode === 'manual' ? '补记时间' : '记录此刻', renderAddForm());
        bindAddFormEvents();
      });
    });

    document.getElementById('activity-grid').addEventListener('click', function(event) {
      var target = event.target.closest('[data-activity]');
      if (!target) return;
      addFormState.activity = target.getAttribute('data-activity');
      refreshFormSelections();
    });

    document.getElementById('tag-library').addEventListener('click', function(event) {
      var target = event.target.closest('[data-tag-id]');
      if (!target) return;
      toggleSelectedTag(target.getAttribute('data-tag-id'));
      refreshFormSelections();
    });

    document.getElementById('tag-color-palette').addEventListener('click', function(event) {
      var target = event.target.closest('[data-tag-color]');
      if (!target) return;
      addFormState.newTagColor = target.getAttribute('data-tag-color');
      refreshFormSelections();
    });

    document.getElementById('custom-tag-text').addEventListener('input', function() {
      addFormState.newTagText = this.value;
    });

    document.getElementById('add-custom-tag').addEventListener('click', function() {
      var text = document.getElementById('custom-tag-text').value.trim();
      if (!text) {
        showToast('先写标签文字');
        return;
      }
      var created = Storage.createTag({ text: text, color: addFormState.newTagColor });
      if (created && addFormState.selectedTagIds.indexOf(created.id) === -1) {
        addFormState.selectedTagIds.push(created.id);
      }
      addFormState.newTagText = '';
      setModal(addFormState.mode === 'manual' ? '补记时间' : '记录此刻', renderAddForm());
      bindAddFormEvents();
      showToast('标签已保存');
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

  function toggleSelectedTag(tagId) {
    var index = addFormState.selectedTagIds.indexOf(tagId);
    if (index >= 0) {
      addFormState.selectedTagIds.splice(index, 1);
    } else {
      addFormState.selectedTagIds.push(tagId);
    }
  }

  function submitAddForm(strategy) {
    addFormState.note = document.getElementById('event-note').value.trim();

    var payload = {
      activity: addFormState.activity,
      note: addFormState.note,
      tags: Storage.getTagLibrary().filter(function(tag) {
        return addFormState.selectedTagIds.indexOf(tag.id) >= 0;
      }),
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
          '<div class="conflict-list">' +
            result.overlaps.map(function(item) {
              return '<div class="conflict-item">' + escapeHtml(formatTime(item.startMinutes) + ' - ' + formatTime(item.endMinutes) + ' · ' + getActivityMeta(item.activity).label) + '</div>';
            }).join('') +
          '</div>' +
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
    document.querySelectorAll('[data-tag-id]').forEach(function(node) {
      node.classList.toggle('is-selected', addFormState.selectedTagIds.indexOf(node.getAttribute('data-tag-id')) >= 0);
    });
    document.querySelectorAll('[data-tag-color]').forEach(function(node) {
      node.classList.toggle('is-selected', node.getAttribute('data-tag-color') === addFormState.newTagColor);
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

  function getTopActivity(events) {
    var totals = {};
    events.forEach(function(event) {
      totals[event.activity] = (totals[event.activity] || 0) + event.duration;
    });
    var bestKey = '';
    var bestMinutes = 0;
    Object.keys(totals).forEach(function(key) {
      if (totals[key] > bestMinutes) {
        bestMinutes = totals[key];
        bestKey = key;
      }
    });
    return bestKey;
  }

  function buildCustomActivityColors(seed) {
    var palette = [
      { color: '#607E54', soft: '#EEF3E5' },
      { color: '#4D6F9A', soft: '#EAF0F8' },
      { color: '#8A6A9E', soft: '#F2ECF8' },
      { color: '#B46A51', soft: '#F9EDE8' }
    ];
    return palette[Math.abs(hashString(seed)) % palette.length];
  }

  function buildMealTip(summary) {
    if (!summary.count) return '饮食页会在以后承接 AI 整理出来的每一餐。';
    if (summary.protein >= 75) return '今天蛋白质已经比较稳了，继续保持现在这种轻记录就够。';
    if (summary.protein >= 45) return '今天蛋白质在中段，晚一点如果能再补一小份会更均衡。';
    return '今天蛋白质偏少一些，下一餐可以稍微优先考虑蛋白来源。';
  }

  function buildConicGradient(events) {
    var trackColor = '#F2EEE7';
    if (!events.length) return trackColor;

    var sorted = events.slice().sort(function(a, b) {
      return a.startMinutes - b.startMinutes;
    });

    var segments = [];
    sorted.forEach(function(event) {
      var startDeg = (event.startMinutes / 1440) * 360;
      var endDeg = (event.endMinutes / 1440) * 360;
      if (endDeg <= startDeg) return;
      var meta = getActivityMeta(event.activity);
      segments.push({ start: startDeg, end: endDeg, color: meta.color });
    });

    if (!segments.length) return trackColor;

    var stops = [trackColor + ' 0deg'];
    segments.forEach(function(seg) {
      stops.push(trackColor + ' ' + Math.max(0, seg.start - 4).toFixed(1) + 'deg');
      stops.push(seg.color + ' ' + seg.start.toFixed(1) + 'deg');
      stops.push(seg.color + ' ' + seg.end.toFixed(1) + 'deg');
      stops.push(trackColor + ' ' + Math.min(360, seg.end + 4).toFixed(1) + 'deg');
    });
    stops.push(trackColor + ' 360deg');
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

  function hashString(value) {
    return String(value || '').split('').reduce(function(sum, char) {
      return ((sum << 5) - sum) + char.charCodeAt(0);
    }, 0);
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
  var pad = Storage.pad;

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

  function getModeLabel(mode) {
    return mode === 'manual' ? '补记' : (mode === 'ai' ? 'AI' : '刚做完');
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
