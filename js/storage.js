var Storage = (function() {
  var STORAGE_KEY = 'quiet_life_records_v2';

  function getDefaultState() {
    return {
      events: [],
      outings: []
    };
  }

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultState();
      var parsed = JSON.parse(raw);
      return {
        events: Array.isArray(parsed.events) ? parsed.events : [],
        outings: Array.isArray(parsed.outings) ? parsed.outings : []
      };
    } catch (error) {
      console.error('读取记录失败', error);
      return getDefaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  function normalizeEvent(raw) {
    var startMinutes = clampMinutes(Number(raw.startMinutes) || 0);
    var endMinutes = clampMinutes(Number(raw.endMinutes) || startMinutes);
    if (endMinutes <= startMinutes) endMinutes = clampMinutes(startMinutes + (Number(raw.duration) || 0));
    if (endMinutes <= startMinutes) endMinutes = clampMinutes(startMinutes + 5);
    return {
      id: raw.id || generateId(),
      dayKey: raw.dayKey || getTodayKey(),
      activity: raw.activity || 'study',
      note: raw.note || '',
      tags: Array.isArray(raw.tags)
        ? raw.tags.map(function(item) { return String(item || '').trim(); }).filter(Boolean)
        : [],
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

  function sortEvents(events) {
    return events.sort(function(a, b) {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
  }

  function getAllEvents() {
    return sortEvents(readState().events.map(normalizeEvent));
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

    if (mode === 'manual') {
      event = normalizeEvent({
        activity: input.activity,
        note: input.note,
        tags: input.tags,
        energy: input.energy,
        mood: input.mood,
        body: input.body,
        inputMode: 'manual',
        dayKey: input.dayKey || getTodayKey(),
        startMinutes: roundToFive(input.startMinutes),
        endMinutes: roundToFive(input.endMinutes)
      });
    } else {
      var endMinutes = roundToFive(getCurrentMinutes());
      var duration = Number(input.duration) || 0;
      event = normalizeEvent({
        activity: input.activity,
        note: input.note,
        tags: input.tags,
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

    var existing = state.events.map(normalizeEvent);
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

  function getTodaySummary() {
    var events = getTodayEvents();
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

  function exportData() {
    var payload = JSON.stringify({
      version: 2,
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

  return {
    getTodayKey: getTodayKey,
    getTodayEvents: getTodayEvents,
    getEventsByDay: getEventsByDay,
    getWeekKeys: getWeekKeys,
    getWeekEvents: getWeekEvents,
    getTodaySummary: getTodaySummary,
    getRecentOuting: getRecentOuting,
    createEvent: createEvent,
    deleteEvent: deleteEvent,
    createOuting: createOuting,
    exportData: exportData,
    pad: pad,
    roundToFive: roundToFive
  };
})();
