# Violin Error Annotation Tool

A browser-based tool for annotating performance errors in student violin recordings, **plus** capturing per-note audio onset times for downstream model training and evaluation. Designed for use by violin professionals — no programming required.

## Quick Start

1. Open the tool in your browser: [**Launch Annotation Tool**](index.html)
2. Load your **audio file** (WAV, MP3, OGG, or FLAC)
3. Load the **MusicXML score** for the piece being performed
4. Enter your **name** in the Annotator field
5. Annotate in **two passes**:
   - **Pass A — Errors:** mark each error as you hear it (see below)
   - **Pass B — Tap-Align:** click "🎵 Tap-Align" and tap SPACE on each note onset
6. **Review & refine** (optional): open ✎ Edit Taps to nudge individual timings or run 🪄 Snap to Onsets to auto-align to waveform peaks
7. Click **↓ Save & Export Aligned JSON** when done

> New to the tool? Click **? Help** in the top-right for the full in-app guide (auto-shows on first visit).

## How to Annotate

### Step 1: Select an Error Type

Click one of the 9 error type buttons in the toolbar, or press keys **1-9**:

| Key | Error Type | Clicks | What It Means |
|-----|-----------|--------|---------------|
| 1 | Wrong Note | 1 | A clearly incorrect pitch |
| 2 | Intonation | 2 | Notes that are out of tune (sharp/flat) |
| 3 | Note Swap | 2 | Two adjacent notes played in reversed order |
| 4 | Skip | 2 | Notes omitted entirely |
| 5 | Repetition | 2 | A passage played more than once |
| 6 | Pause | 1 | An unintended stop or hesitation |
| 7 | Tempo Drift | 2 | Gradually speeding up or slowing down |
| 8 | Early/Late | 2 | Notes entered significantly early or late |
| 9 | Stop+Restart | 2 | Performer stops and restarts from earlier |

### Step 2: Click Notes in the Score

- For **1-click** errors (Wrong Note, Pause): click the affected note
- For **2-click** errors: click the **start** note, then the **end** note
- For **Stop+Restart**: click where the performer stopped, then where they restarted from

### Step 3: Fill in Details

A popup will appear with fields specific to the error type:
- Set the **severity** (1 = mild, 2 = moderate, 3 = severe)
- Fill in any type-specific fields (e.g., "sharp" or "flat" for intonation)
- Add optional **notes** describing what you heard
- Click **Confirm** to save

You don't need to record audio time for each error — it's captured per-note during the **Tap-Align** pass below, which is much more accurate than a single timestamp at click time.

### Step 4: Tap-Align (per-note audio onset times)

After all errors are marked, click **🎵 Tap-Align** in the toolbar.

The tool builds an *expected play sequence* from your error annotations:
- **Skips** are removed from the sequence (no tap expected)
- **Repetitions** expand the span by `times_played` (tap each pass)
- **Note swaps** reverse the order
- **Stop+restart** plays forward to stop, then jumps back

While Tap-Align is active:

| Key | Action |
|---|---|
| **Space** | Record a tap at the current playhead time |
| **Backspace** | Undo last tap |
| **P** | Play / pause audio (Space is now Tap) |
| **Esc** | End Tap-Align (saves your taps) |

The next-expected score note is highlighted in blue, and a counter + progress bar show `Tap N / M (X%)`. When you stop, the tool reports any mismatch between recorded and expected tap counts — a mismatch usually means a missed error annotation or a missed tap.

**During Tap-Align you'll see:**
- Tapped notes get a persistent **green highlight** (darker for repeated passes)
- A horizontal **progress bar** above the score fills as you tap
- Backspace removes the most recent green highlight in sync

### After Tap-Align: review your alignment

The score and audio stay in sync during normal playback:
- **Green highlights** persist on every tapped score note; repeated passes stack darker
- As audio plays, the **currently-sounding** note gets a **yellow glow** that bounces along the score
- **Click any score note** (outside Tap-Align / error-marking) to seek the playhead to that note's tap time. Press Space to start playback if you want to hear it.

### Step 5 (optional): Sanity-check your counts — 🔍 Check Counts

Click **🔍 Check Counts** any time to open a modal that shows how the expected tap count is derived from your error annotations:

```
expected = N − Σ skip_lengths
             + Σ (times_played − 1) × rep_length
             + Σ stopped_restart_replays
```

Per-annotation contribution is listed row-by-row. Run before Tap-Align to catch missing error labels, and after to confirm counts match.

### Step 6 (optional): Review & refine — ✎ Edit Taps

Open the **✎ Edit Taps** panel for a spreadsheet-style view of every recorded tap. The panel is **non-blocking** — audio controls and the score stay clickable behind it, so you can listen while you edit.

| Column | Meaning |
|---|---|
| `#` | Tap index (1-based) |
| `time (s)` | Audio time — editable number input |
| `score note` | Which score note this tap maps to (derived from the play sequence) |
| `pass` | 1, 2, ... for repeated passes |
| `status` | `clean`, `wrong_note`, `intonation`, `repetition`, `untapped`, etc. |
| `actions` | `−50ms` / `+50ms` nudge · `▶` seek · `＋` insert-after · `🗑` delete |

Inside the panel:

| Key | Action |
|---|---|
| **Space** | Record a new tap at the current playhead (inserted in chronological order; row flashes green) |
| **P** | Play / pause audio |

While playing, the row that corresponds to the current playhead is highlighted yellow in sync with the score's yellow follow-highlight — so you can watch both advance together.

