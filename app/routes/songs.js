const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
// const logger = require('morgan');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const _ = require('lodash');

const { dbInit, getDb, playlists } = require('../db');
const { handleError, log } = require('../utils');
const {
  ERROR,
  NOTFOUND,
  NOCONTENT,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARNING,
  LOG_LEVEL_ERROR,
} = require('../constants');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get all the songs in a given playlist
// (accessed at GET http://localhost:<port>/api/v1/playlists/:playlist_id/songs)
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/songs called with GET url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR,
          'Error getting playlist "' + playlistId + '" - ' + err);
        log(LOG_LEVEL_WARNING, 'Reconnecting to DB...');
        dbInit();
        return;
      }

      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND, `Playlist "${playlistId}" not found`);
      } else {
        log(LOG_LEVEL_DEBUG, rows[0].name);
        const playlist = playlists[rows[0].name];
        if (playlist) {
          if ((!playlist._songsToPlay) || (!playlist._fileLoaded)) {
            handleError(res, httpStatus.NO_CONTENT, NOCONTENT,
              'Playlist "' + playlistId + '" has no songs loaded');
            return;
          }
          let songList = _.cloneDeep(playlist._songsToPlay);
          log(LOG_LEVEL_DEBUG, 'Query string...');
          log(LOG_LEVEL_DEBUG, req.query);
          const { start, length } = req.query;
          log(LOG_LEVEL_DEBUG, 'Query string for start = ' + start);
          log(LOG_LEVEL_DEBUG, 'Query string for length = ' + length);
          if (start) {
            songList = songList.slice(start);
          }
          if (length) {
            songList = songList.slice(0, length);
          }
          const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
          for (let i = 0; i < songList.length; i++) {
            const o = songList[i];
            o.uri = `${fullUrl}/${i}`;
          }
          log(LOG_LEVEL_DEBUG, '    ' + playlist.count() + ' songs');
          const count = songList.length;
          res.status(httpStatus.OK);
          if (start) {
            res.header('X-Start', `${start}`);
          }
          res.header('X-Count', `${count}`);
          res.header('X-Total-Count', `${playlist._songsToPlay.length}`);
          res.json({
            status: 'OK',
            result: { playlist: playlistId, songs: songList, count }
          });
        } else {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" is in the DB but not the memory list');
        }
      }
    }
  );
});

// get song metadata for a given playlist
// (accessed at HEAD http://localhost:<port>/api/v1/playlists/:playlist_id/songs)
router.head('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/songs called with HEAD url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR,
          'Error getting playlist "' + playlistId + '" - ' + err);
        log(LOG_LEVEL_WARNING, 'Reconnecting to DB...');
        dbInit();
        return;
      }

      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
          'Playlist "' + playlistId + '" not found');
      } else {
        log(LOG_LEVEL_DEBUG, rows[0].name);
        const playlist = playlists[rows[0].name];
        if (playlist) {
          if ((!playlist._songsToPlay) || (!playlist._fileLoaded)) {
            handleError(res, httpStatus.NO_CONTENT, NOCONTENT,
              'Playlist "' + playlistId + '" has no songs loaded');
            return;
          }
          log(LOG_LEVEL_DEBUG, '    ' + playlist._songsToPlay.length + ' songs');
          let songList = _.clone(playlist._songsToPlay);
          log(LOG_LEVEL_DEBUG, 'Query string...');
          log(LOG_LEVEL_DEBUG, req.query);
          const { start, length } = req.query;
          log(LOG_LEVEL_DEBUG, 'Query string for start = ' + start);
          log(LOG_LEVEL_DEBUG, 'Query string for length = ' + length);
          if (start) {
            songList = songList.slice(start);
          }
          if (length) {
            songList = songList.slice(0, length);
          }
          const count = songList.length;
          res.status(httpStatus.OK);
          if (start) {
            res.header('X-Start', `${start}`);
          }
          res.header('X-Count', `${count}`);
          res.header('X-Total-Count', `${playlist._songsToPlay.length}`);
          res.end();
        } else {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" is in the DB but not the memory list');
        }
      }
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/songs)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/songs called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD');
  res.end();
});

// get song by index for a given playlist
// (accessed at GET http://localhost:<port>/api/v1/playlists/:playlist_id/songs/:song_index)
router.get('/:song_index', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/songs/:song_index called with GET url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR,
          'Error getting playlist "' + playlistId + '" - ' + err);
        log(LOG_LEVEL_WARNING, 'Reconnecting to DB...');
        dbInit();
        return;
      }

      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
          'Playlist "' + playlistId + '" not found');
      } else {
        log(LOG_LEVEL_DEBUG, rows[0].name);
        const playlist = playlists[rows[0].name];
        if (playlist) {
          if ((!playlist._songsToPlay) || (!playlist._fileLoaded)) {
            handleError(res, httpStatus.NO_CONTENT, NOCONTENT,
              'Playlist "' + playlistId + '" has no songs loaded');
            return;
          }
          log(LOG_LEVEL_DEBUG, '    ' + playlist.count() + ' songs');
          const count = playlist.count();
          if (req.params.song_index >= count) {
            handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
              'Playlist "' + playlistId + '" only has ' + count + ' songs');
            return;
          }
          const song = _.cloneDeep(playlist._songsToPlay[req.params.song_index]);
          song.playlist = playlistId;
          log(LOG_LEVEL_DEBUG, '    song... ');
          log(LOG_LEVEL_DEBUG, song);
          delete song['uri'];
          res.json({ status: 'OK', result: song });
        } else {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" is in the DB but not the memory list');
        }
      }
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/songs/:song_index)
router.options('/:playlist_id', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/songs/:song_index called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET');
  res.end();
});

router.use((req, res) => {
  res.status(httpStatus.NOT_FOUND).send('Sorry can\'t find that!');
});

router.use((error, req, res) => {
  // can this be modularized?
  log(LOG_LEVEL_ERROR, '/v1/playlists/:playlist_id/songs had an error');
  log(LOG_LEVEL_ERROR, error.stack);
  res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Something broke!');
});

module.exports = router;
