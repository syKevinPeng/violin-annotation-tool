# Violin Error Annotation Tool

A browser-based tool for annotating performance errors in student violin recordings, **plus** capturing per-note audio onset times for downstream model training and evaluation. Designed for use by violin professionals — no programming required.

## Quick Start

1. Open the tool in your browser: [**Launch Annotation Tool**](index.html)
2. Load your **audio file** (WAV, MP3, OGG, or FLAC)
3. Load the **MusicXML score** for the piece being performed
4. Enter your **name** in the Annotator field
5. Annotate in **two passes**:
   - **Pass 1 — Errors:** mark each error type as you hear it (see below)
   - **Pass 2 — Tap-Align:** click "🎵 Tap-Align" and tap SPACE on each note onset
6. Click **Export Aligned JSON** when done

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

The next-expected score note is highlighted in blue, and a counter shows `Tap N / M`. When you stop, the tool reports any mismatch between recorded and expected tap counts — a mismatch usually means a missed error annotation or a missed tap.

### Step 5: Export

| Button | What it gives you |
|---|---|
| **Export CSV** | Spreadsheet of error annotations only (no per-note onsets) |
| **Export JSON** | Original annotations + raw taps + per-note onsets in one blob |
| **Export Aligned JSON** | **One record per score note**, with `passes: [{audio_t, pass_number, status}]`. This is the format downstream model training/eval expects. |

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
- Your work is **auto-saved** in the browser — if you accidentally close the tab, it will offer to restore when you reopen
- You can **edit** or **delete** any annotation from the list at the bottom
- You can **import** a previously exported file to continue annotating

## Privacy

All processing happens in your browser. No audio or score data is uploaded anywhere. Your files stay on your machine.

## Technical Requirements

- A modern browser (Chrome, Firefox, Safari, Edge)
- Audio files in WAV, MP3, OGG, or FLAC format
- Score files in MusicXML format (.xml, .musicxml, or .mxl)

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
