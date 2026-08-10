export interface PetPhoto {
  url: string;
  caption?: string;
  isMain: boolean;
}

export interface FinderData {
  pet: {
    name: string;
    petId?: string;
    petType?: string;
    species: string;
    breed: string;
    breedOrigin?: string;
    secondaryBreed?: string;
    color: string;
    pattern?: string;
    gender?: string;
    age?: number;
    favouriteFood?: string;
    photos: PetPhoto[];
    photoUrl?: string;
    medicalAlerts?: string;
    status: string;
  };
  tagId: string;
  tagStatus?: string;
  ownerName: string;
  ownerPhone?: string;
}

export interface FoundTimerData {
  active: boolean;
  foundAt?: string;
  elapsed?: number;
  finderPhone?: string;
  finderEmail?: string;
  finderName?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface NotifyPayload {
  finderName: string;
  finderPhone: string;
  finderEmail: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  consent: {
    locationConsent: string;
    consentedAt: string;
    consentVersion: string;
  };
}
