/* PAW BUDDY: "A day with your dog" (puppy day) — data + one pure function.

   Copy to frontend/src/utils/dayInLife.js.

   buildDay(breed, answers) -> { scenes, summary }
   - `breed`   one entry of constants/breeds.json (uses: name, energy, time, grooming,
               shedding, monthlyCostMin, monthlyCostMax, experienceLevel, apt, size).
   - `answers` the quiz answers object Results.jsx already holds. Each value may be a
               string OR a one-item array (multi-select questions), so we always unwrap.
               Ids and saved values used (these are the REAL ones in constants/questions.json):
                 city (free text), home (apt-1bhk|apt-2bhk|apt-3bhk|house-no-yard|house-yard|pg|still-figuring-out),
                 flooring (hard|mixed|carpeted), family (young-kids|older-kids|seniors|both|adults),
                 activity (relaxed|moderate|high), schedule (home|up-to-4h|4-8h|8h-plus),
                 budget (under5k|5k-10k|10k-20k|above20k), trainingEffort (minimal|moderate|committed),
                 experience (none|some|experienced), allergies (none|mild|diagnosed).

   RULES OF THUMB (puppy about 3 months old). These are general care guidance, NOT veterinary
   advice and not measured data. They are all in the CONFIG block so they can be changed in one place:
   - A puppy can usually hold its bladder about 1 hour per month of age, plus one; at 3 months that is
     roughly 3 to 4 hours, and fewer at night at first.
   - Puppies are fed 3 to 4 small meals a day at this age.
   - Exercise is short and gentle (roughly 5 minutes per month of age, twice a day), not an adult walk.
   - Training is little and often (3 to 5 minute sessions).
   Nothing here is invented per breed: breed-specific lines come from the breed's own fields. */

export const CONFIG = {
  puppyAgeMonths: 3,
  maxAloneHoursPuppy: 4,          // matches the welfare note already on the results page
  meals: 4,
  gentleWalkMin: 15,              // 5 min x 3 months, twice a day
  trainingMin: { minimal: 5, moderate: 10, committed: 20 },
  // Hot-weather cities get early/late walks. Anything not listed is treated as 'normal' (we do not guess).
  HOT_CITIES: ['hyderabad', 'chennai', 'mumbai', 'delhi', 'new delhi', 'delhi ncr', 'gurgaon', 'gurugram',
    'noida', 'kolkata', 'ahmedabad', 'nagpur', 'jaipur', 'lucknow', 'vijayawada', 'visakhapatnam', 'nellore'],
  BUDGET_CEILING: { under5k: 5000, '5k-10k': 10000, '10k-20k': 20000, above20k: Infinity },
  // Hours the OWNER is away, used for the alone-time scene. 'home' means someone is usually there.
  AWAY_HOURS: { home: 0, 'up-to-4h': 4, '4-8h': 6, '8h-plus': 9 },
};

const one = (v) => (Array.isArray(v) ? v[0] : v);
const num = (s, d) => { const m = String(s || '').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : d; };

