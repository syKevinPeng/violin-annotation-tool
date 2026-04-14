# Violin Error Annotation Tool

A browser-based tool for annotating performance errors in student violin recordings. Designed for use by violin professionals — no programming required.

## Quick Start

1. Open the tool in your browser: [**Launch Annotation Tool**](index.html)
2. Load your **audio file** (WAV, MP3, OGG, or FLAC)
3. Load the **MusicXML score** for the piece being performed
4. Enter your **name** in the Annotator field
5. Start annotating!

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

### Step 4: Export

When finished, click **Export CSV** or **Export JSON** to download your annotations.

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
