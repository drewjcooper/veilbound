# Veilbound

Veilbound is an original, two-player fantasy strategy game for the browser. Move rival courts across an 8×8 board, challenge opposing pieces, and defeat the enemy Crown to win.

## Play locally

No build step or package install is needed. From this folder, start a static file server:

```sh
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) and take turns on the same screen. (Any static server works.)

## Play online

After the GitHub Pages workflow completes its first deployment, play at [drewjcooper.github.io/veilbound](https://drewjcooper.github.io/veilbound/).

## Rules

- Select one of your pieces to show legal moves, then choose a glowing square. Moving onto an opponent starts an arena challenge; a winning attacker takes the square.
- Crown moves one square in any direction. Bulwark slides up to two squares orthogonally; Oracle slides up to three diagonally; Rider leaps in an L; Vanguard advances up to two squares and challenges diagonally forward.
- Battles are simultaneous choices, revealed after each player has picked: **Strike** deals damage, **Guard** blunts a strike and counters, and **Focus** heals and charges a future strike unless interrupted by a strike. Pieces keep their vitality between challenges.
- The Veil shifts every two moves: Sunward empowers Ember, Moonward empowers Gloam, and Eclipse empowers both. Defeating the opposing Crown wins the game.
- If none of your pieces can move, pass the turn. Use **New game** to reset the match.

## Tests

With Node.js 18 or later:

```sh
npm test
```
