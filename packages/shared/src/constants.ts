// ============================================================
// PawTag Pet Constants — Selection options for pet attributes
// ============================================================

// --- Password Validation ---
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_ERROR_MESSAGE = 'Password must contain at least 8 characters with one uppercase letter, one lowercase letter, one number, and one special character';

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (!PASSWORD_REGEX.test(password)) {
    return { valid: false, error: PASSWORD_ERROR_MESSAGE };
  }
  return { valid: true };
}

// --- Pet Types ---
export const PET_TYPES = [
  'Dog',
  'Cat',
  'Rabbit',
  'Hamster',
  'Guinea Pig',
  'Bird',
] as const;
export type PetType = (typeof PET_TYPES)[number];

// --- Breed Origin ---
export interface BreedOriginOption {
  value: string;
  label: string;
  tooltip: string;
}

export const BREED_ORIGINS: BreedOriginOption[] = [
  {
    value: 'Purebred',
    label: 'Purebred',
    tooltip: 'Both parents are of the same recognized breed. Example: Labrador Retriever, German Shepherd.',
  },
  {
    value: 'Mixed Breed',
    label: 'Mixed Breed',
    tooltip: 'A mix of two or more different breeds, often with unknown ancestry. Example: A dog with Labrador and Terrier ancestry.',
  },
  {
    value: 'Designer Breed',
    label: 'Designer Breed',
    tooltip: 'A deliberate cross between two purebred dogs to combine desired traits. Example: Labradoodle (Labrador × Poodle), Cockapoo.',
  },
  {
    value: 'Landrace',
    label: 'Landrace / Native',
    tooltip: 'A naturally developed regional breed that evolved over time with little human-directed breeding. Example: Indian Pariah Dog, Carolina Dog.',
  },
  {
    value: 'Unknown',
    label: 'Unknown',
    tooltip: 'The breed or ancestry is unknown, typically used for rescued or stray dogs when lineage cannot be identified.',
  },
];

// --- Landrace / Native Breeds (by pet type) ---
export const LANDRACE_BREEDS: Record<PetType, readonly string[]> = {
  Dog: [
    'Indian Pariah Dog', 'Carolina Dog', 'Canaan Dog', 'New Guinea Singing Dog',
    'Basenji', 'Thai Ridgeback', 'Kintamani Dog', 'Taiwan Dog',
    'Telomian', 'Xoloitzcuintli', 'Peruvian Hairless Dog', 'Africanis',
  ],
  Cat: [
    'Arabian Mau', 'Aegean Cat', 'Thai Cat', 'Cyprus Cat',
    'Turkish Van', 'Turkish Angora', 'Norwegian Forest Cat', 'Siberian Cat',
    'Maine Coon', 'Kurilian Bobtail', 'Japanese Bobtail', 'Khao Manee',
  ],
  Rabbit: [],
  Hamster: [],
  'Guinea Pig': [],
  Bird: [],
};

// --- Pet Colors (grouped by pet type) ---
export const PET_COLORS: Record<PetType, readonly string[]> = {
  Dog: [
    'Black', 'White', 'Brown', 'Cream', 'Golden', 'Red', 'Blue (Gray)',
    'Fawn', 'Brindle', 'Merle', 'Sable', 'Chocolate', 'Liver', 'Tan', 'Silver',
  ],
  Cat: [
    'Black', 'White', 'Gray', 'Blue', 'Orange (Ginger)', 'Cream', 'Brown',
    'Chocolate', 'Lilac', 'Cinnamon', 'Fawn',
  ],
  Rabbit: [
    'White', 'Black', 'Blue', 'Chocolate', 'Lilac', 'Chestnut', 'Chinchilla',
    'Sable', 'Tortoise', 'Agouti',
  ],
  Hamster: [
    'Golden', 'White', 'Black', 'Gray', 'Cream', 'Cinnamon', 'Sable', 'Silver',
  ],
  'Guinea Pig': [
    'White', 'Black', 'Brown', 'Red', 'Cream', 'Buff', 'Chocolate', 'Lilac', 'Slate',
  ],
  Bird: [
    'Green', 'Blue', 'Yellow', 'White', 'Gray', 'Black', 'Red', 'Violet',
    'Turquoise', 'Lutino', 'Albino',
  ],
};

// --- Pet Patterns (grouped by pet type) ---
export const PET_PATTERNS: Record<PetType, readonly string[]> = {
  Dog: [
    'Solid', 'Merle', 'Brindle', 'Sable', 'Tan Points', 'Tricolor',
    'Piebald', 'Tuxedo', 'Harlequin', 'Spotted', 'Roan',
  ],
  Cat: [
    'Solid', 'Tabby', 'Calico', 'Tortoiseshell', 'Bicolor', 'Tricolor',
    'Colorpoint', 'Ticked', 'Spotted', 'Mackerel', 'Classic Tabby',
  ],
  Rabbit: [
    'Solid', 'Broken', 'Dutch', 'Himalayan', 'Otter', 'Chinchilla',
    'Fox', 'Steel', 'Butterfly', 'Magpie',
  ],
  Hamster: [
    'Solid', 'Banded', 'Sanded', 'Ticked', 'Agouti', 'Spotted',
  ],
  'Guinea Pig': [
    'Solid', 'Roan', 'Dalmatian', 'Brindle', 'Himalayan', 'Dutch',
    'Orange', 'Ticked', 'Agouti',
  ],
  Bird: [
    'Solid', 'Pied', 'Lutino', 'Albino', 'Opaline', 'Spangle',
    'Clearwing', 'Crested', 'Dominant Pied',
  ],
};

