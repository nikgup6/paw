/* The options for the "See us together" avatar card.

   Everything about the avatars lives in this one file, so options are easy to add, change or replace:
   - skins ...... skin tones (3)
   - hairs ...... hair styles (4), each drawn from simple shapes (`back` = behind the head, `front` = over it)
   - outfits .... top colours (3)
   3 x 4 x 3 = 36 combinations, all drawn in code (AvatarArt.jsx). No images are fetched.

   TO SWAP IN BETTER ART LATER: keep the ids, and change the colours / shapes here (or replace the
   renderer in AvatarArt.jsx). Nothing else in the app reads these shapes.

   PRIVACY: the name typed into the card is never stored or sent anywhere; see cleanName(). */

export const HAIR_COLOUR = '#2A1A12';

export const AVATAR_OPTIONS = {
  skins: [
    { id: 'light', label: 'Light skin', color: '#F6D2B0' },
    { id: 'medium', label: 'Medium skin', color: '#D9A06F' },
    { id: 'deep', label: 'Deep skin', color: '#8D5A3B' },
  ],
  hairs: [
    {
      id: 'short', label: 'Short hair',
      back: [],
      front: [{ type: 'path', d: 'M39 31C38 12 82 12 81 31C77 23 67 20 60 20C53 20 43 23 39 31Z' }],
    },
    {
      id: 'bun', label: 'Hair bun',
      back: [],
      front: [
        { type: 'circle', cx: 60, cy: 9, r: 8 },
        { type: 'path', d: 'M39 31C38 12 82 12 81 31C77 23 67 20 60 20C53 20 43 23 39 31Z' },
      ],
    },
    {
      id: 'long', label: 'Long hair',
      back: [{ type: 'path', d: 'M37 30C32 62 38 76 48 80L50 36Z' }, { type: 'path', d: 'M83 30C88 62 82 76 72 80L70 36Z' }],
      front: [{ type: 'path', d: 'M39 31C38 12 82 12 81 31C77 23 67 20 60 20C53 20 43 23 39 31Z' }],
    },
    {
      id: 'curly', label: 'Curly hair',
      back: [],
      front: [
        { type: 'circle', cx: 43, cy: 21, r: 9 }, { type: 'circle', cx: 56, cy: 14, r: 10 },
        { type: 'circle', cx: 71, cy: 15, r: 10 }, { type: 'circle', cx: 82, cy: 25, r: 8 },
        { type: 'circle', cx: 38, cy: 33, r: 7 }, { type: 'circle', cx: 84, cy: 37, r: 6 },
      ],
    },
  ],
  outfits: [
    { id: 'orange', label: 'Orange top', color: '#F5691A' },
    { id: 'navy', label: 'Navy top', color: '#011E4A' },
    { id: 'blue', label: 'Blue top', color: '#5B8FD0' },
  ],
};

export const DEFAULT_AVATAR = { skin: 'medium', hair: 'short', outfit: 'orange' };

export const NAME_MAX = 14;

/** Letters, spaces and digits only, trimmed of leading spaces, at most NAME_MAX characters. Kept in memory only. */
export function cleanName(raw = '') {
  return String(raw).replace(/[^\p{L}\p{N} ]/gu, '').replace(/^\s+/, '').slice(0, NAME_MAX);
}

export const findOption = (list, id) => list.find((o) => o.id === id) || list[0];
