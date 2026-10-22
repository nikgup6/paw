PAW BUDDY sticker packs — where the art goes
============================================

Six packs, eight stickers each. Put the files in exactly this layout and nothing in the code
needs to change:

  public/stickers/labrador/01.webp .. 08.webp     512 x 512, under 100 KB each   (shown in the grid)
  public/stickers/labrador/01.png  .. 08.png      512 x 512 transparent PNG      (used by Share and Download)
  public/stickers/labrador/pack.zip               the eight PNGs, zipped by you

...and the same for:  golden/   beagle/   indie/   spitz/   pug/

Sticker order (01 to 08) must match these captions, which live in src/constants/stickers.js:

  01  Hiiii!
  02  Feed me
  03  Zoomies!
  04  Walk time?
  05  Sleepy
  06  Wait, what?
  07  Good boy
  08  Treat plz

When every folder is filled in, open src/constants/stickers.js and set:

  export const STICKERS_LIVE = true;

Until then the packs are hidden everywhere and /stickers sends people to the home page, so a
half-filled folder can never show broken images to a visitor.

Note: the zip is NOT built in the browser. Zip the eight PNGs yourself and drop pack.zip in.