// --- Pet Breeds (grouped by pet type — popular / recognized breeds) ---
export const PET_BREEDS: Record<PetType, readonly string[]> = {
  Dog: [
    'Mixed Breed',
    // Popular
    'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'French Bulldog',
    'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Dachshund', 'German Shorthaired Pointer',
    'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier', 'Cavalier King Charles Spaniel',
    'Doberman Pinscher', 'Boxer', 'Miniature Schnauzer', 'Cocker Spaniel', 'Shih Tzu',
    // Working / Herding
    'Border Collie', 'Belgian Malinois', 'Alaskan Malamute', 'Siberian Husky',
    'Bernese Mountain Dog', 'Great Dane', 'Saint Bernard', 'Old English Sheepdog',
    'Samoyed', 'Akita', 'Mastiff', 'Newfoundland',
    // Terriers
    'West Highland White Terrier', 'Scottish Terrier', 'Bull Terrier', 'Jack Russell Terrier',
    'Staffordshire Bull Terrier', 'Airedale Terrier',
    // Toy
    'Chihuahua', 'Pomeranian', 'Maltese', 'Pug', 'Papillon',
    'Italian Greyhound', 'Chinese Crested',
    // Hound
    'Basset Hound', 'Bloodhound', 'Greyhound', 'Whippet',
    'Rhodesian Ridgeback', 'Afghan Hound', 'Basenji',
    // Other
    'Shiba Inu', 'Shar Pei', 'Chow Chow', 'Lhasa Apso',
    'Sheltie', 'Collie', 'Dalmatian', 'Weimaraner',
    'Vizsla', 'Brittany Spaniel', 'Setter (Irish)', 'Setter (English)',
    'Pointer', 'Havanese', 'Bichon Frise', 'Maltepoo',
    'Goldendoodle', 'Labradoodle', 'Cockapoo', 'Pomsky',
    // Landrace / Native
    'Indian Pariah Dog', 'Carolina Dog', 'Canaan Dog', 'New Guinea Singing Dog',
    'Thai Ridgeback', 'Kintamani Dog', 'Taiwan Dog', 'Telomian',
    'Xoloitzcuintli', 'Peruvian Hairless Dog', 'Africanis',
  ],
  Cat: [
    'Mixed Breed',
    // Popular
    'Domestic Shorthair', 'Domestic Longhair', 'Ragdoll', 'Maine Coon',
    'Persian', 'British Shorthair', 'Bengal', 'Abyssinian',
    'Siamese', 'Russian Blue', 'Scottish Fold', 'Sphynx',
    'Birman', 'Norwegian Forest Cat', 'Ragamuffin', 'Himalayan',
    // Other Purebred
    'American Shorthair', 'Exotic Shorthair', 'Oriental Shorthair',
    'Tonkinese', 'Burmese', 'Cornish Rex', 'Devon Rex', 'Selkirk Rex',
    'Somali', 'Balinese', 'Chartreux', 'Korat',
    'LaPerm', 'Manx', 'Munchkin', 'Singapura',
    'Snowshoe', 'Turkish Angora', 'Turkish Van',
    // Landrace / Native
    'Arabian Mau', 'Aegean Cat', 'Thai Cat', 'Cyprus Cat',
    'Siberian Cat', 'Kurilian Bobtail', 'Japanese Bobtail', 'Khao Manee',
  ],
  Rabbit: [
    'Mixed Breed',
    'Holland Lop', 'Mini Lop', 'English Lop', 'French Lop',
    'Netherland Dwarf', 'Mini Rex', 'Standard Rex', 'Velveteen Lop',
    'Himalayan', 'Dutch', 'English Spot', 'Checkered Giant',
    'Flemish Giant', 'Lionhead', 'Angora', 'Jersey Wooly',
    'Californian', 'New Zealand', 'American', 'Chinchilla',
    'Argente', 'Belgian Hare', 'English Angora', 'French Angora',
  ],
  Hamster: [
    'Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White',
    'Roborovski', 'Chinese', 'Campbell\'s Dwarf',
  ],
  'Guinea Pig': [
    'American', 'Peruvian', 'Silkie (Sheltie)', 'Teddy',
    'Texel', 'Rex', 'American Crested', 'Peruvian Crested',
    'Skinny Pig', 'Baldwin', 'Sheba', 'White Crested',
    'Merino', 'Lunkarya',
  ],
  Bird: [
    'Budgerigar (Budgie)', 'Cockatiel', 'Lovebird', 'African Grey',
    'Amazon Parrot', 'Macaw', 'Cockatoo', 'Conure',
    'Canary', 'Finch', 'Parrotlet', 'Quaker Parrot',
    'Ringneck Dove', 'Pionus', 'Caique', 'Lorikeet',
    'Mynah', 'Bourke\'s Parakeet', 'Lineolated Parakeet',
  ],
};

// --- Helper: get breeds filtered by breed origin ---
export function getBreedsForOrigin(petType: PetType, breedOrigin: string): readonly string[] {
  const allBreeds = PET_BREEDS[petType] || [];
  switch (breedOrigin) {
    case 'Landrace':
      return LANDRACE_BREEDS[petType] || [];
    case 'Unknown':
      return ['Unknown'];
    case 'Mixed Breed':
    case 'Designer Breed':
      return allBreeds.filter((b) => b !== 'Mixed Breed');
    case 'Purebred':
    default:
      return allBreeds.filter((b) => b !== 'Mixed Breed');
  }
}
