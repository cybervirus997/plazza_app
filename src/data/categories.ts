export const categories = [
  {
    "id": "medicines",
    "title": "Medicines",
    "imageKey": "medicine"
  },
  {
    "id": "cold-cough",
    "title": "Cold & cough",
    "imageKey": "bottle"
  },
  {
    "id": "pain-relief",
    "title": "Pain relief",
    "imageKey": "care"
  },
  {
    "id": "daily-wellness",
    "title": "Daily wellness",
    "imageKey": "bottle"
  },
  {
    "id": "skin-hair",
    "title": "Skin & hair",
    "imageKey": "tube"
  },
  {
    "id": "baby-care",
    "title": "Baby care",
    "imageKey": "baby"
  },
  {
    "id": "personal-care",
    "title": "Personal care",
    "imageKey": "tube"
  },
  {
    "id": "first-aid",
    "title": "First aid",
    "imageKey": "care"
  }
] as const;

export type CategoryId = typeof categories[number]['id'];
export type ProductImageKey = typeof categories[number]['imageKey'];
