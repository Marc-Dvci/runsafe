# RUNSAFE

RUNSAFE is design software that applies mathematical proof to knitting. It gives knitwear a damage rating: how far one snag can run, proved, compiled into the knitting-machine program and checkable by anyone.

This repository holds the RUNSAFE website: a static page with the demo film, the mathematics, and a working "Design from a rating" tool for the 160-stitch sample sleeve.

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
| `assets/img/` | Frames from RUNSAFE Studio |
| `assets/video/` | Demo film, captions and chapters |

## Contact

Marc Donovici · marcdonovici@gmail.com
