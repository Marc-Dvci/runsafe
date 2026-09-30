# RUNSAFE

RUNSAFE is design software that applies mathematical proof to knitting. It gives knitwear a damage rating: how far one dropped stitch can run, proved, compiled into the knitting-machine program and checkable by anyone.

This repository holds the RUNSAFE website: a static page with the demo film and a working "Design from a rating" tool for the 160-stitch sample sleeve, and a proofs page with the definitions, theorems and complete proofs behind the rating.

## Run locally

```
python -m http.server 8000
```

Open http://127.0.0.1:8000/.

## Structure

| Path | Content |
|---|---|
| `index.html` | The page |
| `styles.css` | Styles, following RUNSAFE Studio |
| `app.js` | Navigation, film chapters and the rating tool |
| `proofs.html` | Definitions, theorems and complete proofs |
| `proofs/check.js` | Independent checker: rebuilds the capture graph and tests every theorem |
| `assets/img/` | Frames from RUNSAFE Studio |
| `assets/video/` | Demo film, captions and chapters |

## Check the proofs

```
node proofs/check.js
```

The same checks run in the browser from the proofs page (section 12). No dependencies.
