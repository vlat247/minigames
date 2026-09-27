export interface FeaturedGame {
  readonly image: string;
  readonly likes: string;
  readonly name: string;
  readonly rating: number;
  readonly slug: string;
}

export const featuredGames: readonly FeaturedGame[] = [
  {
    image: '/assets/images/games/cat-mail-co-card.jpg',
    likes: '38.2K',
    name: 'Cat Mail Co.',
    rating: 4.9,
    slug: 'cat-mail-co',
  },
  {
    image: '/assets/images/games/islanders-new-shores-card.jpg',
    likes: '54.2K',
    name: 'ISLANDERS: New Shores',
    rating: 4.9,
    slug: 'islanders-new-shores',
  },
  {
    image: '/assets/images/games/vacation-cafe-simulator-card.jpg',
    likes: '28.8K',
    name: 'Vacation Cafe Simulator',
    rating: 4.8,
    slug: 'vacation-cafe-simulator',
  },
  {
    image: '/assets/images/games/winter-burrow-card.jpg',
    likes: '32.4K',
    name: 'Winter Burrow',
    rating: 4.9,
    slug: 'winter-burrow',
  },
  {
    image: '/assets/images/games/heartopia-card.jpg',
    likes: '46.8K',
    name: 'Heartopia',
    rating: 4.6,
    slug: 'heartopia',
  },
  {
    image: '/assets/images/games/palia-card.jpg',
    likes: '89.5K',
    name: 'Palia',
    rating: 4.8,
    slug: 'palia',
  },
  {
    image: '/assets/images/games/shelve-the-potions-card.jpg',
    likes: '21.3K',
    name: 'Shelve the Potions!',
    rating: 4.7,
    slug: 'shelve-the-potions',
  },
  {
    image: '/assets/images/games/tiny-glade-card.jpg',
    likes: '67.3K',
    name: 'Tiny Glade',
    rating: 4.9,
    slug: 'tiny-glade',
  },
  {
    image: '/assets/images/games/tailside-cozy-cafe-sim-card.jpg',
    likes: '35.6K',
    name: 'Tailside: Cozy Cafe Sim',
    rating: 4.8,
    slug: 'tailside-cozy-cafe-sim',
  },
];
