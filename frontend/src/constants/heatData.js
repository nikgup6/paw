// Generated from India city climate normals (1961-1990, Current Results) and the PAW BUDDY breed database.
// Heat score = tier*2 + load. See the build prompt for the rules and assumptions.
export const HEAT = {
  "MONTHS": [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  "CITIES": [
    "Hyderabad",
    "Bangalore",
    "Chennai",
    "Mumbai",
    "Delhi"
  ],
  "CITY_HIGH_C": {
    "Hyderabad": [
      29,
      32,
      35,
      38,
      39,
      35,
      31,
      30,
      31,
      31,
      29,
      28
    ],
    "Bangalore": [
      27,
      30,
      33,
      34,
      33,
      29,
      28,
      27,
      28,
      28,
      27,
      26
    ],
    "Chennai": [
      29,
      31,
      33,
      36,
      38,
      37,
      35,
      35,
      34,
      32,
      30,
      28
    ],
    "Mumbai": [
      30,
      30,
      31,
      32,
      33,
      32,
      30,
      30,
      31,
      33,
      33,
      32
    ],
    "Delhi": [
      21,
      24,
      29,
      36,
      39,
      39,
      35,
      34,
      34,
      33,
      28,
      23
    ]
  },
  "CITY_LOAD": {
    "Hyderabad": [
      1,
      2,
      3,
      5,
      5,
      3,
      2,
      1,
      2,
      2,
      1,
      1
    ],
    "Bangalore": [
      0,
      1,
      2,
      3,
      2,
      1,
      1,
      0,
      1,
      1,
      0,
      0
    ],
    "Chennai": [
      1,
      2,
      2,
      4,
      5,
      5,
      4,
      4,
      4,
      3,
      2,
      1
    ],
    "Mumbai": [
      2,
      2,
      3,
      3,
      3,
      3,
      2,
      2,
      3,
      3,
      3,
      3
    ],
    "Delhi": [
      0,
      0,
      1,
      4,
      5,
      5,
      3,
      3,
      3,
      2,
      1,
      0
    ]
  },
  "BREEDS": {
    "Labrador Retriever": {
      "tier": 2,
      "reason": "Short double coat and big body; copes in most cities with shade, water and early/late walks."
    },
    "German Shepherd": {
      "tier": 3,
      "reason": "Dense double coat and large frame; struggles in peak summer without AC rest."
    },
    "Golden Retriever": {
      "tier": 3,
      "reason": "Long double coat built for cooler weather; needs AC commitment in hot cities."
    },
    "Beagle": {
      "tier": 1,
      "reason": "Short coat, medium frame; one of the most heat-tolerant popular breeds."
    },
    "Pomeranian": {
      "tier": 3,
      "reason": "Small but with a dense double coat from cold regions; overheats quickly."
    },
    "Indian Pariah Dog": {
      "tier": 0,
      "reason": "Native breed adapted to Indian heat."
    },
    "Pug": {
      "tier": 4,
      "reason": "Flat face makes panting less effective, so cooling is poor."
    },
    "Shih Tzu": {
      "tier": 3,
      "reason": "Short snout plus a long coat; needs AC and grooming in hot months."
    },
    "Indian Spitz": {
      "tier": 1,
      "reason": "Fluffy but bred for India; tolerates most cities if shaded."
    },
    "Doberman Pinscher": {
      "tier": 1,
      "reason": "Very short coat handles heat well; feels the cold instead."
    },
    "Rottweiler": {
      "tier": 3,
      "reason": "Heavy, dark and muscular; heat builds up fast."
    },
    "Dachshund": {
      "tier": 1,
      "reason": "Small, short coat; manage outdoor heat and spine care."
    },
    "Cocker Spaniel": {
      "tier": 2,
      "reason": "Long coat and ears; heat plus humidity raises ear and skin problems."
    },
    "Boxer": {
      "tier": 4,
      "reason": "Flat face; panting is less effective, so peak hours are risky."
    },
    "Rajapalayam": {
      "tier": 0,
      "reason": "Native South Indian breed built for hot plains."
    },
    "Siberian Husky": {
      "tier": 4,
      "reason": "Thick double coat built for Arctic cold; shaving does not fix this."
    },
    "Great Dane": {
      "tier": 3,
      "reason": "Giant frame generates a lot of heat and is slow to cool."
    },
    "Lhasa Apso": {
      "tier": 3,
      "reason": "Long dense coat built for mountain climates."
    },
    "Mudhol Hound": {
      "tier": 0,
      "reason": "Lean native sighthound adapted to the Deccan heat."
    },
    "Dalmatian": {
      "tier": 1,
      "reason": "Short coat, athletic; fine with early/late exercise."
    },
    "Poodle (Standard)": {
      "tier": 1,
      "reason": "Single curly coat; manageable with summer clips and AC."
    },
    "French Bulldog": {
      "tier": 5,
      "reason": "Very flat face and stocky body; the highest-risk popular breed in Indian heat."
    },
    "Saint Bernard": {
      "tier": 5,
      "reason": "Giant, heavy-coated mountain breed; not suited to most Indian plains."
    }
  },
  "VERDICTS": [
    "Fine",
    "Early/late walks",
    "AC afternoons",
    "AC all day",
    "Not advised"
  ],
  "ADVICE": {
    "0": {
      "title": "Comfortable",
      "lines": [
        "Normal walks are fine; avoid 11 AM to 4 PM on the hottest days.",
        "Always keep fresh water and shade available."
      ]
    },
    "1": {
      "title": "Walk early and late",
      "lines": [
        "Walks only before 8 AM and after 7 PM.",
        "Shade and fresh water at all times; no hot pavement on paws.",
        "Never leave the dog in a parked car or on an open terrace."
      ]
    },
    "2": {
      "title": "AC for the afternoon",
      "lines": [
        "A cool room with AC or a cooler is needed from late morning to evening.",
        "Short walks only before sunrise and after dark.",
        "Keep a power-cut plan (fan, cooling mat, wet towels)."
      ]
    },
    "3": {
      "title": "AC all day",
      "lines": [
        "Needs a cooled room around the clock in these months, plus a backup for power cuts.",
        "Take it out only briefly at the coolest hours.",
        "Watch for heavy panting, drooling, weakness; go to a vet immediately."
      ]
    },
    "4": {
      "title": "Not advised",
      "lines": [
        "We would not recommend this breed in this city in this month without 24/7 climate control and backup power.",
        "Consider a breed with a lower heat score, or a cooler city or season."
      ]
    }
  }
};
