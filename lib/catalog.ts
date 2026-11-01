export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  specification: string;
  price: number;
  image: string;
  badge?: string;
  color: string;
};

// Demo catalog: replace these values with your actual products and prices.
// Prices are integer UZS and are always read from this server-side catalog.
export const products: Product[] = [
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    category: 'Smartfonlar',
    description: 'Kuchli kamera. Titandan yaratilgan.',
    specification: '256 GB · Natural Titanium',
    price: 15000000,
    image: '/images/iphone.webp',
    badge: 'Eng ko‘p tanlangan',
    color: 'Natural titanium',
  },
  {
    id: 'airpods-pro-2',
    name: 'AirPods Pro 2',
    category: 'Quloqchinlar',
    description: 'O‘zingiz yoqtirgan ovozga sho‘ng‘ing.',
    specification: 'USB-C · Faol shovqin bostirish',
    price: 2900000,
    image: '/images/airpods.webp',
    badge: 'Yangi',
    color: 'Oq',
  },
  {
    id: 'macbook-air-m3',
    name: 'MacBook Air M3',
    category: 'Noutbuklar',
    description: 'Katta ishlar uchun yengil hamroh.',
    specification: '13″ · 16 GB / 512 GB · Midnight',
    price: 14500000,
    image: '/images/macbook.webp',
    color: 'Midnight',
  },
  {
    id: 'apple-watch-series-10',
    name: 'Apple Watch Series 10',
    category: 'Soatlar',
    description: 'Har bir kuningizni faolroq o‘tkazing.',
    specification: '46 mm · GPS · Aluminum',
    price: 5200000,
    image: '/images/watch.webp',
    badge: 'Yangi',
    color: 'Sage',
  },
];
export const categories = ['Barchasi', 'Smartfonlar', 'Quloqchinlar', 'Noutbuklar', 'Soatlar'];
export function findProduct(id: string) {
  return products.find((p) => p.id === id);
}
