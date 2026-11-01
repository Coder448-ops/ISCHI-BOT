'use client';
import { ArrowUpRight, Heart, Scale, ShoppingCart } from 'lucide-react';
import { availability, effectivePrice, localized, type Product } from '@/lib/types';
import { money, unitLabel, groupNumber } from '@/lib/money';
import type { TranslationKey } from '@/lib/i18n';
export function ProductCard({
  product,
  lang,
  t,
  image,
  onOpen,
  onAdd,
  favorite,
  onFavorite,
  compared,
  onCompare,
  list = false,
}: {
  product: Product;
  lang: 'uz' | 'ru' | 'en';
  t: (key: TranslationKey) => string;
  image: (url: string) => string;
  onOpen: () => void;
  onAdd: () => void;
  favorite: boolean;
  onFavorite: () => void;
  compared: boolean;
  onCompare: () => void;
  list?: boolean;
}) {
  const stock = availability(product);
  return (
    <article className={`product-card ${list ? 'product-list-card' : ''}`}>
      <div className="product-image-wrap">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onOpen();
          }}
          className="product-image-link"
          aria-label={localized(product.name, lang)}
        >
          <img
            src={image(product.images[0])}
            alt={localized(product.name, lang)}
            loading="lazy"
            width="500"
            height="375"
          />
        </a>
        <div className="product-badges">
          {product.discountPrice && (
            <span className="badge orange">
              −{Math.round((1 - product.discountPrice / product.price) * 100)}%
            </span>
          )}
          {product.featured && <span className="badge dark">{t('popular')}</span>}
        </div>
        <button
          className={`favorite-button ${favorite ? 'selected' : ''}`}
          onClick={onFavorite}
          aria-label={t('favorites')}
          aria-pressed={favorite}
        >
          <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="product-card-body">
        <span className="product-code">{product.code}</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onOpen();
          }}
          className="product-title"
        >
          {localized(product.name, lang)}
        </a>
        {list && <p className="muted">{localized(product.description, lang)}</p>}
        <div className="product-meta">
          <span className={`stock-dot ${stock}`} />
          {t(stock === 'out' ? 'outOfStock' : stock === 'low' ? 'lowStock' : 'inStock')}
          <span className="meta-separator">·</span>
          {t('minOrder')}: {groupNumber(product.minOrder)} {unitLabel(product.unit, lang)}
        </div>
        <div className="product-price-row">
          <div>
            {product.discountPrice && <del>{money(product.price, lang)}</del>}
            <strong>{money(effectivePrice(product), lang)}</strong>
            <small>
              {t('perUnit')} {unitLabel(product.unit, lang)}
            </small>
          </div>
          <button
            className="icon-button compare-button"
            onClick={onCompare}
            aria-label={t('compare')}
            aria-pressed={compared}
          >
            <Scale size={19} />
          </button>
        </div>
        <div className="product-actions">
          <button className="button secondary" onClick={onOpen}>
            {t('viewDetails')}
            <ArrowUpRight size={16} />
          </button>
          <button
            className="button cart-add"
            disabled={stock === 'out' || stock === 'disabled'}
            onClick={onAdd}
            aria-label={`${localized(product.name, lang)} — ${t('addCart')}`}
          >
            <ShoppingCart size={18} />
            <span>{t('addCart')}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
