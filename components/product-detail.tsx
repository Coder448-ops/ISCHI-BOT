'use client';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Heart,
  Minus,
  Plus,
  Scale,
  Share2,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { createClient } from '@/lib/client';
import { availability, effectivePrice, localized, type Product } from '@/lib/types';
import { groupNumber, money, unitLabel } from '@/lib/money';
import type { TranslationKey } from '@/lib/i18n';
import { Empty, ErrorState, Loading } from './ui';
export function ProductDetail({
  id,
  apiBase,
  websiteOrigin,
  lang,
  t,
  image,
  onAdd,
  onBack,
  onOpen,
  onFavorite,
  onCompare,
  notify,
}: {
  id: string;
  apiBase: string;
  websiteOrigin: string;
  lang: 'uz' | 'ru' | 'en';
  t: (key: TranslationKey) => string;
  image: (url: string) => string;
  onAdd: (p: Product, quantity: number, buy?: boolean) => void;
  onBack: () => void;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onCompare: (id: string) => void;
  notify: (text: string) => void;
}) {
  const [data, setData] = useState<{ product: Product; related: Product[] } | null>(null),
    [error, setError] = useState(''),
    [quantity, setQuantity] = useState(1),
    [activeImage, setActiveImage] = useState(0),
    [tab, setTab] = useState('description');
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    setActiveImage(0);
    createClient(apiBase)
      .get<{ product: Product; related: Product[] }>(`/products/${encodeURIComponent(id)}`)
      .then((result) => {
        if (active) {
          setData(result);
          setQuantity(result.product.minOrder);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, apiBase]);
  if (error)
    return (
      <div className="page-container">
        <ErrorState message={error} retry={onBack} label={t('back')} />
      </div>
    );
  if (!data) return <Loading label={t('loading')} />;
  const p = data.product,
    stock = availability(p),
    unit = unitLabel(p.unit, lang);
  const measurements = Object.entries(p.measurements).filter(([, value]) => value !== undefined);
  const changeQuantity = (value: number) =>
    setQuantity(
      Math.min(
        p.stock || p.minOrder,
        Math.max(p.minOrder, Number.isFinite(value) ? value : p.minOrder),
      ),
    );
  const share = async () => {
    const url = `${websiteOrigin || window.location.origin}/product/${encodeURIComponent(p.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: localized(p.name, lang), url });
      else {
        await navigator.clipboard.writeText(url);
        notify(t('copied'));
      }
    } catch {
      /* User cancelled the share sheet. */
    }
  };
  return (
    <div className="page-container detail-page">
      <button className="text-button back-link" onClick={onBack}>
        <ArrowLeft size={17} />
        {t('catalog')}
      </button>
      <div className="product-detail">
        <div className="detail-gallery">
          <div className="detail-main-image">
            <img
              src={image(p.images[activeImage])}
              alt={localized(p.name, lang)}
              width="800"
              height="600"
            />
            {p.demo && <span className="demo-image-label">DEMO</span>}
          </div>
          <div className="gallery-thumbs">
            {p.images.map((src, i) => (
              <button
                key={src}
                className={i === activeImage ? 'active' : ''}
                onClick={() => setActiveImage(i)}
                aria-label={`${t('viewDetails')} ${i + 1}`}
              >
                <img src={image(src)} alt="" width="100" height="80" />
              </button>
            ))}
          </div>
        </div>
        <div className="detail-info">
          <div className="detail-kicker">
            <span>{p.code}</span>
            <span className={`stock-label ${stock}`}>
              <Check size={14} />
              {t(stock === 'out' ? 'outOfStock' : stock === 'low' ? 'lowStock' : 'inStock')}
            </span>
          </div>
          <h1>{localized(p.name, lang)}</h1>
          <p className="detail-manufacturer">
            {p.manufacturer || t('material') + ': ' + p.materialType}
          </p>
          <div className="detail-price">
            {p.discountPrice && <del>{money(p.price, lang)}</del>}
            <strong>{money(effectivePrice(p), lang)}</strong>
            <span>/ {unit}</span>
          </div>
          <div className="detail-stock">
            <span>
              {t('stock')}:{' '}
              <b>
                {groupNumber(p.stock)} {unit}
              </b>
            </span>
            <span>
              {t('minOrder')}:{' '}
              <b>
                {groupNumber(p.minOrder)} {unit}
              </b>
            </span>
          </div>
          <div className="quantity-total">
            <div>
              <label>
                {t('quantity')} ({unit})
              </label>
              <div className="quantity-control">
                <button
                  onClick={() => changeQuantity(quantity - p.step)}
                  disabled={quantity <= p.minOrder}
                  aria-label={t('previous')}
                >
                  <Minus size={17} />
                </button>
                <input
                  type="number"
                  min={p.minOrder}
                  max={p.stock}
                  step={p.step}
                  value={quantity}
                  onChange={(e) => changeQuantity(Number(e.target.value))}
                  onBlur={() =>
                    setQuantity(
                      Math.min(
                        p.stock,
                        Number(
                          (
                            p.minOrder +
                            Math.round((quantity - p.minOrder) / p.step) * p.step
                          ).toFixed(6),
                        ),
                      ),
                    )
                  }
                  aria-label={t('quantity')}
                />
                <button
                  onClick={() => changeQuantity(quantity + p.step)}
                  disabled={quantity >= p.stock}
                  aria-label={t('next')}
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
            <div className="line-total">
              <span>{t('total')}</span>
              <strong>{money(Math.round(effectivePrice(p) * quantity), lang)}</strong>
            </div>
          </div>
          <div className="detail-buy">
            <button
              className="button secondary"
              disabled={['out', 'disabled'].includes(stock)}
              onClick={() => onAdd(p, quantity)}
            >
              <ShoppingCart size={19} />
              {t('addCart')}
            </button>
            <button
              className="button primary"
              disabled={['out', 'disabled'].includes(stock)}
              onClick={() => onAdd(p, quantity, true)}
            >
              {t('buyNow')}
            </button>
          </div>
          <div className="detail-tools">
            <button onClick={() => onFavorite(p.id)}>
              <Heart size={17} />
              {t('favorites')}
            </button>
            <button onClick={() => onCompare(p.id)}>
              <Scale size={17} />
              {t('compare')}
            </button>
            <button onClick={share}>
              <Share2 size={17} />
              {t('share')}
            </button>
          </div>
          <div className="delivery-note">
            <Truck size={22} />
            <p>{t('deliveryNote')}</p>
          </div>
        </div>
      </div>
      <div className="detail-tabs">
        <button
          className={tab === 'description' ? 'active' : ''}
          onClick={() => setTab('description')}
        >
          {t('description')}
        </button>
        <button className={tab === 'specs' ? 'active' : ''} onClick={() => setTab('specs')}>
          {t('specifications')}
        </button>
      </div>
      {tab === 'description' ? (
        <div className="detail-description">
          <p>{localized(p.description, lang)}</p>
        </div>
      ) : (
        <div className="spec-table">
          {p.weight !== null && (
            <div>
              <span>{t('weight')}</span>
              <strong>{p.weight}</strong>
            </div>
          )}
          {measurements.map(([key, value]) => (
            <div key={key}>
              <span>{t(key as TranslationKey)}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div>
            <span>{t('material')}</span>
            <strong>{p.materialType}</strong>
          </div>
          {p.specifications.map((spec, i) => (
            <div key={i}>
              <span>{spec.label}</span>
              <strong>{spec.value}</strong>
            </div>
          ))}
          {!measurements.length && !p.specifications.length && <Empty title={t('notProvided')} />}
        </div>
      )}
      {data.related.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <h2>{t('related')}</h2>
          </div>
          <div className="related-grid">
            {data.related.map((related) => (
              <button
                className="related-product"
                key={related.id}
                onClick={() => onOpen(related.id)}
              >
                <img
                  src={image(related.images[0])}
                  alt=""
                  loading="lazy"
                  width="240"
                  height="180"
                />
                <strong>{localized(related.name, lang)}</strong>
                <span>
                  {money(effectivePrice(related), lang)} / {unitLabel(related.unit, lang)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
