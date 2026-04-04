var Sync = (function() {
  var GIST_ID = '1dc49b8714cfebb11624078f58d88d3b';
  var GIST_FILE = 'time-observer-init.json';
  var GIST_URL = 'https://api.github.com/gists/' + GIST_ID;
  var STORAGE_KEY = 'quiet_life_records_v2';

  function readLocalState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultState();
      var parsed = JSON.parse(raw);
      return normalize(parsed);
    } catch (error) {
      return getDefaultState();
    }
  }

  function getDefaultState() {
    return {
      events: [],
      outings: [],
      journal: [],
      reminders: [],
      reviews: []
    };
  }

  function normalize(state) {
    return {
      events: Array.isArray(state.events) ? state.events : [],
      outings: Array.isArray(state.outings) ? state.outings : [],
      journal: Array.isArray(state.journal) ? state.journal : [],
      reminders: Array.isArray(state.reminders) ? state.reminders : [],
      reviews: Array.isArray(state.reviews) ? state.reviews : []
    };
  }

  function saveLocalState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function mergeArrayById(localArr, remoteArr) {
    var map = {};
    var i;
    for (i = 0; i < localArr.length; i++) {
      var item = localArr[i];
      if (item && item.id) map[item.id] = item;
    }
    for (i = 0; i < remoteArr.length; i++) {
      var remote = remoteArr[i];
      if (!remote || !remote.id) continue;
      var local = map[remote.id];
      if (!local) {
        map[remote.id] = remote;
      } else {
        var localTime = local.updatedAt || local.createdAt || '';
        var remoteTime = remote.updatedAt || remote.createdAt || '';
        if (remoteTime > localTime) {
          map[remote.id] = remote;
        }
      }
    }
    var result = [];
    var keys = Object.keys(map);
    for (i = 0; i < keys.length; i++) {
      result.push(map[keys[i]]);
    }
    return result;
  }

  function fetchAndMerge(callback) {
    fetch(GIST_URL, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Gist fetch failed: ' + response.status);
      return response.json();
    })
    .then(function(gist) {
      var file = gist.files && gist.files[GIST_FILE];
      if (!file || !file.content) throw new Error('Gist file not found');
      var payload = JSON.parse(file.content);
      var remoteData = payload.data || payload;
      var remote = normalize(remoteData);
      var local = readLocalState();

      var merged = {
        events: mergeArrayById(local.events, remote.events),
        outings: mergeArrayById(local.outings, remote.outings),
        journal: mergeArrayById(local.journal, remote.journal),
        reminders: mergeArrayById(local.reminders, remote.reminders),
        reviews: mergeArrayById(local.reviews, remote.reviews)
      };

      saveLocalState(merged);
      if (callback) callback(null, merged);
    })
    .catch(function(error) {
      console.error('同步失败', error);
      if (callback) callback(error, null);
    });
  }

  return {
    fetchAndMerge: fetchAndMerge
  };
})();
