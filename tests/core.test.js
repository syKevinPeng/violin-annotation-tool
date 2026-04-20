/**
 * Tests for annotation_tool/lib/core.js — pure-function core.
 * Run with: `node --test tests/` (from the annotation_tool/ directory).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../lib/core.js');

// ─── Helpers ────────────────────────────────────────────────────────────────
function note(i) {
  return { globalIndex: i, measureBeat: `${Math.floor(i / 4) + 1}.${(i % 4) + 1}`, pitch: 'X' };
}
function noteIndexOf(n) {
  return Array.from({ length: n }, (_, i) => note(i));
}
function makeAnn(type, startIdx, endIdx, extra = {}, id) {
  return { id: id || (Date.now() + Math.random()), type, startIdx, endIdx, extra };
}
function statusesOf(seq) {
  return seq.map(r => r.status);
}
function scoreIdxOf(seq) {
  return seq.map(r => r.score_idx);
}

// ─── buildPlaySequence ──────────────────────────────────────────────────────

test('buildPlaySequence: clean score (no errors) emits one record per note', () => {
  const seq = C.buildPlaySequence(noteIndexOf(5), []);
  assert.equal(seq.length, 5);
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 2, 3, 4]);
  assert.deepEqual(statusesOf(seq), ['clean', 'clean', 'clean', 'clean', 'clean']);
  assert.deepEqual(seq.map(r => r.pass_number), [1, 1, 1, 1, 1]);
});

test('buildPlaySequence: skip removes notes from the sequence', () => {
  const seq = C.buildPlaySequence(noteIndexOf(10), [
    makeAnn('skip', 5, 7),
  ]);
  assert.equal(seq.length, 7); // 10 − 3
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 2, 3, 4, 8, 9]);
});

test('buildPlaySequence: per-note errors apply as status overlay without changing cardinality', () => {
  const seq = C.buildPlaySequence(noteIndexOf(5), [
    makeAnn('wrong_note', 2, 2),
  ]);
  assert.equal(seq.length, 5);
  assert.equal(seq[2].status, 'wrong_note');
  assert.equal(seq[1].status, 'clean');
  assert.equal(seq[3].status, 'clean');
});

test('buildPlaySequence: intonation span tags multiple consecutive notes', () => {
  const seq = C.buildPlaySequence(noteIndexOf(6), [
    makeAnn('intonation', 1, 3),
  ]);
  assert.deepEqual(statusesOf(seq), ['clean', 'intonation', 'intonation', 'intonation', 'clean', 'clean']);
});

test('buildPlaySequence: clean repeat — pass 1 = clean, passes 2+ = repetition', () => {
  const seq = C.buildPlaySequence(noteIndexOf(8), [
    makeAnn('repetition', 2, 4, { times_played: 2, trigger: 'clean' }),
  ]);
  // Notes 0,1 (clean) | notes 2,3,4 pass1 (clean) | notes 2,3,4 pass2 (repetition) | notes 5,6,7
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 2, 3, 4, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(statusesOf(seq), [
    'clean', 'clean',
    'clean', 'clean', 'clean',
    'repetition', 'repetition', 'repetition',
    'clean', 'clean', 'clean',
  ]);
});

test('buildPlaySequence: corrective repeat — last pass = clean, earlier passes carry underlying error', () => {
  const seq = C.buildPlaySequence(noteIndexOf(8), [
    makeAnn('repetition', 2, 4, { times_played: 2, trigger: 'corrective' }),
    makeAnn('wrong_note', 3, 3), // mistake on note 3 in pass 1
  ]);
  // Pass 1 of [2..4]: note 2 = clean (no underlying error), note 3 = wrong_note, note 4 = clean
  // Pass 2 (last) of [2..4]: all forced to clean (the corrected take)
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 2, 3, 4, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(statusesOf(seq), [
    'clean', 'clean',
    'clean', 'wrong_note', 'clean',  // pass 1 (the mistake)
    'clean', 'clean', 'clean',       // pass 2 (corrected, all clean)
    'clean', 'clean', 'clean',
  ]);
});

test('buildPlaySequence: corrective repeat ×3 — passes 1..k-1 carry error, last pass clean', () => {
  const seq = C.buildPlaySequence(noteIndexOf(5), [
    makeAnn('repetition', 1, 2, { times_played: 3, trigger: 'corrective' }),
    makeAnn('wrong_note', 1, 1),
  ]);
  // Pass 1: note 1 = wrong_note, note 2 = clean
  // Pass 2: note 1 = wrong_note, note 2 = clean
  // Pass 3 (last): both clean
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 2, 1, 2, 1, 2, 3, 4]);
  assert.deepEqual(statusesOf(seq), [
    'clean',
    'wrong_note', 'clean',
    'wrong_note', 'clean',
    'clean', 'clean',
    'clean', 'clean',
  ]);
});

test('buildPlaySequence: note_swap reverses two adjacent notes', () => {
  const seq = C.buildPlaySequence(noteIndexOf(5), [
    makeAnn('note_swap', 2, 3),
  ]);
  // Sequence: 0, 1, 3, 2, 4
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 3, 2, 4]);
  assert.equal(seq[2].status, 'note_swap');
  assert.equal(seq[3].status, 'note_swap');
});

test('buildPlaySequence: stopped_restart replays restart..stop after stop', () => {
  // Performer plays 0,1,2,3,4 (stops at 4), restarts from 2, plays 2,3,4,5,6
  const seq = C.buildPlaySequence(noteIndexOf(7), [
    makeAnn('stopped_restart', 4, 2),  // stop=4, restart=2
  ]);
  // Pass 1: 0,1,2,3 normal — then SR triggers at 4: emit 4 (pass1), then jump back, replay 2,3,4 (pass2)
  // Then continue 5,6 (pass1)
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 2, 3, 4, 2, 3, 4, 5, 6]);
});

test('buildPlaySequence: pass_number increments correctly across repetitions', () => {
  const seq = C.buildPlaySequence(noteIndexOf(5), [
    makeAnn('repetition', 1, 2, { times_played: 3, trigger: 'clean' }),
  ]);
  // Notes 1, 2 each visited 3 times
  const passOfNote = (idx) => seq.filter(r => r.score_idx === idx).map(r => r.pass_number);
  assert.deepEqual(passOfNote(1), [1, 2, 3]);
  assert.deepEqual(passOfNote(2), [1, 2, 3]);
  assert.deepEqual(passOfNote(0), [1]);
  assert.deepEqual(passOfNote(3), [1]);
});

test('buildPlaySequence: empty annotation list yields straight walk', () => {
  const seq = C.buildPlaySequence(noteIndexOf(3), []);
  assert.deepEqual(scoreIdxOf(seq), [0, 1, 2]);
});

test('buildPlaySequence: empty noteIndex yields empty seq', () => {
  const seq = C.buildPlaySequence([], []);
  assert.deepEqual(seq, []);
});

// ─── assignTapsToSequence ───────────────────────────────────────────────────

test('assignTapsToSequence: perfect match — every note gets one onset', () => {
  const seq = C.buildPlaySequence(noteIndexOf(3), []);
  const taps = [{ audio_t: 0.1 }, { audio_t: 0.5 }, { audio_t: 1.0 }];
  const onsets = C.assignTapsToSequence(taps, seq, noteIndexOf(3));
  assert.equal(onsets[0][0].audio_t, 0.1);
  assert.equal(onsets[1][0].audio_t, 0.5);
  assert.equal(onsets[2][0].audio_t, 1.0);
  assert.equal(onsets[0][0].status, 'clean');
});

test('assignTapsToSequence: skipped notes get status=skipped with audio_t=null', () => {
  const seq = C.buildPlaySequence(noteIndexOf(5), [
    makeAnn('skip', 1, 2),
  ]);
  const taps = [{ audio_t: 0.0 }, { audio_t: 1.0 }, { audio_t: 2.0 }]; // 3 taps for 0, 3, 4
  const onsets = C.assignTapsToSequence(taps, seq, noteIndexOf(5));
  assert.equal(onsets[1][0].status, 'skipped');
  assert.equal(onsets[1][0].audio_t, null);
  assert.equal(onsets[2][0].status, 'skipped');
  assert.equal(onsets[3][0].audio_t, 1.0);
});

test('assignTapsToSequence: fewer taps than expected — remaining notes marked untapped', () => {
  const seq = C.buildPlaySequence(noteIndexOf(5), []);
  const taps = [{ audio_t: 0.0 }, { audio_t: 0.5 }];  // only 2 of 5
  const onsets = C.assignTapsToSequence(taps, seq, noteIndexOf(5));
  assert.equal(onsets[0][0].status, 'clean');
  assert.equal(onsets[1][0].status, 'clean');
  assert.equal(onsets[2][0].status, 'untapped');
  assert.equal(onsets[2][0].audio_t, null);
  assert.equal(onsets[3][0].status, 'untapped');
  assert.equal(onsets[4][0].status, 'untapped');
});

test('assignTapsToSequence: extra taps beyond seq length are silently dropped', () => {
  const seq = C.buildPlaySequence(noteIndexOf(2), []);
  const taps = [{ audio_t: 0.0 }, { audio_t: 0.5 }, { audio_t: 1.0 }];  // 3 taps for 2 notes
  const onsets = C.assignTapsToSequence(taps, seq, noteIndexOf(2));
  // No 3rd note to assign to — extras dropped
  assert.equal(onsets[0].length, 1);
  assert.equal(onsets[1].length, 1);
});

test('assignTapsToSequence: repetition — each pass gets a separate onset on the same score note', () => {
  const seq = C.buildPlaySequence(noteIndexOf(4), [
    makeAnn('repetition', 1, 2, { times_played: 2, trigger: 'clean' }),
  ]);
  // Sequence: 0, 1, 2, 1, 2, 3 (6 notes)
  const taps = [
    { audio_t: 0.0 }, { audio_t: 0.5 }, { audio_t: 1.0 },
    { audio_t: 1.5 }, { audio_t: 2.0 }, { audio_t: 2.5 },
  ];
  const onsets = C.assignTapsToSequence(taps, seq, noteIndexOf(4));
  // Notes 1 and 2 each have 2 onsets
  assert.equal(onsets[1].length, 2);
  assert.equal(onsets[2].length, 2);
  assert.equal(onsets[1][0].audio_t, 0.5);   // pass 1
  assert.equal(onsets[1][0].status, 'clean');
  assert.equal(onsets[1][1].audio_t, 1.5);   // pass 2
  assert.equal(onsets[1][1].status, 'repetition');
});

// ─── computeExpectedTapCount ────────────────────────────────────────────────

test('computeExpectedTapCount: clean score — expected = N', () => {
  const r = C.computeExpectedTapCount(noteIndexOf(10), []);
  assert.equal(r.N, 10);
  assert.equal(r.expected, 10);
  assert.equal(r.delta, 0);
});

test('computeExpectedTapCount: skip subtracts span length', () => {
  const r = C.computeExpectedTapCount(noteIndexOf(10), [makeAnn('skip', 2, 4)]);
  assert.equal(r.expected, 7); // 10 − 3
  assert.equal(r.delta, -3);
  assert.equal(r.breakdown[0].contribution, -3);
});

test('computeExpectedTapCount: repetition adds (k-1) * len', () => {
  const r = C.computeExpectedTapCount(noteIndexOf(10), [
    makeAnn('repetition', 0, 2, { times_played: 3 }),
  ]);
  // 3 notes × (3-1) = +6
  assert.equal(r.delta, 6);
  assert.equal(r.expected, 16);
});

test('computeExpectedTapCount: stopped_restart adds (stop − restart + 1)', () => {
  const r = C.computeExpectedTapCount(noteIndexOf(10), [
    makeAnn('stopped_restart', 5, 2),
  ]);
  assert.equal(r.delta, 4); // notes 2,3,4,5 replayed
  assert.equal(r.expected, 14);
});

test('computeExpectedTapCount: per-note errors and note_swap do not change count', () => {
  const r = C.computeExpectedTapCount(noteIndexOf(10), [
    makeAnn('wrong_note', 3, 3),
    makeAnn('intonation', 5, 7),
    makeAnn('pause', 1, 1),
    makeAnn('tempo_drift', 4, 8),
    makeAnn('early_late_entry', 0, 1),
    makeAnn('note_swap', 2, 3),
  ]);
  assert.equal(r.delta, 0);
  assert.equal(r.expected, 10);
});

test('computeExpectedTapCount: combined errors compose additively', () => {
  const r = C.computeExpectedTapCount(noteIndexOf(20), [
    makeAnn('skip', 5, 6),                                   // -2
    makeAnn('repetition', 10, 12, { times_played: 2 }),      // +3
    makeAnn('stopped_restart', 17, 15),                      // +3
    makeAnn('wrong_note', 1, 1),                             // 0
  ]);
  assert.equal(r.delta, -2 + 3 + 3);
  assert.equal(r.expected, 24);
});

test('computeExpectedTapCount: errorsByType counts annotations per type', () => {
  const r = C.computeExpectedTapCount(noteIndexOf(10), [
    makeAnn('wrong_note', 1, 1),
    makeAnn('wrong_note', 3, 3),
    makeAnn('skip', 5, 6),
  ]);
  assert.equal(r.errorsByType.wrong_note, 2);
  assert.equal(r.errorsByType.skip, 1);
});

// ─── findPeakInWindow ───────────────────────────────────────────────────────

const SIMPLE_ENV = {
  times: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  novelty: [0.0, 0.5, 0.1, 0.0, 0.8, 0.0, 0.0, 0.3, 0.0, 0.6, 0.0],
};

test('findPeakInWindow: returns the highest novelty time within window', () => {
  // Window around 0.4 ± 0.2 → covers indices 2..6 → peak at idx 4 (val 0.8)
  const t = C.findPeakInWindow(SIMPLE_ENV, 0.4, 0.2);
  assert.equal(t, 0.4);
});

test('findPeakInWindow: returns null when window contains no frames', () => {
  const t = C.findPeakInWindow(SIMPLE_ENV, 5.0, 0.05);
  assert.equal(t, null);
});

test('findPeakInWindow: monotonicity guard — minT excludes earlier peaks', () => {
  // Window around 0.4 ± 0.5 covers everything; minT=0.45 excludes 0.4 (val 0.8)
  // → next-best in (0.45, 0.9] is idx 9 at 0.9 (val 0.6)
  const t = C.findPeakInWindow(SIMPLE_ENV, 0.4, 0.5, 0.45);
  assert.equal(t, 0.9);
});

test('findPeakInWindow: ties — earliest of equal-novelty peaks wins (strict >)', () => {
  const env = {
    times:   [0.1, 0.2, 0.3, 0.4],
    novelty: [0.5, 0.5, 0.5, 0.5],
  };
  const t = C.findPeakInWindow(env, 0.25, 0.2);
  assert.equal(t, 0.1);
});

// ─── audioTimeForAnnotation ─────────────────────────────────────────────────

test('audioTimeForAnnotation: returns first non-null pass audio_t from noteOnsets', () => {
  const ann = { startIdx: 5 };
  const noteOnsets = {
    5: [
      { audio_t: null, pass_number: 1, status: 'untapped' },
      { audio_t: 12.34, pass_number: 2, status: 'clean' },
    ],
  };
  assert.equal(C.audioTimeForAnnotation(ann, noteOnsets), 12.34);
});

test('audioTimeForAnnotation: legacy v1 fallback to ann.audioTime when noteOnsets empty', () => {
  const ann = { startIdx: 5, audioTime: 7.89 };
  assert.equal(C.audioTimeForAnnotation(ann, {}), 7.89);
});

test('audioTimeForAnnotation: returns null when no source available', () => {
  const ann = { startIdx: 5 };
  assert.equal(C.audioTimeForAnnotation(ann, {}), null);
});

test('audioTimeForAnnotation: noteOnsets entry exists but all passes are null → falls through to legacy', () => {
  const ann = { startIdx: 5, audioTime: 9.99 };
  const noteOnsets = { 5: [{ audio_t: null, pass_number: 1, status: 'untapped' }] };
  assert.equal(C.audioTimeForAnnotation(ann, noteOnsets), 9.99);
});

// ─── insertTapInOrder ───────────────────────────────────────────────────────

test('insertTapInOrder: inserts at the end when later than all', () => {
  const taps = [{ audio_t: 0.5 }, { audio_t: 1.0 }];
  const i = C.insertTapInOrder(taps, 2.0);
  assert.equal(i, 2);
  assert.deepEqual(taps.map(t => t.audio_t), [0.5, 1.0, 2.0]);
});

test('insertTapInOrder: inserts at the start when earlier than all', () => {
  const taps = [{ audio_t: 0.5 }, { audio_t: 1.0 }];
  const i = C.insertTapInOrder(taps, 0.1);
  assert.equal(i, 0);
  assert.deepEqual(taps.map(t => t.audio_t), [0.1, 0.5, 1.0]);
});

test('insertTapInOrder: inserts in middle, preserves sort', () => {
  const taps = [{ audio_t: 0.5 }, { audio_t: 2.0 }];
  const i = C.insertTapInOrder(taps, 1.2);
  assert.equal(i, 1);
  assert.deepEqual(taps.map(t => t.audio_t), [0.5, 1.2, 2.0]);
});

test('insertTapInOrder: empty taps array yields index 0', () => {
  const taps = [];
  const i = C.insertTapInOrder(taps, 1.5);
  assert.equal(i, 0);
  assert.equal(taps.length, 1);
  assert.equal(taps[0].audio_t, 1.5);
});

test('insertTapInOrder: ties — new tap goes after existing equal-time taps', () => {
  const taps = [{ audio_t: 1.0 }, { audio_t: 1.0 }];
  const i = C.insertTapInOrder(taps, 1.0);
  assert.equal(i, 2);
});
