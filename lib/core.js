/**
 * Violin annotation tool — pure-function core.
 *
 * These functions are stateless given their inputs and have no DOM /
 * audio / localStorage dependencies. Extracted from index.html so they
 * can be unit-tested under Node and reused without bringing the whole
 * tool in.
 *
 * Loaded in the browser via <script src="lib/core.js"></script>, exposed
 * as window.AnnoCore. In Node tests, imported via require().
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AnnoCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Per-note labels that DON'T change cardinality of the play sequence.
  // (Span-based & single-note errors that only affect status, not order.)
  const PER_NOTE_LABEL_TYPES = new Set([
    'wrong_note', 'intonation', 'pause', 'tempo_drift', 'early_late_entry'
  ]);

  /**
   * Build the expected audio→score play sequence by walking the score and
   * applying error annotations as edits. Returns an array of
   * { score_idx, pass_number, status } records, one per expected audio onset.
   *
   * - skip:            removes [start..end] from the sequence (no records)
   * - stopped_restart: emits stop note, then jumps back and replays restart..stop
   * - repetition:      emits the span k times, with clean/repetition labels
   *                    determined by trigger ('clean' or 'corrective')
   * - note_swap:       emits endIdx before startIdx
   * - per-note errors: applied as status overlays (wrong_note, intonation, etc.)
   *
   * Structural priority when multiple annotations start at the same index:
   *   skip > stopped_restart > repetition > note_swap
   */
  function buildPlaySequence(noteIndex, annotations) {
    const N = noteIndex.length;
    const seq = [];
    const passCounter = new Array(N).fill(0);

    const byStart = new Map();
    const byNote = [];
    for (let i = 0; i < N; i++) byNote.push([]);
    for (const a of annotations) {
      if (!byStart.has(a.startIdx)) byStart.set(a.startIdx, []);
      byStart.get(a.startIdx).push(a);
      const lo = Math.min(a.startIdx, a.endIdx);
      const hi = Math.max(a.startIdx, a.endIdx);
      for (let i = lo; i <= hi; i++) {
        if (i >= 0 && i < N) byNote[i].push(a);
      }
    }

    function statusForNote(idx, defaultStatus) {
      for (const a of byNote[idx]) {
        if (PER_NOTE_LABEL_TYPES.has(a.type)) return a.type;
      }
      return defaultStatus;
    }

    let i = 0;
    while (i < N) {
      const here = byStart.get(i) || [];

      const skip = here.find(a => a.type === 'skip');
      if (skip) {
        i = skip.endIdx + 1;
        continue;
      }

      const sr = here.find(a => a.type === 'stopped_restart');
      if (sr) {
        const stopIdx = sr.startIdx;
        const restartIdx = sr.endIdx;
        passCounter[stopIdx]++;
        seq.push({
          score_idx: stopIdx,
          pass_number: passCounter[stopIdx],
          status: statusForNote(stopIdx, 'stopped_restart'),
        });
        let j = restartIdx;
        while (j <= stopIdx) {
          passCounter[j]++;
          seq.push({
            score_idx: j,
            pass_number: passCounter[j],
            status: statusForNote(j, passCounter[j] > 1 ? 'stopped_restart' : 'clean'),
          });
          j++;
        }
        i = stopIdx + 1;
        continue;
      }

      const rep = here.find(a => a.type === 'repetition');
      if (rep) {
        const times = parseInt(rep.extra && rep.extra.times_played) || 2;
        const trigger = (rep.extra && rep.extra.trigger) || 'clean';
        for (let pass = 1; pass <= times; pass++) {
          for (let j = rep.startIdx; j <= rep.endIdx; j++) {
            passCounter[j]++;
            let status;
            if (trigger === 'clean') {
              status = (pass === 1) ? statusForNote(j, 'clean') : 'repetition';
            } else {
              status = (pass === times) ? 'clean' : statusForNote(j, 'clean');
            }
            seq.push({
              score_idx: j,
              pass_number: passCounter[j],
              status,
            });
          }
        }
        i = rep.endIdx + 1;
        continue;
      }

      const swap = here.find(a => a.type === 'note_swap');
      if (swap && swap.startIdx !== swap.endIdx) {
        passCounter[swap.endIdx]++;
        seq.push({
          score_idx: swap.endIdx,
          pass_number: passCounter[swap.endIdx],
          status: 'note_swap',
        });
        passCounter[swap.startIdx]++;
        seq.push({
          score_idx: swap.startIdx,
          pass_number: passCounter[swap.startIdx],
          status: 'note_swap',
        });
        i = swap.endIdx + 1;
        continue;
      }

      passCounter[i]++;
      seq.push({
        score_idx: i,
        pass_number: passCounter[i],
        status: statusForNote(i, 'clean'),
      });
      i++;
    }

    return seq;
  }

  /** Assign tap times to the play sequence. Returns a {score_idx -> [pass]} map.
   *
   * Status semantics:
   *   'skipped'  — score note absent from seq (annotator marked a skip)
   *   'untapped' — score note in seq but no tap recorded for it
   *   anything else — copies seq[k].status
   */
  function assignTapsToSequence(taps, seq, noteIndex) {
    const N = noteIndex.length;
    const onsets = {};
    const seqIdxSet = new Set(seq.map(r => r.score_idx));
    for (let i = 0; i < N; i++) {
      if (!seqIdxSet.has(i)) {
        onsets[i] = [{ audio_t: null, pass_number: 1, status: 'skipped' }];
      } else {
        onsets[i] = [];
      }
    }
    const M = Math.min(taps.length, seq.length);
    for (let k = 0; k < M; k++) {
      const r = seq[k];
      onsets[r.score_idx].push({
        audio_t: taps[k].audio_t,
        pass_number: r.pass_number,
        status: r.status,
      });
    }
    for (let k = M; k < seq.length; k++) {
      const r = seq[k];
      onsets[r.score_idx].push({
        audio_t: null,
        pass_number: r.pass_number,
        status: 'untapped',
      });
    }
    return onsets;
  }

  /** Compute expected tap count + breakdown by error type.
   *  Returns: { N, expected, delta, breakdown, errorsByType } */
  function computeExpectedTapCount(noteIndex, annotations) {
    const N = noteIndex.length;
    const breakdown = [];
    const errorsByType = {};
    let delta = 0;

    for (const a of annotations) {
      errorsByType[a.type] = (errorsByType[a.type] || 0) + 1;
      const lo = Math.min(a.startIdx, a.endIdx);
      const hi = Math.max(a.startIdx, a.endIdx);
      const len = hi - lo + 1;
      let contribution = 0;
      let detail = '';
      switch (a.type) {
        case 'skip':
          contribution = -len;
          detail = `removes ${len} note${len === 1 ? '' : 's'} from sequence`;
          break;
        case 'repetition': {
          const k = parseInt(a.extra && a.extra.times_played) || 2;
          contribution = (k - 1) * len;
          const trigger = (a.extra && a.extra.trigger) || 'clean';
          detail = `${k}× of ${len} note${len === 1 ? '' : 's'} (${trigger}) → +${contribution}`;
          break;
        }
        case 'stopped_restart': {
          const stop = a.startIdx, restart = a.endIdx;
          const replay = stop - restart + 1;
          contribution = replay > 0 ? replay : 0;
          detail = `replays notes ${restart}–${stop} → +${contribution}`;
          break;
        }
        case 'note_swap':
          contribution = 0;
          detail = `reorders 2 notes, no count change`;
          break;
        default:
          contribution = 0;
          detail = `per-note label, no count change`;
      }
      delta += contribution;
      breakdown.push({
        type: a.type,
        ann_id: a.id,
        span: a.startIdx === a.endIdx ? `note ${a.startIdx}` : `notes ${lo}–${hi}`,
        contribution,
        detail,
      });
    }

    return { N, expected: N + delta, delta, breakdown, errorsByType };
  }

  /** Find the time of the peak novelty value within [centerT ± radiusS].
   *  Returns null if no frames fall in the window or none satisfy minT.
   *  env: { times: Float32Array|number[], novelty: Float32Array|number[] } */
  function findPeakInWindow(env, centerT, radiusS, minT) {
    if (minT === undefined) minT = -Infinity;
    const times = env.times;
    const novelty = env.novelty;
    const lo = centerT - radiusS;
    const hi = centerT + radiusS;
    // Binary search for the first index with time >= lo.
    let a = 0, b = times.length - 1, start = times.length;
    while (a <= b) {
      const m = (a + b) >> 1;
      if (times[m] >= lo) { start = m; b = m - 1; } else { a = m + 1; }
    }
    let bestI = -1, bestV = -Infinity;
    for (let i = start; i < times.length && times[i] <= hi; i++) {
      if (times[i] <= minT) continue;
      if (novelty[i] > bestV) { bestV = novelty[i]; bestI = i; }
    }
    return bestI < 0 ? null : times[bestI];
  }

  /** Resolve the audio time for an annotation: prefer noteOnsets[startIdx]'s
   *  first non-null pass; fall back to legacy ann.audioTime (v1 schema). */
  function audioTimeForAnnotation(ann, noteOnsets) {
    const onsets = noteOnsets && noteOnsets[ann.startIdx];
    if (onsets) {
      for (const p of onsets) {
        if (p.audio_t != null) return p.audio_t;
      }
    }
    return (ann.audioTime != null) ? ann.audioTime : null;
  }

  /** Insert a tap into a chronologically-sorted taps array.
   *  Returns the index it was inserted at. Pure (returns position; mutates in place).
   *  Use as: const i = insertTapInOrder(taps, t); */
  function insertTapInOrder(taps, audio_t) {
    let lo = 0, hi = taps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      const tt = taps[m].audio_t;
      if (tt == null || tt > audio_t) hi = m; else lo = m + 1;
    }
    taps.splice(lo, 0, { audio_t });
    return lo;
  }

  return {
    PER_NOTE_LABEL_TYPES,
    buildPlaySequence,
    assignTapsToSequence,
    computeExpectedTapCount,
    findPeakInWindow,
    audioTimeForAnnotation,
    insertTapInOrder,
  };
}));
