// ============================================================
// PawTag Pet Constants — Selection options for pet attributes
// ============================================================

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
