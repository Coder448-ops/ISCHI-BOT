import { products } from '@/lib/catalog';
import Storefront from '@/components/storefront';
export default function Home() {
  return <Storefront products={products} />;
}
