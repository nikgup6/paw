/* PAW BUDDY sticker packs — six breeds, eight stickers each.

   HOW TO TURN THEM ON
   1. Drop the art into public/stickers/<key>/ using exactly these names:
        01.webp … 08.webp   512 x 512, under 100 KB each   (what the grid shows)
        01.png  … 08.png    512 x 512 transparent PNG       (what Share and Download hand over)
        pack.zip                                            (the eight PNGs, zipped by you, not by the browser)
      <key> is the pack key below: labrador, golden, beagle, indie, spitz, pug.
   2. Flip STICKERS_LIVE to true.
   Until then nothing sticker-related renders anywhere, and /stickers sends people home.

   HOW TO EDIT
   - Caption wording: the `captions` array (always eight, in pose order).
   - Which quiz breeds open which pack: `breedMatchNames` (these must match breeds.json names exactly).
   - A seventh pack: add an entry here and a folder in public/stickers/. No component changes needed. */

export const STICKERS_LIVE = false;   // flip to true once the files above exist

/** Pose order, shared by every pack. Index 0 is sticker 01. */
export const CAPTIONS = [
  'Hiiii!',
  'Feed me',
  'Zoomies!',
  'Walk time?',
  'Sleepy',
  'Wait, what?',
  'Good boy',
  'Treat plz',
];

export const STICKER_COUNT = CAPTIONS.length;

/* `breedMatchNames` uses the names in constants/breeds.json, which are not always the breed's formal
   name — the Indian Pariah Dog is called "Indie Dog" there, so that is what is listed. */
export const STICKER_PACKS = [
  { key: 'labrador', label: 'Labrador',     breedMatchNames: ['Labrador Retriever'] },
  { key: 'golden',   label: 'Golden Retriever', breedMatchNames: ['Golden Retriever'] },
  { key: 'beagle',   label: 'Beagle',       breedMatchNames: ['Beagle'] },
  { key: 'indie',    label: 'Indie Dog',    breedMatchNames: ['Indie Dog', 'Indian Pariah Dog'] },
  { key: 'spitz',    label: 'Indian Spitz', breedMatchNames: ['Indian Spitz'] },
  { key: 'pug',      label: 'Pug',          breedMatchNames: ['Pug'] },
].map((p) => ({
  ...p,
  captions: CAPTIONS,
  packZip: `/stickers/${p.key}/pack.zip`,
  webp: (i) => `/stickers/${p.key}/${String(i + 1).padStart(2, '0')}.webp`,
  png: (i) => `/stickers/${p.key}/${String(i + 1).padStart(2, '0')}.png`,
}));

/** The pack for a breed name from the quiz, or null when that breed has no pack. */
export function packForBreed(breedName) {
  if (!breedName) return null;
  return STICKER_PACKS.find((p) => p.breedMatchNames.includes(breedName)) || null;
}

/** The pack with this key, or null. */
export const packByKey = (key) => STICKER_PACKS.find((p) => p.key === key) || null;
