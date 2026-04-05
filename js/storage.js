var Storage = (function() {
  var STORAGE_KEY = 'quiet_life_records_v3';
  var LEGACY_STORAGE_KEY = 'quiet_life_records_v2';
  var DEFAULT_TAG_COLORS = ['#7F9A65', '#B46D5B', '#C69138', '#4F7B78', '#856B9D', '#4E6FAE'];

  function getDefaultState() {
    return {
      events: [],
      outings: [],
      journal: [],
      reminders: [],
      reviews: [],
      meals: [],
      tagLibrary: []
    };
  }

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      }
      if (!raw) return getDefaultState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.error('读取记录失败', error);
      return getDefaultState();
    }
  }

  function saveState(state) {
    var normalized = normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(normalized));
  }

  function normalizeState(parsed) {
    var state = getDefaultState();
    var tags = Array.isArray(parsed && parsed.tagLibrary) ? parsed.tagLibrary.map(normalizeTag).filter(Boolean) : [];
    var tagMap = buildTagMap(tags);

    state.outings = Array.isArray(parsed && parsed.outings) ? parsed.outings : [];
    state.journal = Array.isArray(parsed && parsed.journal) ? parsed.journal : [];
    state.reminders = Array.isArray(parsed && parsed.reminders) ? parsed.reminders : [];
    state.reviews = Array.isArray(parsed && parsed.reviews) ? parsed.reviews : [];
    state.meals = Array.isArray(parsed && parsed.meals) ? parsed.meals.map(normalizeMeal).filter(Boolean) : [];

    state.events = Array.isArray(parsed && parsed.events)
      ? parsed.events.map(function(item) {
          return normalizeEvent(item, tagMap);
        }).filter(Boolean)
      : [];

    state.events.forEach(function(event) {
      event.tags.forEach(function(tag) {
        if (!tagMap[tag.id]) {
          tagMap[tag.id] = tag;
          tags.push(tag);
        }
      });
    });

    state.tagLibrary = sortTags(tags);
    return state;
  }

  function generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function clampMinutes(minutes) {
    return Math.max(0, Math.min(24 * 60, minutes));
  }

  function roundToFive(minutes) {
    return clampMinutes(Math.round(minutes / 5) * 5);
  }

  function getDayKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function getTodayKey() {
    return getDayKey(new Date());
  }

  function getCurrentMinutes() {
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function normalizeTag(raw) {
    if (!raw && raw !== '') return null;
    if (typeof raw === 'string') {
      var label = String(raw).trim();
      if (!label) return null;
      return {
        id: 'tag_' + hashString(label),
        text: label,
        color: pickDefaultTagColor(label),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    var text = String(raw.text || raw.label || '').trim();
    if (!text) return null;
    return {
      id: raw.id || ('tag_' + hashString(text + (raw.color || ''))),
      text: text,
      color: normalizeHex(raw.color || pickDefaultTagColor(text)),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeEvent(raw, tagMap) {
    if (!raw) return null;
    var startMinutes = clampMinutes(Number(raw.startMinutes) || 0);
    var endMinutes = clampMinutes(Number(raw.endMinutes) || startMinutes);
    if (endMinutes <= startMinutes) endMinutes = clampMinutes(startMinutes + (Number(raw.duration) || 0));
    if (endMinutes <= startMinutes) endMinutes = clampMinutes(startMinutes + 5);

    var rawTags = Array.isArray(raw.tags) ? raw.tags : [];
    var tags = rawTags.map(function(item) {
      if (item && item.id && tagMap && tagMap[item.id]) return tagMap[item.id];
      return normalizeTag(item);
    }).filter(Boolean);

    return {
      id: raw.id || generateId(),
      dayKey: raw.dayKey || getTodayKey(),
      activity: raw.activity || 'study',
      note: raw.note || '',
      tags: dedupeTags(tags),
      energy: raw.energy || '',
      mood: raw.mood || '',
      body: raw.body || '',
      inputMode: raw.inputMode || 'quick',
      startMinutes: startMinutes,
      endMinutes: endMinutes,
      duration: endMinutes - startMinutes,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeMeal(raw) {
    if (!raw) return null;
    var mealType = raw.mealType || raw.type || 'snack';
    var items = Array.isArray(raw.items)
      ? raw.items.map(function(item) {
          var name = String(item.name || '').trim();
          if (!name) return null;
          return {
            name: name,
            amount: String(item.amount || '').trim(),
            calories: Number(item.calories) || 0,
            protein: Number(item.protein) || 0
          };
        }).filter(Boolean)
      : [];

    return {
      id: raw.id || generateId(),
      dayKey: raw.dayKey || getTodayKey(),
      mealType: mealType,
      summary: String(raw.summary || '').trim(),
      source: raw.source || 'ai',
      confidence: raw.confidence || '',
      items: items,
      calories: Number(raw.calories) || items.reduce(function(sum, item) { return sum + (Number(item.calories) || 0); }, 0),
      protein: Number(raw.protein) || items.reduce(function(sum, item) { return sum + (Number(item.protein) || 0); }, 0),
      note: String(raw.note || '').trim(),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function sortEvents(events) {
    return events.sort(function(a, b) {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
    });
  }

  function sortTags(tags) {
    return tags.slice().sort(function(a, b) {
      return a.text.localeCompare(b.text, 'zh-Hans-CN');
    });
  }

  function buildTagMap(tags) {
    var map = {};
    tags.forEach(function(tag) {
      map[tag.id] = tag;
    });
    return map;
  }

  function dedupeTags(tags) {
    var map = {};
    tags.forEach(function(tag) {
      map[tag.id] = tag;
    });
    return Object.keys(map).map(function(key) { return map[key]; });
  }

  function getAllEvents() {
    return sortEvents(readState().events.map(function(item) {
      return normalizeEvent(item);
    }).filter(Boolean));
  }

  function getEventsByDay(dayKey) {
    return getAllEvents().filter(function(item) {
      return item.dayKey === dayKey;
    });
  }

  function getTodayEvents() {
    return getEventsByDay(getTodayKey());
  }

  function getWeekKeys(baseDate) {
    var today = baseDate ? new Date(baseDate) : new Date();
    var day = today.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    var monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + diff);
    var keys = [];
    for (var i = 0; i < 7; i++) {
      var cursor = new Date(monday);
      cursor.setDate(monday.getDate() + i);
      keys.push(getDayKey(cursor));
    }
    return keys;
  }

  function getWeekEvents(baseDate) {
    var keys = getWeekKeys(baseDate);
    var all = getAllEvents();
    return keys.map(function(dayKey) {
      return {
        dayKey: dayKey,
        events: all.filter(function(item) { return item.dayKey === dayKey; })
      };
    });
  }

  function getWeekAggregate(baseDate) {
    var weekDays = getWeekEvents(baseDate);
    var totalsByActivity = {};
    var totalMinutes = 0;
    var totalEvents = 0;
    var activeDays = 0;

    weekDays.forEach(function(day) {
      if (day.events.length) activeDays += 1;
      day.events.forEach(function(event) {
        totalsByActivity[event.activity] = (totalsByActivity[event.activity] || 0) + event.duration;
        totalMinutes += event.duration;
        totalEvents += 1;
      });
    });

    var categories = Object.keys(totalsByActivity).map(function(key) {
      return {
        activity: key,
        minutes: totalsByActivity[key]
      };
    }).sort(function(a, b) {
      return b.minutes - a.minutes;
    });

    return {
      totalMinutes: totalMinutes,
      totalEvents: totalEvents,
      activeDays: activeDays,
      categories: categories,
      weekDays: weekDays
    };
  }

  function findOverlaps(target, events) {
    return events.filter(function(item) {
      return item.dayKey === target.dayKey &&
        item.id !== target.id &&
        target.startMinutes < item.endMinutes &&
        target.endMinutes > item.startMinutes;
    });
  }

  function createEvent(input, mode, strategy) {
    var state = readState();
    var event;
    var now = new Date();
    var selectedTags = Array.isArray(input.tags) ? input.tags.map(normalizeTag).filter(Boolean) : [];

    if (mode === 'manual') {
      event = normalizeEvent({
        activity: input.activity,
        note: input.note,
        tags: selectedTags,
        energy: input.energy,
        mood: input.mood,
        body: input.body,
        inputMode: 'manual',
        dayKey: input.dayKey || getTodayKey(),
        startMinutes: roundToFive(input.startMinutes),
        endMinutes: roundToFive(input.endMinutes),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    } else {
      var endMinutes = roundToFive(getCurrentMinutes());
      var duration = Number(input.duration) || 0;
      event = normalizeEvent({
        activity: input.activity,
        note: input.note,
        tags: selectedTags,
        energy: input.energy,
        mood: input.mood,
        body: input.body,
        inputMode: 'quick',
        dayKey: getTodayKey(),
        startMinutes: clampMinutes(endMinutes - duration),
        endMinutes: endMinutes,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    }

    var existing = state.events.map(function(item) {
      return normalizeEvent(item);
    }).filter(Boolean);
    var overlaps = findOverlaps(event, existing);
    if (overlaps.length && strategy !== 'replace' && strategy !== 'keep') {
      return {
        ok: false,
        event: event,
        overlaps: overlaps
      };
    }

    if (strategy === 'replace' && overlaps.length) {
      var overlapIds = {};
      overlaps.forEach(function(item) {
        overlapIds[item.id] = true;
      });
      state.events = existing.filter(function(item) {
        return !overlapIds[item.id];
      });
    } else {
      state.events = existing;
    }

    mergeTagsIntoLibrary(state, event.tags);
    state.events.push(event);
    state.events = sortEvents(state.events).map(function(item) {
      item.updatedAt = item.id === event.id ? now.toISOString() : item.updatedAt;
      return item;
    });
    saveState(state);
    return {
      ok: true,
      event: event,
      overlaps: overlaps
    };
  }

  function deleteEvent(id) {
    var state = readState();
    state.events = state.events.filter(function(item) {
      return item.id !== id;
    });
    saveState(state);
  }

  function getTagLibrary() {
    return readState().tagLibrary.map(normalizeTag).filter(Boolean);
  }

  function createTag(data) {
    var state = readState();
    var tag = normalizeTag({
      text: data.text,
      color: data.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (!tag) return null;

    var existing = state.tagLibrary.find(function(item) {
      return item.text === tag.text && normalizeHex(item.color) === normalizeHex(tag.color);
    });
    if (existing) return normalizeTag(existing);

    state.tagLibrary.push(tag);
    state.tagLibrary = sortTags(state.tagLibrary.map(normalizeTag).filter(Boolean));
    saveState(state);
    return tag;
  }

  function mergeTagsIntoLibrary(state, tags) {
    var map = buildTagMap((state.tagLibrary || []).map(normalizeTag).filter(Boolean));
    tags.forEach(function(tag) {
      if (!map[tag.id]) {
        map[tag.id] = tag;
      }
    });
    state.tagLibrary = sortTags(Object.keys(map).map(function(key) {
      return map[key];
    }));
  }

  function getMealsByDay(dayKey) {
    return readState().meals.filter(function(item) {
      return item.dayKey === dayKey;
    }).sort(function(a, b) {
      var order = mealSortWeight(a.mealType) - mealSortWeight(b.mealType);
      if (order !== 0) return order;
      return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
    });
  }

  function getMealSummaryByDay(dayKey) {
    var meals = getMealsByDay(dayKey);
    return meals.reduce(function(result, meal) {
      result.count += 1;
      result.calories += Number(meal.calories) || 0;
      result.protein += Number(meal.protein) || 0;
      return result;
    }, { count: 0, calories: 0, protein: 0 });
  }

  function createMeal(data) {
    var state = readState();
    var meal = normalizeMeal(data);
    if (!meal) return null;
    state.meals.push(meal);
    saveState(state);
    return meal;
  }

  function getRecentOuting() {
    var outings = readState().outings.slice().sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return outings[0] || null;
  }

  function createOuting(data) {
    var state = readState();
    var outing = {
      id: generateId(),
      location: data.location,
      note: data.note || '',
      decision: data.decision || 'browse',
      reminderStage: data.reminderStage || 0,
      createdAt: new Date().toISOString()
    };
    state.outings.push(outing);
    saveState(state);
    return outing;
  }

  function getSummaryByDay(dayKey) {
    var events = getEventsByDay(dayKey);
    var totalMinutes = events.reduce(function(sum, item) {
      return sum + item.duration;
    }, 0);
    var blankMinutes = Math.max(0, 24 * 60 - totalMinutes);
    return {
      eventCount: events.length,
      totalMinutes: totalMinutes,
      blankMinutes: blankMinutes,
      latestEndMinutes: events.length ? events[events.length - 1].endMinutes : null
    };
  }

  function getTodaySummary() {
    return getSummaryByDay(getTodayKey());
  }

  function getJournalByDay(dayKey) {
    var state = readState();
    return state.journal.filter(function(item) {
      return item.dayKey === dayKey;
    }).sort(function(a, b) {
      return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
    });
  }

  function createJournal(data) {
    var state = readState();
    var entry = {
      id: data.id || generateId(),
      dayKey: data.dayKey || getTodayKey(),
      text: data.text || '',
      mood: data.mood || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    };
    state.journal.push(entry);
    saveState(state);
    return entry;
  }

  function getRemindersByDay(dayKey) {
    var state = readState();
    return state.reminders.filter(function(item) {
      return item.dayKey === dayKey;
    }).sort(function(a, b) {
      return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
    });
  }

  function createReminder(data) {
    var state = readState();
    var entry = {
      id: data.id || generateId(),
      dayKey: data.dayKey || getTodayKey(),
      text: data.text || '',
      done: !!data.done,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    };
    state.reminders.push(entry);
    saveState(state);
    return entry;
  }

  function updateReminder(id, changes) {
    var state = readState();
    for (var i = 0; i < state.reminders.length; i++) {
      if (state.reminders[i].id === id) {
        var keys = Object.keys(changes);
        for (var j = 0; j < keys.length; j++) {
          state.reminders[i][keys[j]] = changes[keys[j]];
        }
        state.reminders[i].updatedAt = new Date().toISOString();
        break;
      }
    }
    saveState(state);
  }

  function getReviewByDay(dayKey) {
    var state = readState();
    var matches = state.reviews.filter(function(item) {
      return item.dayKey === dayKey;
    });
    return matches.length ? matches[matches.length - 1] : null;
  }

  function createReview(data) {
    var state = readState();
    var entry = {
      id: data.id || generateId(),
      dayKey: data.dayKey || getTodayKey(),
      wakeUpMinutes: data.wakeUpMinutes || null,
      summary: data.summary || '',
      highlights: data.highlights || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    };
    state.reviews.push(entry);
    saveState(state);
    return entry;
  }

  function exportData() {
    var payload = JSON.stringify({
      version: 3,
      exportedAt: new Date().toISOString(),
      data: readState()
    }, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = '轻轻记录-' + getTodayKey() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function hashString(value) {
    return Math.abs(String(value || '').split('').reduce(function(sum, char) {
      return ((sum << 5) - sum) + char.charCodeAt(0);
    }, 0));
  }

  function pickDefaultTagColor(seed) {
    return DEFAULT_TAG_COLORS[hashString(seed) % DEFAULT_TAG_COLORS.length];
  }

  function normalizeHex(color) {
    var value = String(color || '').trim();
    if (!value) return '#7F9A65';
    if (value.charAt(0) !== '#') value = '#' + value;
    if (value.length === 4) {
      value = '#' + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2) + value.charAt(3) + value.charAt(3);
    }
    return value.length === 7 ? value.toUpperCase() : '#7F9A65';
  }

  function mealSortWeight(type) {
    return {
      breakfast: 1,
      lunch: 2,
      dinner: 3,
      snack: 4
    }[type] || 9;
  }

  return {
    getTodayKey: getTodayKey,
    getDayKey: getDayKey,
    getTodayEvents: getTodayEvents,
    getEventsByDay: getEventsByDay,
    getWeekKeys: getWeekKeys,
    getWeekEvents: getWeekEvents,
    getWeekAggregate: getWeekAggregate,
    getSummaryByDay: getSummaryByDay,
    getTodaySummary: getTodaySummary,
    getRecentOuting: getRecentOuting,
    createEvent: createEvent,
    deleteEvent: deleteEvent,
    createOuting: createOuting,
    exportData: exportData,
    getJournalByDay: getJournalByDay,
    createJournal: createJournal,
    getRemindersByDay: getRemindersByDay,
    createReminder: createReminder,
    updateReminder: updateReminder,
    getReviewByDay: getReviewByDay,
    createReview: createReview,
    getTagLibrary: getTagLibrary,
    createTag: createTag,
    getMealsByDay: getMealsByDay,
    getMealSummaryByDay: getMealSummaryByDay,
    createMeal: createMeal,
    pad: pad,
    roundToFive: roundToFive
  };
})();