export function buildDay(breed, rawAnswers = {}) {
  const a = {};
  Object.keys(rawAnswers || {}).forEach((k) => { a[k] = one(rawAnswers[k]); });
  const c = CONFIG;
  const name = breed.name;
  const city = String(a.city || '').trim().toLowerCase();
  const hot = c.HOT_CITIES.includes(city);
  const awayKey = a.schedule && c.AWAY_HOURS[a.schedule] !== undefined ? a.schedule : null;
  const away = awayKey ? c.AWAY_HOURS[awayKey] : null;           // null = they did not tell us
  const trainKey = c.trainingMin[a.trainingEffort] ? a.trainingEffort : 'moderate';
  const trainMin = c.trainingMin[trainKey];
  const energy = String(breed.energy || '').toLowerCase();
  const highEnergy = /^(high|very high|medium.high)/.test(energy);
  const shed = String(breed.shedding || '').toLowerCase();
  const heavyShed = /^(high|very high|medium.high)/.test(shed);
  const flags = [];                                              // honest warnings, shown on the summary

  const scenes = [];
  const add = (s) => scenes.push({ mood: 'happy', warn: null, ...s });

  add({
    id: 'wake', time: '6:00 am', icon: 'sun', title: 'Wake-up and straight out',
    body: `${name} puppy wakes and needs the toilet within minutes. Straight outside, every time, and a treat when it goes in the right place.`
      + (a.home === 'apt-1bhk' || a.home === 'apt-2bhk' || a.home === 'apt-3bhk'
        ? ' In a flat that means a lift or stairs at 6 am, so keep a potty pad or balcony spot as a back-up for the first weeks.'
        : a.home === 'house-yard' ? ' You have a yard, so this one is easy: same spot, every time.'
        : a.home === 'pg' ? ' In shared accommodation, check the pet rules before you bring a dog home at all.' : ''),
    ownerMin: 20,
  });
  add({
    id: 'breakfast', time: '6:30 am', icon: 'bowl', title: 'Breakfast and a short play',
    body: `Puppies this age eat ${c.meals} small meals a day, so breakfast is the first of ${c.meals}. About ten minutes of gentle play after.`,
    ownerMin: 25,
  });

  // Walk scene, shaped by city heat and the breed's energy.
  add({
    id: 'walk1', time: hot ? '7:00 am (before it heats up)' : '7:30 am', icon: 'walk',
    title: 'Gentle walk, not a workout',
    body: `A puppy walk is about ${c.gentleWalkMin} minutes, slow, sniffing everything.`
      + (hot ? ` In ${a.city || 'your city'} walks go early and late; the tarmac is too hot for paws by mid-morning.` : '')
      + (highEnergy ? ` ${name} is a high-energy breed, so you will notice the energy now, but do not make up for it with long runs: young joints need protecting. Use short games and puzzle feeders instead.` : ''),
    ownerMin: c.gentleWalkMin + 5,
  });

  // The day's biggest honest scene: being alone.
  if (away === null) {
    add({
      id: 'alone', time: '9:00 am – afternoon', icon: 'home', title: 'Home alone?',
      body: 'You did not tell us how long you are away, so we cannot show this part. A puppy should not be alone for more than about 4 hours.',
      mood: 'calm', warn: null, aloneHours: null, ownerMin: 0,
    });
  } else if (away === 0) {
    add({
      id: 'alone', time: '9:00 am – afternoon', icon: 'home', title: 'Someone is home',
      body: `Someone is usually home, which is the best start for a puppy. Keep naps and quiet time in a crate or pen so ${name} learns to settle, and does not follow you everywhere.`,
      mood: 'calm', aloneHours: 0, ownerMin: 30,
    });
  } else if (away <= c.maxAloneHoursPuppy) {
    add({
      id: 'alone', time: '9:00 am – 1:00 pm', icon: 'home', title: `Alone for up to ${away} hours`,
      body: `${name} naps, chews a safe toy, and waits. This is about the limit for a puppy. Come home for a toilet trip first.`,
      mood: 'calm', warn: 'limit', aloneHours: away, ownerMin: 0,
    });
    flags.push('Up to 4 hours alone is the most a puppy should manage. Plan a toilet break the moment you are back.');
  } else {
    add({
      id: 'alone', time: '9:00 am – evening', icon: 'home', title: `Alone for ${away}+ hours: this does not work yet`,
      body: `${away}+ hours is too long for a puppy: it will have accidents, get anxious and may chew things. It only works with a dog walker, daycare or someone at home for the first months. Start with that plan, or consider an older dog.`,
      mood: 'worried', warn: 'too-long', aloneHours: away, ownerMin: 0,
    });
    flags.push(`Being away ${away}+ hours is too long for a puppy. You need a sitter, walker or family member for the first months.`);
  }

  add({
    id: 'lunch', time: '1:00 pm', icon: 'bowl', title: 'Lunch, toilet, nap',
    body: 'Meal, straight out, then a long sleep. Puppies sleep 16 to 18 hours a day; a tired puppy is a normal puppy.',
    ownerMin: 20,
  });

  if (a.family === 'young-kids' || a.family === 'both') {
    add({
      id: 'kids', time: '4:00 pm', icon: 'family', title: 'Children and the puppy',
      body: `Kids will want to carry and chase ${name}. Short, supervised sessions on the floor only. Never leave a young child alone with a puppy.`,
      warn: 'supervise', ownerMin: 30,
    });
  } else if (a.family === 'seniors') {
    add({
      id: 'seniors', time: '4:00 pm', icon: 'family', title: 'Elders at home',
      body: `A bouncy puppy can knock over an elderly person. Keep ${name} on a lead indoors when it is excited, and keep floors clear.`,
      warn: 'supervise', ownerMin: 20,
    });
  }

  add({
    id: 'train', time: '5:00 pm', icon: 'train', title: `Training: ${trainMin} minutes, little and often`,
    body: a.trainingEffort === 'committed'
      ? `You said you will invest heavily. Great: ${trainMin} minutes split into short sessions: name, sit, toilet cue, calm on the lead.`
      : a.trainingEffort === 'minimal'
        ? `You want just the basics: ${trainMin} minutes a day is the minimum: name, sit, toilet cue. Skipping it is where chewing and barking problems start.`
        : `${trainMin} minutes a day in short sessions: name, sit, toilet cue, calm on the lead.`,
    ownerMin: trainMin,
  });

  add({
    id: 'walk2', time: hot ? '7:00 pm (after sunset)' : '6:30 pm', icon: 'walk', title: 'Evening play and walk',
    body: `Another short walk and some play. ${a.activity === 'high' ? 'You are very active, so this is your slot to enjoy it together, but keep it puppy-sized.' : a.activity === 'relaxed' ? 'You prefer a relaxed life, and a puppy will not always let you: expect a very lively half hour.' : 'About half an hour of play and walking is plenty.'}`,
    ownerMin: 35,
  });

  add({
    id: 'dinner', time: '8:00 pm', icon: 'bowl', title: 'Dinner and grooming',
    body: `Last big meal. ${heavyShed ? `${name} sheds heavily: expect a daily brush and a daily sweep.` : `${name} is a lighter shedder, so a brush a few times a week is enough.`}`
      + (a.allergies === 'mild' || a.allergies === 'diagnosed'
        ? ' You mentioned allergies. No breed is allergen-free: spend real time with a puppy before you commit.' : ''),
    ownerMin: heavyShed ? 25 : 15,
  });
  if (a.allergies === 'mild' || a.allergies === 'diagnosed') flags.push('Allergies: no breed is allergen-free. Spend time with a puppy before committing.');

  add({
    id: 'bedtime', time: '10:30 pm', icon: 'moon', title: 'Last toilet trip and bedtime',
    body: a.flooring === 'hard'
      ? 'Last toilet trip, then bed in a crate or pen. Your floors are hard and slippery: put mats down, because puppies slipping on tile is hard on their joints.'
      : a.flooring === 'carpeted'
        ? 'Last toilet trip, then bed in a crate or pen. Carpet hides accidents and holds the smell, so use an enzyme cleaner.'
        : 'Last toilet trip, then bed in a crate or pen near you.',
    mood: 'calm', ownerMin: 15,
  });
  add({
    id: 'night', time: '3:00 am', icon: 'moon', title: 'The night wake-up',
    body: 'In the first weeks most puppies wake once at night to go out. It passes, but plan for it.',
    mood: 'tired', ownerMin: 15,
  });

  // Summary
  const ownerMin = scenes.reduce((t, s) => t + (s.ownerMin || 0), 0);
  const min = breed.monthlyCostMin ? Number(breed.monthlyCostMin) : null;
  const max = breed.monthlyCostMax ? Number(breed.monthlyCostMax) : null;
  const ceiling = c.BUDGET_CEILING[a.budget];
  let budgetNote = null;
  if (min && ceiling !== undefined && ceiling !== Infinity) {
    if (min > ceiling) budgetNote = `${name} costs about ₹${min.toLocaleString('en-IN')} to ₹${max.toLocaleString('en-IN')} a month, above your comfortable budget.`;
    else if (max > ceiling) budgetNote = `${name} costs about ₹${min.toLocaleString('en-IN')} to ₹${max.toLocaleString('en-IN')} a month, so the top of the range is over your budget.`;
    else budgetNote = `${name} costs about ₹${min.toLocaleString('en-IN')} to ₹${max.toLocaleString('en-IN')} a month, inside your budget.`;
  } else if (min) budgetNote = `${name} costs about ₹${min.toLocaleString('en-IN')} to ₹${max.toLocaleString('en-IN')} a month.`;
  if (budgetNote && /above|over/.test(budgetNote)) flags.push(budgetNote);

  if (a.experience === 'none' && /experienced|some/i.test(breed.experienceLevel || '') && !/first/i.test(breed.experienceLevel || '')) {
    flags.push(`${name} is listed as "${breed.experienceLevel}", and you are a first-time owner.`);
  }

  return {
    scenes,
    summary: {
      breed: name,
      puppyAgeMonths: c.puppyAgeMonths,
      ownerHoursPerDay: Math.round((ownerMin / 60) * 10) / 10,
      aloneHours: away,
      adultTimeNeeded: breed.time || null,       // shown as: "As an adult, about X of attention every day"
      budgetNote,
      flags,
      hot,
    },
  };
}
