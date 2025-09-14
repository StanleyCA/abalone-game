# Abalone (JS)

 A minimal browser-based implementation of the Abalone board game. Click a marble to select it, then drag in a direction or use the direction buttons to move. When moving, the game automatically includes up to two adjacent friendly marbles inline to perform pushes when legal. First to eject 6 opponent marbles wins.

## Run

Open `index.html` in a browser. No build step or dependencies.

## Files

- `index.html`: App shell and controls
- `styles.css`: Minimal styling
- `src/abalone.js`: Core game engine (board, rules, move application)
- `src/ui.js`: SVG board rendering, click/drag interactions (single select)
- `src/ai.js`: Simple AI (inline moves only) with 1–3 ply search

## Notes

- Board uses axial hex coordinates on a radius-4 hex (61 cells).
- Initial setup: top two rows full for Black, third row centered three; mirrored for White (White starts from the bottom).
- The UI uses single selection; on move it auto-extends to an inline group up to length 3 when possible.

## Known gaps

- No multi-cell drag; movement is via direction buttons.
- No manual multi-select; pushing multiple marbles is inferred from the single selection.
- No move history/undo.

## AI

- Use the AI controls below the board to let the AI play as White, Black, or both sides. The AI runs a fixed-depth search (negamax with depth of 2).

### AI Heuristics

- Captures: +100 per captured advantage (your captured minus opponent captured).
- Material: +10 per on-board marble advantage.
- Center control: +0.5 per unit closer to the center (sum over pieces).
- Edge pressure: +2.0 per unit of (your distance-to-edge sum minus opponent distance-to-edge sum). This rewards positions where your marbles are safer (further from the edge) and opponents are closer to the edge, indirectly favoring moves that push opponents toward the rim.
