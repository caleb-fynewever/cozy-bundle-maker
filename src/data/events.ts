/**
 * Real upcoming/recurring Minneapolis events, gathered from local listings.
 * Each links to its source. Refresh by hand until a live feed is wired up.
 */
export type LocalEvent = {
  id: string;
  title: string;
  when: string;
  where: string;
  price: string;
  blurb: string;
  photo: string; // key into PHOTOS
  source: { name: string; url: string };
};

export const EVENTS: LocalEvent[] = [
  {
    id: "e_knifeplay",
    title: "Knifeplay at the Whole",
    when: "Sat, Sep 26 · 8 pm",
    where: "Whole Music Club, Coffman Union",
    price: "$8–15",
    blurb: "Shoegaze meets folk, with Stalled and 12th House Sun opening. Doors at 7:30.",
    photo: "coffman",
    source: { name: "UMN Student Unions", url: "https://sua.umn.edu/knifeplay" },
  },
  {
    id: "e_mill_city_market",
    title: "Mill City Farmers Market",
    when: "Saturdays · 8 am–1 pm, through October",
    where: "Mill City Museum, Downtown",
    price: "Free to wander",
    blurb: "Dozens of local farmers and food makers by the river, rain or shine.",
    photo: "farmers",
    source: { name: "Meet Minneapolis", url: "https://www.minneapolis.org/calendar/seasonal/summer-events/" },
  },
  {
    id: "e_ne_market",
    title: "Northeast Farmers Market",
    when: "Saturdays · 9 am–1 pm, until Oct 10",
    where: "629 NE 2nd St",
    price: "Free to wander",
    blurb: "Small, friendly neighborhood market. Last few weeks of the season.",
    photo: "surdyks",
    source: { name: "Northeast Farmers Market", url: "https://www.northeastmarket.org/" },
  },
  {
    id: "e_fulton_oktoberfest",
    title: "Fulton Oktoberfest",
    when: "This weekend",
    where: "Fulton Brewing, North Loop",
    price: "Free entry",
    blurb: "One of the more underrated fall to-dos, according to Racket's weekly free list.",
    photo: "fulton",
    source: {
      name: "Racket · Freeloader Friday",
      url: "https://racketmn.com/freeloader-friday-130-free-things-to-do-this-weekend",
    },
  },
  {
    id: "e_highpoint",
    title: "Du Bois data portraits, reimagined",
    when: "Opening Fri · 6:30–9 pm",
    where: "Highpoint Center for Printmaking, W Lake St",
    price: "Free",
    blurb: "New prints riffing on W.E.B. Du Bois's famous data visualizations. Panel Sat at 1.",
    photo: "weisman",
    source: {
      name: "Racket · Freeloader Friday",
      url: "https://racketmn.com/freeloader-friday-130-free-things-to-do-this-weekend",
    },
  },
  {
    id: "e_jazz_jam",
    title: "Jazz jam at the Green Room",
    when: "Monthly, Tuesdays · 7:30 pm",
    where: "Green Room, Uptown",
    price: "$7 · free if you play",
    blurb: "Hosted by the UMN Jazz Singers alumni. Bring an instrument or just listen.",
    photo: "greenway",
    source: { name: "City Pulse MN", url: "https://www.citypulsemn.com/event/cb745ad7-6d30-4bb2-84f2-ef55f6b9298e" },
  },
];
