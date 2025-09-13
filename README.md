# Abalone (JS)

 A minimal browser-based implementation of the Abalone board game. Click a marble to select it, then drag in a direction or use the direction buttons to move. When moving, the game automatically includes up to two adjacent friendly marbles inline to perform pushes when legal. First to eject 6 opponent marbles wins.

## Run

Open `index.html` in a browser. No build step or dependencies.

## Files

- `index.html`: App shell and controls
- `styles.css`: Minimal styling
- `src/abalone.js`: Core game engine (board, rules, move application)
- `src/ui.js`: SVG board rendering, click/drag interactions (single select)

## Notes

- Board uses axial hex coordinates on a radius-4 hex (61 cells).
- Initial setup follows the classic arrangement: top two rows full for White, third row centered three; mirrored for Black.
- The UI uses single selection; on move it auto-extends to an inline group up to length 3 when possible.

## Known gaps

- No multi-cell drag; movement is via direction buttons.
- No manual multi-select; pushing multiple marbles is inferred from the single selection.
- No move history/undo.
