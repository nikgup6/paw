/* Structure and copy for the 3-part quiz (QuizFlow.jsx).

   This file only decides GROUPING and WORDING. The questions, options and the
   saved values still come from constants/questions.json (looked up by id), so
   the answers the matching engine receives are unchanged.

   HOW TO EDIT
   - Reorder / regroup: move a screen between `screens` arrays, or change its `ids`.
   - Headline: `headline` is the text, `hl` is the word shown in orange.
   - Helper line: by default it is the first sentence of the question's `sub` in
     questions.json. Set `helper` to override it. `alwaysShowSub: true` keeps the
     full original text visible instead of a "Why we ask" toggle.
   - Option wording: `labels` replaces the shown label only. The saved value never changes.
   - Mascot line: `mascot`.
   - `single: true` makes a screen pick-one even if the question allows several.
   - Popular cities: POPULAR_CITIES below. `value` MUST be a key in config/cityZones.json. */

export const SECTIONS = [
  {
    id: 'about',
    label: 'About you',
    icon: 'user',
    toast: null,
    screens: [
      {
        id: 'city', ids: ['city'], chip: 'Your city',
        headline: 'Which city are you in?', hl: 'city',
        mascot: "Heat is a big deal for dogs in India. Where's home?",
      },
      {
        id: 'home', ids: ['home', 'flooring'], chip: 'Your living space',
        headline: 'Where will your dog live?', hl: 'live',
        mascot: "Space and floors matter more than you'd think.",
        // Merged screen: home as cards, flooring as chips under a small label.
        flooringLabel: "What's the floor like?",
        labels: {
          flooring: {
            hard: 'Hard / slippery',
            mixed: 'Mix of floors and rugs',
            carpeted: 'Mostly carpet or mats',
          },
        },
      },
      {
        id: 'family', ids: ['family'], chip: 'Your household',
        headline: "Who's at home?", hl: 'home',
        mascot: 'Who will I be hanging out with?',
      },
      {
        id: 'experience', ids: ['experience'], chip: 'Your experience',
        headline: 'Had a dog before?', hl: 'dog',
        mascot: 'No judgement. Every dog parent starts somewhere.',
      },
    ],
  },
  {
    id: 'daily',
    label: 'Your daily life',
    icon: 'clock',
    toast: 'Nice! Now your daily life.',
    screens: [
      {
        id: 'activity', ids: ['activity'], chip: 'Your energy',
        headline: 'How active are you?', hl: 'active',
        mascot: 'How far will we walk together?',
        single: true, // pick one (the question allows several in questions.json, this screen does not)
      },
      {
        id: 'schedule', ids: ['schedule'], chip: 'Your schedule',
        headline: 'How much time can you spend with your dog?', hl: 'time',
        helper: 'Be honest here, it helps us flag breeds that may struggle.',
        mascot: "Be honest. I'd rather know now!",
        // Display wording only. Saved values stay home / up-to-4h / 4-8h / 8h-plus.
        labels: {
          schedule: {
            home: "Most of the day. Someone's usually home",
            'up-to-4h': 'Quite a bit. Away up to 4 hours',
            '4-8h': 'Some. Away 4 to 8 hours',
            '8h-plus': 'Little. Away 8+ hours regularly',
          },
        },
      },
      {
        id: 'budget', ids: ['budget'], chip: 'Your budget',
        headline: "What's a comfortable monthly budget?", hl: 'budget',
        helper: 'This covers food, grooming, vet care and supplies.',
        mascot: "Dogs are an investment. Let's find one that fits.",
      },
      {
        id: 'trainingEffort', ids: ['trainingEffort'], chip: 'Your training time',
        headline: 'How much time can you put into training?', hl: 'training',
        mascot: 'A little effort goes a long way.',
      },
    ],
  },
  {
    id: 'dog',
    label: 'The dog you want',
    icon: 'paw',
    toast: 'Almost there. Now the dog you want.',
    screens: [
      {
        id: 'purpose', ids: ['purpose'], chip: 'Your purpose',
        headline: 'What should your dog be to you?', hl: 'be',
        mascot: 'What kind of buddy are you after?',
        // The "I already love a specific breed" option is not a card; it is this link.
        hiddenOptions: { purpose: ['breed'] },
        breedLink: { text: 'I already have a breed in mind. Browse breeds instead', questionId: 'purpose', val: 'breed' },
      },
      {
        id: 'hair', ids: ['hair'], chip: 'Your coat pick',
        headline: 'Any coat you love?', hl: 'coat',
        mascot: 'Fluffy, sleek, or no preference?',
        single: true,
      },
      {
        id: 'allergies', ids: ['allergies'], chip: 'Your health',
        headline: 'Any pet allergies at home?', hl: 'allergies',
        alwaysShowSub: true, // the "no breed is truly allergen-free" honesty text must stay visible
        mascot: "Important one. We'll be upfront about this.",
      },
      {
        id: 'timeline', ids: ['timeline'], chip: 'Your timeline',
        headline: 'When is your dog coming home?', hl: 'home',
        helper: 'It tells us whether to introduce you to a breeder now or send you home with reading first.',
        mascot: "Last one! Then we'll sniff out your match.",
        last: true,
      },
    ],
  },
];

/* Chips on screen 1. `label` is what people see; `value` is what is saved and
   must exist in config/cityZones.json (the matching engine reads it). */
export const POPULAR_CITIES = [
  { label: 'Hyderabad', value: 'Hyderabad' },
  { label: 'Bengaluru', value: 'Bengaluru' },
  { label: 'Mumbai', value: 'Mumbai' },
  { label: 'Delhi NCR', value: 'Delhi' },
  { label: 'Chennai', value: 'Chennai' },
  { label: 'Pune', value: 'Pune' },
  { label: 'Kolkata', value: 'Kolkata' },
  { label: 'Ahmedabad', value: 'Ahmedabad' },
];

export const BROWSE_LINK_TEXT = 'Already know your breed? Browse breeds';
export const FIND_MATCH_LABEL = 'Find my match';

/* How the quiz dog reacts to an answer (RunningDog moods, see components/quiz/DogArt.jsx).
   Everything lives here so it is easy to edit. `question` and `values` are the real ids and option
   values from constants/questions.json; an answer that matches no rule leaves the dog running.

   - rules .......... when someone picks one of `values` for `question`, the dog shows `mood` for `ms`.
   - pantFromScreen . from this screen number onward (1-based) the dog pants between answers.
   - submitMood ..... the dog sits at the end of the bar once "Find my match" is tapped. */
export const DOG_REACTIONS = {
  rules: [
    { question: 'home', values: ['apt-1bhk', 'pg'], mood: 'tilt', ms: 1200 },      // small home / flat / 1BHK / shared room
    { question: 'schedule', values: ['8h-plus'], mood: 'tilt', ms: 1200 },         // long alone-time
    { question: 'activity', values: ['high'], mood: 'pant', ms: 1600 },            // highly active
  ],
  pantFromScreen: 10,
  baseMood: 'run',
  panMood: 'pant',
  submitMood: 'sit',
};