Footer buttons: **+ Insert at top**, **🗑 Clear All**, **↓ Save & Export Aligned JSON**, **Cancel** (reverts all edits since open), **Save**.

### Step 7 (optional): Auto-refine with 🪄 Snap to Onsets

Inside the Edit Taps panel, click **🪄 Snap to Onsets** to move every tap to the nearest amplitude-onset peak within a configurable window (default ±150 ms). Compensates for the 80–150 ms latency/jitter of human tap inputs.

- Adjustable `window (ms)` input (20–500)
- Monotonicity-preserving (no two taps collide)
- Affected rows flash in sequence after the operation
- A summary reports `Snapped: N · Unchanged: M · Avg shift: X ms · Max shift: Y ms`
- Cancel reverts if the result overshoots

### Step 8: Export

| Button | What it gives you |
|---|---|
| **Export CSV** | Spreadsheet of error annotations (with `start_audio_t` / `end_audio_t` once Tap-Align has run) |
| **Export JSON** | Original annotations + raw taps + per-note onsets in one blob (re-importable) |
| **Export Aligned JSON** | **One record per score note**, with `passes: [{audio_t, pass_number, status}]`. This is the format downstream model training/eval expects. |
| **↓ Save & Export Aligned JSON** (inside Edit Taps panel) | One-click commit + download |

### Repetition trigger field (important)

When you mark a repetition, the tool now asks **why** the passage was repeated:

- **Clean repeat** — first pass was fine, the extra play is the error. Pass 1 keeps its own labels; pass 2+ becomes `repetition`.
- **Corrective repeat** — first pass had a mistake, last pass is the corrected version. Pass 1 keeps its mistake label; the final pass becomes `clean`.

If the corrective repeat fixed an underlying error (e.g., a wrong note), mark that error separately as a normal `wrong_note` annotation at its score location. The tool then composes the two: pass 1 = wrong_note at that index, pass 2 = clean.

## Playback Controls

| Control | Action |
|---------|--------|
| **Space** | Play / Pause |
| **Left Arrow** | Skip back 2 seconds |
| **Right Arrow** | Skip forward 2 seconds |
| **[** | Slow down playback |
| **]** | Speed up playback |
| **Esc** | Cancel current annotation |

Use the **Speed** dropdown to slow playback to 0.25x for catching subtle errors.

## What to Annotate

**Do annotate:**
- Wrong notes (clearly incorrect pitch)
- Intonation issues (out of tune)
- Skipped or repeated passages
- Unintended pauses or stops
- Tempo problems (rushing or dragging)

**Do NOT annotate:**
- Expressive rubato (intentional timing variation)
- Vibrato or portamento (expressive techniques)
- Dynamic differences from the score
- Subjective quality judgments

## Tips

- Listen at **normal speed first** to get an overview, then at **0.5x** to catch details
- Your work is **auto-saved** every 30 seconds — if you accidentally close the tab, it will offer to restore when you reopen
- You can **edit** or **delete** any annotation from the list at the bottom
- You can **import** a previously exported file to continue annotating
- **Click an annotation row** to seek the playhead to that error (after Tap-Align)
- If you re-edit error annotations after running Tap-Align, the alignment is no longer in sync — re-run Tap-Align to refresh the per-note mapping
- **🪄 Snap to Onsets** is your friend: do a rough tap pass at normal speed, then snap to refine. Much faster than tapping precisely

## Privacy

All processing happens in your browser. No audio or score data is uploaded anywhere. Your files stay on your machine.

## Technical Requirements

- A modern browser (Chrome, Firefox, Safari, Edge)
- Audio files in WAV, MP3, OGG, or FLAC format
- Score files in MusicXML format (.xml, .musicxml, or .mxl)

## For developers

The pure-function core (play-sequence builder, tap assignment, expected-count calculator, onset-peak finder, etc.) lives in `lib/core.js` and is unit-tested under `tests/`.

```bash
# Requires Node 18+
npm test
```

The same `lib/core.js` is loaded by the browser tool via a `<script src="lib/core.js">` tag and exposed as `window.AnnoCore`. UMD wrapper means it works in both contexts without a build step.

## Aligned JSON schema (v2)

```json
{
  "schema_version": 2,
  "metadata": {
    "filename": "...",
    "score": "...",
    "annotator": "...",
    "date": "ISO timestamp",
    "num_notes": 92,
    "num_taps": 87,
    "num_expected": 87
  },
  "notes": [
    {
      "score_idx": 0,
      "measure_beat": "1.1",
      "pitch": "G4",
      "passes": [
        { "audio_t": 0.42, "pass_number": 1, "status": "clean" }
      ]
    },
    {
      "score_idx": 5,
      "measure_beat": "2.1",
      "pitch": "D5",
      "passes": [
        { "audio_t": 4.18, "pass_number": 1, "status": "wrong_note" },
        { "audio_t": 6.85, "pass_number": 2, "status": "clean" }
      ]
    },
    { "score_idx": 7, "measure_beat": "2.3", "pitch": "F#5",
      "passes": [{ "audio_t": null, "pass_number": 1, "status": "skipped" }] }
  ],
  "annotations": [ /* original error annotations for traceability */ ]
}
```

`status` values: `clean`, `wrong_note`, `intonation`, `pause`, `tempo_drift`, `early_late_entry`, `note_swap`, `repetition`, `stopped_restart`, `skipped`, `unaligned`.
